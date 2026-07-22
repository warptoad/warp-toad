/**
 * On-disk persistence for a ZK Stack L2→L1 leg.
 *
 * A ZK Stack L2→L1 root push only becomes provable once its batch is sealed,
 * committed, proven and executed on L1: measured at 116 minutes on Era Sepolia, and a
 * low-traffic chain that seals batches on a timeout is slower still. All of that wait
 * sits in-memory inside the orchestrator, so a container rebuild/restart during it
 * kills the op and the next cycle sends a *new* sentLocalRootToL1 message, resetting
 * the clock from zero.
 *
 * We persist the L2 tx hash from the sentLocalRootToL1 call. On restart the executor
 * loads it, verifies the tx is still on that L2, and hands it to
 * `bridgeEVMLocalRootToL1` via `resumeFrom`, which skips the send and continues at the
 * proof poll. The sendToL1 payload is NOT stored: it is rebuilt from the
 * SentLocalRootToL1 event on the same tx.
 *
 * Storage lives in the same `bridge-sync-db` Docker volume as aztecPending, keyed by
 * "<l1ChainId>:<legKey>" so several ZK Stack chains can each have an independent
 * in-flight push. Cleared on success, auto-expired after 24h so an abandoned op doesn't
 * wedge the executor into permanent resume-attempt mode.
 */
import fs from 'fs';
import path from 'path';
import type { LegKey } from './legRegistry.js';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'db');
const DB_DIR = process.env.BRIDGE_SYNC_DB_DIR ?? DEFAULT_DB_DIR;
const FILE = path.join(DB_DIR, 'zkstack-pending.json');

// Finalization tops out around 8h on the slowest ZK Stack testnet; 24h covers outlier
// RPC/outage stalls without letting genuinely-abandoned state block.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ZkStackPendingState {
	/** Hex of the L2 tx that called sentLocalRootToL1. */
	l2TxHashHex: string;
	createdAtMs: number;
}

const keyOf = (l1ChainId: bigint, leg: LegKey) => `${l1ChainId.toString()}:${leg}`;

function readAll(): Record<string, ZkStackPendingState> {
	try {
		if (!fs.existsSync(FILE)) return {};
		const raw = fs.readFileSync(FILE, 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed as Record<string, ZkStackPendingState>;
	} catch {
		return {};
	}
}

function writeAll(all: Record<string, ZkStackPendingState>) {
	try {
		if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
	} catch (e) {
		console.warn('[zkstack-pending] failed to write persistence file:', e);
	}
}

export function loadPending(l1ChainId: bigint, leg: LegKey): ZkStackPendingState | null {
	const all = readAll();
	const state = all[keyOf(l1ChainId, leg)];
	if (!state) return null;
	if (Date.now() - state.createdAtMs > MAX_AGE_MS) {
		clearPending(l1ChainId, leg);
		return null;
	}
	return state;
}

export function savePending(l1ChainId: bigint, leg: LegKey, state: ZkStackPendingState) {
	const all = readAll();
	all[keyOf(l1ChainId, leg)] = state;
	writeAll(all);
}

export function clearPending(l1ChainId: bigint, leg: LegKey) {
	const all = readAll();
	const k = keyOf(l1ChainId, leg);
	if (!(k in all)) return;
	delete all[k];
	writeAll(all);
}
