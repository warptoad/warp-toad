/**
 * Sync orchestrator. Queues HTTP-triggered sync requests and batches them
 * into single cross-chain root-sync cycles.
 *
 * Behavior:
 * - First request starts a cycle immediately.
 * - Requests arriving during an in-flight cycle attach to a single "pending"
 *   batch that runs after the current cycle completes.
 * - On cycle failure the orchestrator retries once. If a pending batch is
 *   already accumulating, the retry folds those waiters in so everyone
 *   shares one retry instead of queueing two separate follow-ups.
 * - After the retry fails, inflight waiters reject and any still-pending
 *   waiters become the next fresh cycle.
 *
 * This decouples gas cost from request volume: N concurrent HTTP requests
 * cost one cycle's worth of L1 gas, not N.
 */
import { runFullSyncCycle, type FullSyncResult } from './executor.js';

interface Deferred {
  resolve: (r: FullSyncResult) => void;
  reject: (e: any) => void;
}

let inflight: Deferred[] = [];
let pending: Deferred[] = [];
let cycleLoopRunning = false;

/**
 * Enqueue a sync request. Returns a promise that resolves when the cycle
 * this request is attached to completes (success or final failure).
 */
export function requestSync(privateKey: string, confirmations: number): Promise<FullSyncResult> {
  return new Promise((resolve, reject) => {
    const d: Deferred = { resolve, reject };
    if (cycleLoopRunning) {
      pending.push(d);
      console.log(`[sync-orch] queued request (${pending.length} pending)`);
    } else {
      inflight.push(d);
      void cycleLoop(privateKey, confirmations);
    }
  });
}

export function getOrchestratorState() {
  return { inflight: inflight.length, pending: pending.length, running: cycleLoopRunning };
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
        // Fold any newly pending waiters into this cycle (initial run OR retry).
        // Lets a retry absorb the next batch so we don't run two cycles in a row.
        if (pending.length > 0) {
          console.log(`[sync-orch] folding ${pending.length} pending into attempt ${attempt}`);
          inflight.push(...pending);
          pending = [];
        }
        console.log(`[sync-orch] running cycle (attempt ${attempt}, ${inflight.length} waiters)`);
        try {
          result = await runFullSyncCycle(privateKey, confirmations);
          finalErr = null;
          break;
        } catch (e) {
          finalErr = e;
          console.error(`[sync-orch] cycle attempt ${attempt} failed:`, e);
        }
      }

      if (result) {
        for (const d of inflight) d.resolve(result);
      } else {
        for (const d of inflight) d.reject(finalErr);
      }
      inflight = [];

      // New pending may have arrived during dispatch. Start another cycle.
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
