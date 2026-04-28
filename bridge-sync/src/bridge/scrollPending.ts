/**
 * On-disk persistence for the Scroll L2→L1 leg.
 *
 * Scroll Sepolia batch finalization takes 1-3 hours, all spent polling Scroll's
 * bridge API for a claim proof. Like the Aztec leg, that wait sits in-memory
 * inside the orchestrator, so a container rebuild/restart during the wait
 * kills the op and the next cycle sends a *new* sentLocalRootToL1 message,
 * resetting the clock.
 *
 * We persist the L2 tx hash from the sentLocalRootToL1 call. On restart the
 * executor loads it, verifies the tx is still on Scroll, and hands it to
 * `bridgeEVMLocalRootToL1` via `resumeFrom`, which skips the send and
 * continues at the bridge-API poll.
 *
 * Storage lives in the same `bridge-sync-db` Docker volume as aztecPending,
 * keyed by L1 chain ID. Cleared on success, auto-expired after 24h so an
 * abandoned op doesn't wedge the executor into permanent resume-attempt mode.
 */
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'db');
const DB_DIR = process.env.BRIDGE_SYNC_DB_DIR ?? DEFAULT_DB_DIR;
const FILE = path.join(DB_DIR, 'scroll-pending.json');

// Scroll Sepolia finalization tops out around 3h in the wild; 24h covers
// outlier RPC/outage stalls without letting genuinely-abandoned state block.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ScrollPendingState {
	/** Hex of the Scroll L2 tx that called sentLocalRootToL1. */
	l2TxHashHex: string;
	createdAtMs: number;
}

function readAll(): Record<string, ScrollPendingState> {
	try {
		if (!fs.existsSync(FILE)) return {};
		const raw = fs.readFileSync(FILE, 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed as Record<string, ScrollPendingState>;
	} catch {
		return {};
	}
}

function writeAll(all: Record<string, ScrollPendingState>) {
	try {
		if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
	} catch (e) {
		console.warn('[scroll-pending] failed to write persistence file:', e);
	}
}

export function loadPending(l1ChainId: bigint): ScrollPendingState | null {
	const all = readAll();
	const state = all[l1ChainId.toString()];
	if (!state) return null;
	if (Date.now() - state.createdAtMs > MAX_AGE_MS) {
		clearPending(l1ChainId);
		return null;
	}
	return state;
}

export function savePending(l1ChainId: bigint, state: ScrollPendingState) {
	const all = readAll();
	all[l1ChainId.toString()] = state;
	writeAll(all);
}

export function clearPending(l1ChainId: bigint) {
	const all = readAll();
	if (!(l1ChainId.toString() in all)) return;
	delete all[l1ChainId.toString()];
	writeAll(all);
}
