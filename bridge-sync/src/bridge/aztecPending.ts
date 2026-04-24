/**
 * On-disk persistence for the Aztec L2→L1 leg.
 *
 * The aztec leg is 30-90 min end-to-end because it waits on the Aztec prover
 * + L1 outbox to settle. All of that state is in-memory inside the orchestrator
 * today, so a container rebuild/restart during the wait kills the op and the
 * next cycle sends a *new* send_root_to_l1 message, resetting the 75-min clock.
 *
 * We avoid that by persisting just enough to resume after a restart: the Aztec
 * tx hash of the send_root_to_l1 call plus the (blockNumber, PXE root) pair
 * that tx anchored. On restart the executor loads this, verifies the tx is
 * still fetchable, and hands it to `bridgeAZTECLocalRootToL1` via `resumeFrom`,
 * which skips the send and continues from the epoch/outbox poll.
 *
 * Storage lives in the `bridge-sync-db` Docker volume (mounted at
 * /app/bridge-sync/db). Keyed by L1 chain ID so we can track Sepolia and any
 * future L1 independently. Entries are cleared once getNewRootFromL2 lands on
 * L1, or manually expired after 24h so a truly abandoned state doesn't wedge
 * the executor into permanent resume-attempt mode.
 */
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'db');
const DB_DIR = process.env.BRIDGE_SYNC_DB_DIR ?? DEFAULT_DB_DIR;
const FILE = path.join(DB_DIR, 'aztec-pending.json');

// Auto-expire entries older than this. Aztec prover lag on testnet tops out
// around 30-60 min in the wild; 24h gives us plenty of headroom for outlier
// outages without letting genuinely-abandoned state block forever.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface AztecPendingState {
	/** Hex of the Aztec tx hash that carried send_root_to_l1(blockNumberOfRoot). */
	aztecTxHashHex: string;
	/** Aztec L2 block number the root was read at (argument to send_root_to_l1). */
	blockNumberOfRoot: number;
	/** Hex of the PXE note-hash-tree root at that block (what we tell L1 to use). */
	pxeL2RootHex: string;
	createdAtMs: number;
}

function readAll(): Record<string, AztecPendingState> {
	try {
		if (!fs.existsSync(FILE)) return {};
		const raw = fs.readFileSync(FILE, 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed as Record<string, AztecPendingState>;
	} catch {
		return {};
	}
}

function writeAll(all: Record<string, AztecPendingState>) {
	try {
		if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
	} catch (e) {
		// Persistence is best-effort; never let a disk error blow up the leg.
		console.warn('[aztec-pending] failed to write persistence file:', e);
	}
}

export function loadPending(l1ChainId: bigint): AztecPendingState | null {
	const all = readAll();
	const state = all[l1ChainId.toString()];
	if (!state) return null;
	if (Date.now() - state.createdAtMs > MAX_AGE_MS) {
		// Stale: likely an abandoned op from a previous deployment. Drop it so
		// the next cycle starts fresh.
		clearPending(l1ChainId);
		return null;
	}
	return state;
}

export function savePending(l1ChainId: bigint, state: AztecPendingState) {
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
