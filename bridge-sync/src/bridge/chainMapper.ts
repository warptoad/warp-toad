import { ChainConfig, ChainId } from '../types/index.js';
import { LEGS, getLeg, isLeg, legRpcUrl, type LegDescriptor } from './legRegistry.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * L1 hubs. Everything else (the L2 legs) is generated from the leg registry, so
 * adding an L2 does not mean editing this file.
 */
const L1_CHAINS: ChainConfig[] = [
  {
    id: '31337',
    name: 'Local Anvil',
    type: 'L1',
    chainId: 31337n,
    rpcUrl: process.env.LOCAL_RPC_URL || 'http://localhost:8545',
    isAztec: false,
  },
  {
    id: '11155111',
    name: 'Sepolia Testnet',
    type: 'L1',
    chainId: 11155111n,
    rpcUrl: process.env.SEPOLIA_RPC_URL || '',
    isAztec: false,
  },
];

const L1_CHAIN_IDS = L1_CHAINS.map((c) => c.id);

function legToChainConfig(leg: LegDescriptor): ChainConfig {
  let rpcUrl = '';
  try {
    rpcUrl = legRpcUrl(leg);
  } catch {
    // Leave blank; getChainConfig reports it with the same message as before.
  }
  return {
    id: leg.key,
    name: leg.label,
    type: leg.kind === 'aztec' ? 'Aztec' : 'L2',
    chainId: leg.chainId,
    rpcUrl,
    isAztec: leg.kind === 'aztec',
  };
}

const CHAINS: Record<ChainId, ChainConfig> = Object.fromEntries(
  [...L1_CHAINS, ...LEGS.map(legToChainConfig)].map((c) => [c.id, c]),
);

export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAINS[chainId];
  if (!config) {
    throw new Error(`Unknown chain ID: ${chainId}`);
  }
  if (!config.rpcUrl) {
    throw new Error(`RPC URL not configured for chain: ${chainId}`);
  }
  return config;
}

export function isValidChainId(chainId: string): chainId is ChainId {
  return chainId in CHAINS;
}

export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAINS);
}

/**
 * Valid routes, generated rather than enumerated.
 *
 * Every leg can bridge to and from every L1 hub, and legs can bridge to each other
 * multi-hop via the L1 hub. L1-to-L1 is not a bridge. This replaces a hand-written
 * O(n^2) list that had to be extended by hand for each new chain (and which was
 * missing entries: Sepolia->Scroll existed but Local->Aztec-style symmetry did not).
 */
function buildValidRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const leg of LEGS) {
    for (const l1 of L1_CHAIN_IDS) {
      routes.add(`${l1}:${leg.key}`);
      routes.add(`${leg.key}:${l1}`);
    }
    for (const other of LEGS) {
      if (other.key !== leg.key) routes.add(`${leg.key}:${other.key}`);
    }
  }
  return routes;
}

const VALID_ROUTES = buildValidRoutes();

export function isValidRoute(fromChainId: ChainId, toChainId: ChainId): boolean {
  return VALID_ROUTES.has(`${fromChainId}:${toChainId}`);
}

export function getSupportedRoutes(): Array<{ from: ChainId; to: ChainId }> {
  return Array.from(VALID_ROUTES).map((route) => {
    const [from, to] = route.split(':');
    return { from, to };
  });
}

const MAX_TIMEOUT = 21600000; // 6 hours - absolute maximum
const LOCAL_TIMEOUT = 1800000; // 30 minutes - local testing should be faster

/**
 * Timeout for a bridge operation, derived from the legs involved.
 *
 * A single per-chain-family constant was wrong once ZK Stack entered the picture:
 * Era Sepolia finalizes in about 2 hours but a low-traffic chain like Abstract seals
 * batches on a ~8h timeout, so one shared number either stalls the slow chain or makes
 * the fast one look hung. Each leg carries its own bound in the registry.
 *
 * Multi-hop (leg → leg) sums both sides: the source leg's L2→L1 push, then the
 * destination leg's L1→L2 dispatch.
 */
export function getBridgeTimeout(fromChainId: ChainId, toChainId: ChainId): number {
  if (fromChainId === '31337' || toChainId === '31337') return LOCAL_TIMEOUT;

  const fromLeg = isLeg(fromChainId) ? getLeg(fromChainId) : undefined;
  const toLeg = isLeg(toChainId) ? getLeg(toChainId) : undefined;

  // The L2->L1 push is the slow half; an L1->L2 dispatch is minutes.
  const L1_TO_L2_ALLOWANCE_MS = 60 * 60 * 1000;

  let total = 0;
  if (fromLeg) total += fromLeg.l2ToL1TimeoutMs;
  if (toLeg) total += L1_TO_L2_ALLOWANCE_MS;
  if (total === 0) total = L1_TO_L2_ALLOWANCE_MS;

  return Math.min(total, MAX_TIMEOUT);
}

const fmt = (ms: number): string => {
  const mins = Math.round(ms / 60000);
  if (mins < 90) return `${mins} minutes`;
  const hours = ms / 3600000;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
};

export function getExpectedBridgeDuration(fromChainId: ChainId, toChainId: ChainId): string {
  const ms = getBridgeTimeout(fromChainId, toChainId);
  const multiHop = isLeg(fromChainId) && isLeg(toChainId);
  return multiHop ? `up to ${fmt(ms)} (multi-hop via L1)` : `up to ${fmt(ms)}`;
}

export { MAX_TIMEOUT };
