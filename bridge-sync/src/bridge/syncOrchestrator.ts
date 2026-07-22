/**
 * Sync orchestrator. Queues HTTP-triggered sync requests and batches them
 * into route-aware cross-chain root-sync cycles.
 *
 * Behavior:
 * - First request starts a cycle immediately with its requirements.
 * - Requests arriving during an in-flight cycle queue into `pending`; at the
 *   start of the next cycle (or the next retry of the in-flight one), the
 *   orchestrator ORs their flags into whatever's already running.
 * - On cycle failure the orchestrator retries once. If pending waiters have
 *   accumulated, the retry folds them in so everyone shares one cycle
 *   instead of queueing two consecutive ones.
 * - After a second failure, attached waiters reject; any newer pending
 *   waiters become the next fresh cycle.
 *
 * Per-route flags (see syncRequirements.ts) ensure N concurrent HTTP requests
 * cost one cycle's worth of L1 gas AND only trigger the sub-tasks any of
 * them actually need.
 */
import { runSyncCycle, emptySyncResult, type FullSyncResult } from './executor.js';
import {
  type SyncRequirements,
  EMPTY_REQUIREMENTS,
  mergeRequirements,
  hasAnyRequirement,
} from './syncRequirements.js';

interface Waiter {
  resolve: (r: FullSyncResult) => void;
  reject: (e: any) => void;
  requirements: SyncRequirements;
}

let inflight: Waiter[] = [];
let pending: Waiter[] = [];
let cycleLoopRunning = false;

export function requestSync(
  privateKey: string,
  confirmations: number,
  requirements: SyncRequirements,
): Promise<FullSyncResult> {
  return new Promise((resolve, reject) => {
    const w: Waiter = { resolve, reject, requirements };
    if (cycleLoopRunning) {
      pending.push(w);
      console.log(`[sync-orch] queued request (${pending.length} pending)`);
    } else {
      inflight.push(w);
      void cycleLoop(privateKey, confirmations);
    }
  });
}

export function getOrchestratorState() {
  return { inflight: inflight.length, pending: pending.length, running: cycleLoopRunning };
}

function unionOf(waiters: Waiter[]): SyncRequirements {
  return waiters.reduce<SyncRequirements>(
    (acc, w) => mergeRequirements(acc, w.requirements),
    EMPTY_REQUIREMENTS,
  );
}

async function cycleLoop(privateKey: string, confirmations: number) {
  cycleLoopRunning = true;
  try {
    while (true) {
      let attempt = 0;
      let result: FullSyncResult | null = null;
      let finalErr: any = null;

      while (attempt < 2) {
        attempt++;
        // Fold pending waiters into inflight at the start of each attempt.
        // This lets a retry absorb any requests that arrived since the last
        // failure, so the batch converges instead of spawning follow-ups.
        if (pending.length > 0) {
          console.log(`[sync-orch] folding ${pending.length} pending into attempt ${attempt}`);
          inflight.push(...pending);
          pending = [];
        }
        const merged = unionOf(inflight);
        if (!hasAnyRequirement(merged)) {
          // Degenerate case: somehow all waiters have empty requirements.
          // Resolve them with a no-op synthetic result and move on.
          result = emptySyncResult();
          break;
        }
        console.log(`[sync-orch] running cycle (attempt ${attempt}, ${inflight.length} waiters) requirements=${JSON.stringify(merged)}`);
        try {
          result = await runSyncCycle(privateKey, confirmations, merged);
          finalErr = null;
          break;
        } catch (e) {
          finalErr = e;
          console.error(`[sync-orch] cycle attempt ${attempt} failed:`, e);
        }
      }

      if (result) {
        for (const w of inflight) w.resolve(result);
      } else {
        for (const w of inflight) w.reject(finalErr);
      }
      inflight = [];

      if (pending.length > 0) {
        inflight = pending;
        pending = [];
        continue;
      }
      break;
    }
  } finally {
    cycleLoopRunning = false;
  }
}
