/**
 * The one place that knows which L2 legs exist.
 *
 * Everything downstream (sync requirements, chain config, routes, timeouts, contract
 * loading, stale-leg detection) derives from this list instead of hardcoding a pair of
 * chains. Adding an L2 should be an entry in the backend's ZK_STACK_TARGETS, not a
 * change to a union type in five files.
 *
 * A "leg" is any non-L1 endpoint the keeper syncs roots with: Aztec, plus every ZK
 * Stack chain that has claimed a GigaBridge adapter slot.
 */
// @ts-ignore - resolved to .ts at runtime via tsx, see executor.ts header
import { ZK_STACK_TARGETS, type ZkStackTarget } from '../../../backend/lib/zkStackChains.js';

/** Stable identifier for a leg: 'aztec', or a ZK Stack chain id as a decimal string. */
export type LegKey = string;

export const AZTEC_LEG: LegKey = 'aztec';

export interface LegDescriptor {
  key: LegKey;
  kind: 'aztec' | 'zkstack';
  label: string;
  /** undefined for Aztec, which has no EVM chain id */
  chainId?: bigint;
  /** ZK Stack only: which L1ZkStackBridgeAdapter slot this chain claimed */
  slot?: number;
  /** env vars holding this leg's RPC URL, in priority order */
  rpcEnvVars: string[];
  defaultRpcUrl?: string;
  /** upper bound on an L2->L1 root push becoming provable/consumable on L1 */
  l2ToL1TimeoutMs: number;
}

const AZTEC_DESCRIPTOR: LegDescriptor = {
  key: AZTEC_LEG,
  kind: 'aztec',
  label: 'Aztec Network',
  rpcEnvVars: ['AZTEC_NODE_URL'],
  defaultRpcUrl: 'https://v5.testnet.rpc.aztec-labs.com',
  // Aztec's L2->L1 path waits on epoch proving, historically ~75 min.
  l2ToL1TimeoutMs: 90 * 60 * 1000,
};

function zkStackDescriptor(t: ZkStackTarget): LegDescriptor {
  return {
    key: String(t.chainId),
    kind: 'zkstack',
    label: t.label,
    chainId: BigInt(t.chainId),
    slot: t.slot,
    // SCROLL_RPC_URL is gone; keep a generic per-chain override plus the backend's own
    // env name so a single .env works for both the deploy scripts and the keeper.
    rpcEnvVars: [`L2_RPC_URL_${t.chainId}`, t.rpcEnv],
    defaultRpcUrl: t.viemChain.rpcUrls.default.http[0],
    l2ToL1TimeoutMs: t.l2ToL1TimeoutMs,
  };
}

export const LEGS: LegDescriptor[] = [
  AZTEC_DESCRIPTOR,
  ...ZK_STACK_TARGETS.map(zkStackDescriptor),
];

export const LEG_KEYS: LegKey[] = LEGS.map((l) => l.key);

const BY_KEY = new Map<LegKey, LegDescriptor>(LEGS.map((l) => [l.key, l]));

export function getLeg(key: LegKey): LegDescriptor {
  const leg = BY_KEY.get(key);
  if (!leg) throw new Error(`Unknown leg '${key}'. Known legs: ${LEG_KEYS.join(', ')}`);
  return leg;
}

export function isLeg(key: string): key is LegKey {
  return BY_KEY.has(key);
}

export function zkStackLegs(): LegDescriptor[] {
  return LEGS.filter((l) => l.kind === 'zkstack');
}

export function legRpcUrl(leg: LegDescriptor): string {
  for (const name of leg.rpcEnvVars) {
    const v = process.env[name];
    if (v) return v;
  }
  if (leg.defaultRpcUrl) return leg.defaultRpcUrl;
  throw new Error(
    `RPC URL not configured for leg '${leg.key}' (${leg.label}); set one of ${leg.rpcEnvVars.join(', ')}`,
  );
}

/**
 * Legs slow enough that letting them share a sync cycle would block everyone else.
 *
 * runSyncCycle folds gigaRoot only after all L2->L1 pushes in the cycle, so one slow
 * leg strands every other leg's withdraws behind it. Anything at or above this bound
 * gets isolated into its own cycle. Aztec at 90 min stays in the shared cycle; a ZK
 * Stack chain at 3h+ does not.
 */
export const SLOW_LEG_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function isSlowLeg(key: LegKey): boolean {
  return getLeg(key).l2ToL1TimeoutMs >= SLOW_LEG_THRESHOLD_MS;
}
