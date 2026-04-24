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
