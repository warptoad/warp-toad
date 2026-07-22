/**
 * Per-route sync requirements.
 *
 * Each HTTP bridge request declares which root-sync sub-tasks it actually
 * needs. The orchestrator unions the requirements of all waiters attached to a
 * cycle and runs only those steps. This mirrors the older working pattern
 * in `backend/scripts/syncTestnetToAztec.ts`: don't touch L2→L1 for L1→L2
 * bridges (the Aztec prover lag would block it for no benefit).
 *
 * Requirements are keyed by leg (see legRegistry.ts) rather than being a fixed set of
 * booleans, so a new L2 needs no changes here. Arrays rather than Sets because these
 * cross the HTTP boundary and get persisted by operationsStore.
 */
import type { ChainId } from '../types/index.js';
import { LEG_KEYS, isLeg, isSlowLeg, type LegKey } from './legRegistry.js';

export interface SyncRequirements {
  /** Legs whose local root must be pushed up to L1. */
  needL2ToL1: LegKey[];
  /** Legs the freshly folded gigaRoot must be dispatched to. */
  dispatchTo: LegKey[];
}

export const EMPTY_REQUIREMENTS: SyncRequirements = { needL2ToL1: [], dispatchTo: [] };

const union = (a: LegKey[], b: LegKey[]): LegKey[] =>
  LEG_KEYS.filter((k) => a.includes(k) || b.includes(k));

export function mergeRequirements(a: SyncRequirements, b: SyncRequirements): SyncRequirements {
  return {
    needL2ToL1: union(a.needL2ToL1, b.needL2ToL1),
    dispatchTo: union(a.dispatchTo, b.dispatchTo),
  };
}

export function hasAnyRequirement(r: SyncRequirements): boolean {
  return r.needL2ToL1.length > 0 || r.dispatchTo.length > 0;
}

export function requirementsFor(legs: { needL2ToL1?: LegKey[]; dispatchTo?: LegKey[] }): SyncRequirements {
  return { needL2ToL1: legs.needL2ToL1 ?? [], dispatchTo: legs.dispatchTo ?? [] };
}

/** Human-readable summary for logs. */
export function describeRequirements(r: SyncRequirements): string {
  const parts: string[] = [];
  if (r.needL2ToL1.length) parts.push(`L2->L1: ${r.needL2ToL1.join('+')}`);
  if (r.dispatchTo.length) parts.push(`dispatch: ${r.dispatchTo.join('+')}`);
  return parts.length ? parts.join(', ') : '(nothing)';
}

/**
 * Split combined requirements into independent cycles, isolating each slow leg.
 *
 * runSyncCycle does its single updateGigaRoot fold only AFTER every L2→L1 push in the
 * cycle. A ZK Stack L2→L1 push can take hours, so a slow leg sharing a cycle blocks
 * every other leg's root from being folded into gigaRoot, stranding their withdraws.
 *
 * So: everything fast goes in the first cycle, and each slow leg's L2→L1 push gets its
 * own cycle afterwards. Each cycle still dispatches the fresh gigaRoot to ALL requested
 * legs (executor step 4), so nobody is left stale. A dispatch-only requirement for a
 * slow leg is fast (it's just an L1→L2 message) and needs no isolation, which keeps the
 * always-on keeper heartbeat from paying double updateGigaRoot/sendGigaRoot gas.
 */
export function splitRequirements(r: SyncRequirements): SyncRequirements[] {
  const slow = r.needL2ToL1.filter(isSlowLeg);
  const fast = r.needL2ToL1.filter((k) => !isSlowLeg(k));

  // Nothing slow, or nothing else that a slow leg would block: one cycle.
  if (slow.length === 0) return [r];
  if (fast.length === 0 && r.dispatchTo.length === 0 && slow.length === 1) return [r];

  const cycles: SyncRequirements[] = [];
  if (fast.length > 0 || r.dispatchTo.length > 0) {
    cycles.push({ needL2ToL1: fast, dispatchTo: r.dispatchTo });
  }
  for (const key of slow) {
    cycles.push({ needL2ToL1: [key], dispatchTo: [] });
  }
  return cycles;
}

/**
 * Map an HTTP route (from → to) to its minimal sync requirements.
 *
 *   from=<leg>  : that leg's local root must be pushed to L1.
 *   from=L1     : nothing from-side (L1 state is on-chain already).
 *   to=<leg>    : gigaRoot must be dispatched to that leg's L1 adapter.
 *   to=L1       : nothing to-side (the user's proof verifies directly on L1).
 */
export function routeToRequirements(from: ChainId, to: ChainId): SyncRequirements {
  return {
    needL2ToL1: isLeg(from) ? [from] : [],
    dispatchTo: isLeg(to) ? [to] : [],
  };
}
