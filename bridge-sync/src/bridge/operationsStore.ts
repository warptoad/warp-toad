/**
 * On-disk persistence for HTTP operation tracking.
 *
 * Today's `operations` Map in server.ts is in-memory only. A container
 * rebuild during a 2-3h Scroll-finalization wait orphans the opIds clients
 * are polling: GET /status/:opId returns 404 even though the underlying
 * sync work resumes (aztec-pending and scroll-pending are persisted).
 * Frontend goes blind.
 *
 * This store mirrors the aztecPending/scrollPending pattern: a single JSON
 * file under BRIDGE_SYNC_DB_DIR, write-debounced, auto-pruned, never
 * crashes the service if disk fails.
 *
 * Lifecycle:
 *   - boot: loadAll() restores the Map; entries older than maxAge are dropped.
 *   - per request: server creates op, calls saveOperation. Fire-and-forget
 *     debounced write (max 1 fs.writeFile per second).
 *   - per cycle completion: server mutates op.status, calls saveOperation.
 *   - background: deleteExpired runs from the scheduler's idle tick.
 */
import fs from 'fs';
import path from 'path';
import type { BridgeOperation } from '../types/index.js';

const DEFAULT_DB_DIR = path.join(process.cwd(), 'db');
const DB_DIR = process.env.BRIDGE_SYNC_DB_DIR ?? DEFAULT_DB_DIR;
const FILE = path.join(DB_DIR, 'operations.json');

/** 48h: longer than the 4h max bridge cycle, short enough to bound disk use. */
const DEFAULT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 1000;

type PersistedOperation = BridgeOperation & { lastUpdatedAtMs: number };
type PersistedMap = Record<string, PersistedOperation>;

let cache: PersistedMap = {};
let cacheLoaded = false;
let writeTimer: NodeJS.Timeout | null = null;
let writePending = false;

function readFromDisk(): PersistedMap {
	try {
		if (!fs.existsSync(FILE)) return {};
		const raw = fs.readFileSync(FILE, 'utf8');
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed as PersistedMap;
	} catch (e) {
		console.warn('[operations-store] failed to read; starting empty:', e);
		return {};
	}
}

function writeToDisk() {
	try {
		if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
	} catch (e) {
		console.warn('[operations-store] failed to write:', e);
	}
}

function scheduleWrite() {
	if (writeTimer) {
		writePending = true;
		return;
	}
	writeTimer = setTimeout(() => {
		writeToDisk();
		writeTimer = null;
		if (writePending) {
			writePending = false;
			scheduleWrite();
		}
	}, WRITE_DEBOUNCE_MS);
}

/**
 * Load the persisted operations into the in-memory cache and return a Map
 * the server can use directly. Drops entries older than maxAgeMs so the file
 * doesn't grow forever on a long-running deploy.
 */
export function loadAll(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Map<string, BridgeOperation> {
	cache = readFromDisk();
	cacheLoaded = true;
	const now = Date.now();
	let pruned = 0;
	for (const [opId, op] of Object.entries(cache)) {
		const age = now - (op.lastUpdatedAtMs ?? op.startTime);
		if (age > maxAgeMs) {
			delete cache[opId];
			pruned++;
		}
	}
	if (pruned > 0) {
		console.log(`[operations-store] pruned ${pruned} expired operations on load`);
		scheduleWrite();
	}
	const out = new Map<string, BridgeOperation>();
	for (const [opId, op] of Object.entries(cache)) {
		const { lastUpdatedAtMs, ...rest } = op;
		out.set(opId, rest);
	}
	console.log(`[operations-store] loaded ${out.size} operations from ${FILE}`);
	return out;
}

/**
 * Persist a single operation. Debounced internally; safe to call on every
 * status mutation. The operation reference held by the server's Map and the
 * closure callbacks remain authoritative; this just snapshots them to disk.
 */
export function saveOperation(op: BridgeOperation) {
	if (!cacheLoaded) {
		// Defensive: someone called save before load. Read once so we don't
		// overwrite the file with just this one entry.
		cache = readFromDisk();
		cacheLoaded = true;
	}
	cache[op.operationId] = { ...op, lastUpdatedAtMs: Date.now() };
	scheduleWrite();
}

/**
 * Drop entries older than maxAgeMs from cache and disk. Idempotent. Called
 * from the scheduler's idle tick; cheap when nothing is expired.
 */
export function deleteExpired(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number {
	if (!cacheLoaded) return 0;
	const now = Date.now();
	let pruned = 0;
	for (const [opId, op] of Object.entries(cache)) {
		const age = now - (op.lastUpdatedAtMs ?? op.startTime);
		if (age > maxAgeMs) {
			delete cache[opId];
			pruned++;
		}
	}
	if (pruned > 0) {
		console.log(`[operations-store] pruned ${pruned} expired operations`);
		scheduleWrite();
	}
	return pruned;
}

/**
 * Test/debug helper: force the debounced write to flush now. Not used in
 * production code paths.
 */
export function flushNow() {
	if (writeTimer) {
		clearTimeout(writeTimer);
		writeTimer = null;
	}
	writeToDisk();
	writePending = false;
}
