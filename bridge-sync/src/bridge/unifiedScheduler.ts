/**
 * Unified coalescing scheduler.
 *
 * Replaces the per-route triggering in `syncOrchestrator` and the aztec-only
 * heartbeat with a single self-driving system that converges all chains and
 * runs only stale legs.
 *
 * Behavior:
 *   - First POST after idle: schedule tick at now + coalesceWindowMs (90s default).
 *   - Subsequent POSTs within the window: just push waiter; no timer reset.
 *     All in-window burns share the same tick so only one Scroll-finalization
 *     wait is paid for the whole burst.
 *   - POST during in-flight tick: push waiter, set followUpScheduled. The
 *     follow-up tick fires after the current one completes, covering this
 *     waiter without queueing a fresh independent cycle.
 *   - Idle: idleIntervalMs cadence (5 min default). Reads computeStaleLegs;
 *     if anything is stale, fires a tick immediately. This subsumes the
 *     aztec heartbeat's lag-threshold push (the heartbeat behavior lives in
 *     computeStaleLegs now).
 *   - Tick: locks running, calls computeStaleLegs at start, runs only flagged
 *     legs via runSyncCycle, resolves all attached waiters with the result.
 *     Retries once on failure (mirrors syncOrchestrator's retry semantics).
 *     If nothing is stale, resolves with a noop FullSyncResult and burns no
 *     L1 gas.
 *   - Post-tick: if followUpScheduled OR new waiters arrived during tick OR
 *     staleness remains, schedule a follow-up at now + coalesceWindowMs.
 *
 * The race-free contract: state mutations happen in synchronous blocks
 * (Node is single-threaded). The await points inside `tick` are between
 * computeStaleLegs and runSyncCycle, and between attempts. During those
 * awaits, enqueues see `state.running === true` and set followUpScheduled
 * instead of starting a new cycle.
 *
 * Memory constraints respected (see memory files):
 *   - feedback_aztec_node_prunes_state: lag-threshold push lives in
 *     computeStaleLegs and forces needAztecL2ToL1 even when local roots
 *     match, preserving the testnet node-pruning workaround.
 *   - feedback_l2warptoad_initialize_required: deploy-bug guard in
 *     computeStaleLegs returns EMPTY_REQUIREMENTS so the scheduler does
 *     not spin a cycle that would always FailedRelayedMessage.
 */
import { runSyncCycle, type FullSyncResult } from './executor.js';
import { computeStaleLegs, buildStaleLegInputs } from './staleLegs.js';
import {
	hasAnyRequirement,
	splitRequirements,
	type SyncRequirements,
} from './syncRequirements.js';
import type { ChainId } from '../types/index.js';
import { deleteExpired as deleteExpiredOperations } from './operationsStore.js';

type TickResult = 'noop' | 'success' | 'failed';

interface Waiter {
	resolve: (r: FullSyncResult) => void;
	reject: (e: any) => void;
	opId: string;
	route: { from: ChainId; to: ChainId };
	enqueuedAtMs: number;
}

export interface ScheduleConfig {
	privateKey: string;
	confirmations: number;
	/** Idle cadence floor: how often to check staleness when no users POST. */
	idleIntervalMs: number;
	/** Absorption window: first POST waits this long before tick fires. Default 90000. */
	coalesceWindowMs?: number;
}

export interface SchedulerState {
	enabled: boolean;
	running: boolean;
	scheduledTickAt: number | null;
	followUpScheduled: boolean;
	waiters: number;
	lastTickAt: number | null;
	lastTickResult: TickResult | null;
	lastTickDurationMs: number | null;
	lastStaleLegs: SyncRequirements | null;
	ticksRun: number;
	ticksNoop: number;
	ticksSuccess: number;
	ticksFailed: number;
}

const DEFAULT_COALESCE_WINDOW_MS = 90_000;

interface InternalState {
	config: ScheduleConfig | null;
	stopped: boolean;
	running: boolean;
	scheduledTickAt: number | null;
	scheduledTimer: NodeJS.Timeout | null;
	followUpScheduled: boolean;
	waiters: Waiter[];
	lastTickAt: number | null;
	lastTickResult: TickResult | null;
	lastTickDurationMs: number | null;
	lastStaleLegs: SyncRequirements | null;
	idleInterval: NodeJS.Timeout | null;
	ticksRun: number;
	ticksNoop: number;
	ticksSuccess: number;
	ticksFailed: number;
}

const state: InternalState = {
	config: null,
	stopped: false,
	running: false,
	scheduledTickAt: null,
	scheduledTimer: null,
	followUpScheduled: false,
	waiters: [],
	lastTickAt: null,
	lastTickResult: null,
	lastTickDurationMs: null,
	lastStaleLegs: null,
	idleInterval: null,
	ticksRun: 0,
	ticksNoop: 0,
	ticksSuccess: 0,
	ticksFailed: 0,
};

export function startScheduler(config: ScheduleConfig): void {
	if (state.config) {
		console.log('[scheduler] already started; ignoring duplicate startScheduler call');
		return;
	}
	state.config = {
		coalesceWindowMs: DEFAULT_COALESCE_WINDOW_MS,
		...config,
	};
	state.stopped = false;

	// Stagger the first idle check so server.listen logs aren't buried.
	setTimeout(
		() => idleCheck().catch((e) => console.error('[scheduler] initial idle check failed:', e)),
		5_000,
	);

	state.idleInterval = setInterval(() => {
		idleCheck().catch((e) => console.error('[scheduler] idle check failed:', e));
	}, config.idleIntervalMs);

	console.log(
		`[scheduler] started: idle check every ${Math.round(config.idleIntervalMs / 1000)}s, ` +
			`coalesce window ${Math.round((state.config.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS) / 1000)}s`,
	);
}

export function stopScheduler(): void {
	state.stopped = true;
	if (state.idleInterval) clearInterval(state.idleInterval);
	if (state.scheduledTimer) clearTimeout(state.scheduledTimer);
	state.idleInterval = null;
	state.scheduledTimer = null;
	state.scheduledTickAt = null;
	state.config = null;
}

export function getSchedulerState(): SchedulerState {
	return {
		enabled: !!state.config && !state.stopped,
		running: state.running,
		scheduledTickAt: state.scheduledTickAt,
		followUpScheduled: state.followUpScheduled,
		waiters: state.waiters.length,
		lastTickAt: state.lastTickAt,
		lastTickResult: state.lastTickResult,
		lastTickDurationMs: state.lastTickDurationMs,
		lastStaleLegs: state.lastStaleLegs,
		ticksRun: state.ticksRun,
		ticksNoop: state.ticksNoop,
		ticksSuccess: state.ticksSuccess,
		ticksFailed: state.ticksFailed,
	};
}

export function enqueueOperation(
	opId: string,
	route: { from: ChainId; to: ChainId },
): Promise<FullSyncResult> {
	if (!state.config) {
		return Promise.reject(new Error('Scheduler not started'));
	}
	return new Promise((resolve, reject) => {
		state.waiters.push({
			resolve,
			reject,
			opId,
			route,
			enqueuedAtMs: Date.now(),
		});
		console.log(
			`[scheduler] enqueued ${opId} (${route.from}->${route.to}); waiters=${state.waiters.length} running=${state.running}`,
		);

		if (state.running) {
			// In-flight tick will not pick up this waiter (already past the
			// "capture waiters" point or still before staleness read). Force a
			// follow-up tick after the current one ends.
			state.followUpScheduled = true;
			return;
		}

		// Idle. Schedule a tick at now + coalesceWindowMs unless one is already
		// pending. If pending, this waiter joins the same tick; do NOT reset
		// the timer (otherwise sustained traffic would push the tick out
		// indefinitely).
		if (state.scheduledTickAt !== null) return;

		const window = state.config!.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS;
		scheduleTickAt(Date.now() + window);
	});
}

function scheduleTickAt(timestamp: number) {
	if (state.scheduledTimer) clearTimeout(state.scheduledTimer);
	state.scheduledTickAt = timestamp;
	const delay = Math.max(0, timestamp - Date.now());
	state.scheduledTimer = setTimeout(() => {
		state.scheduledTimer = null;
		state.scheduledTickAt = null;
		tick().catch((e) => console.error('[scheduler] tick failed:', e));
	}, delay);
}

async function idleCheck() {
	if (state.stopped || state.running || state.scheduledTickAt !== null) return;
	// Housekeeping: prune expired persisted operations on every idle tick.
	// Cheap when nothing is expired.
	try {
		deleteExpiredOperations();
	} catch (e) {
		console.warn('[scheduler] deleteExpiredOperations failed:', e);
	}
	try {
		const { flags } = await computeStaleLegs(buildStaleLegInputs());
		if (hasAnyRequirement(flags)) {
			console.log(`[scheduler] idle check found stale legs ${JSON.stringify(flags)}; firing tick`);
			tick().catch((e) => console.error('[scheduler] idle-driven tick failed:', e));
		}
	} catch (e) {
		console.error('[scheduler] idle check error:', e);
	}
}

async function tick() {
	if (state.stopped || !state.config) return;
	if (state.running) {
		state.followUpScheduled = true;
		return;
	}

	state.running = true;
	state.ticksRun += 1;
	const tickStartedAtMs = Date.now();
	state.lastTickAt = tickStartedAtMs;

	// Capture the waiter list under the running lock so concurrent enqueues
	// during the tick set followUpScheduled instead of getting silently
	// included.
	const tickWaiters = state.waiters;
	state.waiters = [];

	try {
		const { flags } = await computeStaleLegs(buildStaleLegInputs());
		state.lastStaleLegs = flags;

		if (!hasAnyRequirement(flags)) {
			console.log(
				`[scheduler] tick: no stale legs (waiters=${tickWaiters.length}); resolving as noop`,
			);
			const noopResult: FullSyncResult = {
				aztec: null,
				scroll: null,
				updateGigaRootTxHash: 'N/A',
				sendGigaRootTxHash: 'N/A',
				gigaRootSent: '',
			};
			for (const w of tickWaiters) w.resolve(noopResult);
			state.lastTickResult = 'noop';
			state.ticksNoop += 1;
			return;
		}

		console.log(
			`[scheduler] tick: running cycle (waiters=${tickWaiters.length}) flags=${JSON.stringify(flags)}`,
		);
		// Split combined Aztec+Scroll work into independent cycles (Aztec leg
		// first) so a stuck Scroll L2->L1 finalization can't block the Aztec
		// fold+dispatch. Each cycle still dispatches the gigaRoot to all adapters,
		// so neither L2 is left stale.
		const cycles = splitRequirements(flags);
		if (cycles.length > 1) {
			console.log(`[scheduler] split into ${cycles.length} cycles (Aztec leg first) so a slow Scroll leg can't block the Aztec fold`);
		}
		let result: FullSyncResult | null = null;
		let finalErr: any = null;
		for (const cycleFlags of cycles) {
			let cycleResult: FullSyncResult | null = null;
			let attempt = 0;
			while (attempt < 2) {
				attempt += 1;
				try {
					cycleResult = await runSyncCycle(state.config.privateKey, state.config.confirmations, cycleFlags);
					break;
				} catch (e) {
					finalErr = e;
					console.error(`[scheduler] cycle ${JSON.stringify(cycleFlags)} attempt ${attempt} failed:`, e);
				}
			}
			if (cycleResult) {
				result = cycleResult;
				finalErr = null;
			}
		}

		if (result) {
			for (const w of tickWaiters) w.resolve(result);
			state.lastTickResult = 'success';
			state.ticksSuccess += 1;
		} else {
			for (const w of tickWaiters) w.reject(finalErr);
			state.lastTickResult = 'failed';
			state.ticksFailed += 1;
		}
	} finally {
		state.running = false;
		state.lastTickDurationMs = Date.now() - tickStartedAtMs;

		// Schedule a follow-up if anything happened that needs another cycle:
		//  - waiters arrived during the tick (they're in state.waiters now,
		//    not tickWaiters which we captured at start).
		//  - followUpScheduled was set explicitly (by an enqueue mid-tick).
		// The follow-up tick will re-read staleness; if nothing is stale, it
		// resolves as noop without burning gas.
		const shouldFollowUp = state.followUpScheduled || state.waiters.length > 0;
		state.followUpScheduled = false;
		if (shouldFollowUp && !state.stopped) {
			const window =
				state.config?.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS;
			console.log(
				`[scheduler] follow-up tick scheduled in ${Math.round(window / 1000)}s (waiters=${state.waiters.length})`,
			);
			scheduleTickAt(Date.now() + window);
		}
	}
}
