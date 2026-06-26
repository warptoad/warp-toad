/**
 * Per-route sync requirements.
 *
 * Each HTTP bridge request declares which root-sync sub-tasks it actually
 * needs. The orchestrator ORs the flags of all waiters attached to a cycle
 * and runs only the flagged steps. This mirrors the older working pattern
 * in `backend/scripts/syncTestnetToAztec.ts`: don't touch L2→L1 for L1→L2
 * bridges (the Aztec prover lag would block it for no benefit).
 */
import type { ChainId } from '../types/index.js';

export interface SyncRequirements {
  /** Push Aztec's latest local root up to L1 via the Aztec L2→L1 messenger. */
  needAztecL2ToL1: boolean;
  /** Push Scroll's latest local root up to L1 via the Scroll messenger. */
  needScrollL2ToL1: boolean;
  /** Dispatch the new gigaRoot to L1AztecBridgeAdapter (→ Aztec). */
  dispatchToAztec: boolean;
  /** Dispatch the new gigaRoot to L1ScrollBridgeAdapter (→ Scroll). */
  dispatchToScroll: boolean;
}

export const EMPTY_REQUIREMENTS: SyncRequirements = {
  needAztecL2ToL1: false,
  needScrollL2ToL1: false,
  dispatchToAztec: false,
  dispatchToScroll: false,
};

export function mergeRequirements(a: SyncRequirements, b: SyncRequirements): SyncRequirements {
  return {
    needAztecL2ToL1: a.needAztecL2ToL1 || b.needAztecL2ToL1,
    needScrollL2ToL1: a.needScrollL2ToL1 || b.needScrollL2ToL1,
    dispatchToAztec: a.dispatchToAztec || b.dispatchToAztec,
    dispatchToScroll: a.dispatchToScroll || b.dispatchToScroll,
  };
}

export function hasAnyRequirement(r: SyncRequirements): boolean {
  return r.needAztecL2ToL1 || r.needScrollL2ToL1 || r.dispatchToAztec || r.dispatchToScroll;
}

/**
 * Split combined requirements into independent per-L2 cycles, Aztec leg FIRST.
 *
 * runSyncCycle does its single updateGigaRoot fold only AFTER both the Aztec
 * (step 1) and Scroll (step 2) L2->L1 pushes. Scroll finalization can take up
 * to 3h, so a stuck Scroll leg blocks the Aztec root from ever being folded
 * into gigaRoot - which strands Aztec->L1 withdraws (the fold + L1->Aztec
 * dispatch never happen). Running the Aztec leg as its own cycle first lets its
 * fold+dispatch land on-chain before the slow Scroll leg runs. Each cycle still
 * dispatches the fresh gigaRoot to ALL adapters (executor step 4), so the other
 * L2 isn't left stale. Only splits when a slow Scroll L2->L1 push coincides
 * with Aztec work; everything else (including a dispatch-only Scroll leg, which
 * is fast) stays a single cycle so the always-on keeper heartbeat doesn't pay
 * double updateGigaRoot/sendGigaRoot gas every tick.
 */
export function splitRequirements(r: SyncRequirements): SyncRequirements[] {
  const touchesAztec = r.needAztecL2ToL1 || r.dispatchToAztec;
  // Split only to isolate a SLOW Scroll L2->L1 push from Aztec work it would
  // otherwise block. A Scroll-only dispatch needs no isolation.
  if (!(r.needScrollL2ToL1 && touchesAztec)) return [r];
  return [
    { needAztecL2ToL1: r.needAztecL2ToL1, dispatchToAztec: r.dispatchToAztec, needScrollL2ToL1: false, dispatchToScroll: false },
    { needAztecL2ToL1: false, dispatchToAztec: false, needScrollL2ToL1: r.needScrollL2ToL1, dispatchToScroll: r.dispatchToScroll },
  ];
}

/**
 * Map an HTTP route (from → to) to its minimal sync requirements.
 *
 *   from=aztec   : local root must be pushed to L1.
 *   from=534351  : local root must be pushed to L1.
 *   from=L1      : nothing from-side (L1 state is on-chain already).
 *   to=aztec     : gigaRoot must be dispatched to L1AztecBridgeAdapter.
 *   to=534351    : gigaRoot must be dispatched to L1ScrollBridgeAdapter.
 *   to=L1        : nothing to-side (user's proof verifies directly on L1).
 */
export function routeToRequirements(from: ChainId, to: ChainId): SyncRequirements {
  const req: SyncRequirements = { ...EMPTY_REQUIREMENTS };
  if (from === 'aztec') req.needAztecL2ToL1 = true;
  if (from === '534351') req.needScrollL2ToL1 = true;
  if (to === 'aztec') req.dispatchToAztec = true;
  if (to === '534351') req.dispatchToScroll = true;
  return req;
}
