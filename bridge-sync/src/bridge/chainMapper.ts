import { ChainConfig, ChainId } from '../types/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

const CHAINS: Record<ChainId, ChainConfig> = {
  '31337': {
    id: '31337',
    name: 'Local Anvil',
    type: 'L1',
    chainId: 31337n,
    rpcUrl: process.env.LOCAL_RPC_URL || 'http://localhost:8545',
    isAztec: false,
  },
  '11155111': {
    id: '11155111',
    name: 'Sepolia Testnet',
    type: 'L1',
    chainId: 11155111n,
    rpcUrl: process.env.SEPOLIA_RPC_URL || '',
    isAztec: false,
  },
  '534351': {
    id: '534351',
    name: 'Scroll Sepolia',
    type: 'L2',
    chainId: 534351n,
    rpcUrl: process.env.SCROLL_RPC_URL || 'https://sepolia-rpc.scroll.io',
    isAztec: false,
  },
  'aztec': {
    id: 'aztec',
    name: 'Aztec Network',
    type: 'Aztec',
    // Default to the current Aztec alpha testnet full node. Override via
    // AZTEC_NODE_URL env if you point at a different testnet/devnet.
    rpcUrl: process.env.AZTEC_NODE_URL || 'https://aztec-alpha-testnet-fullnode.zkv.xyz',
    isAztec: true,
  },
};

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

// Define valid bridge routes
const VALID_ROUTES = new Set([
  '11155111:534351',  // Sepolia -> Scroll
  '11155111:aztec',   // Sepolia -> Aztec
  '534351:11155111',  // Scroll -> Sepolia
  'aztec:11155111',   // Aztec -> Sepolia
  'aztec:534351',     // Aztec -> Scroll (multi-hop via Sepolia L1 hub)
  '534351:aztec',     // Scroll -> Aztec (multi-hop via Sepolia L1 hub)
  '31337:534351',     // Local -> Scroll (for testing)
  '31337:aztec',      // Local -> Aztec (for testing)
  'aztec:31337',      // Aztec -> Local (for testing withdraws)
]);

export function isValidRoute(fromChainId: ChainId, toChainId: ChainId): boolean {
  const route = `${fromChainId}:${toChainId}`;
  return VALID_ROUTES.has(route);
}

export function getSupportedRoutes(): Array<{ from: ChainId; to: ChainId }> {
  return Array.from(VALID_ROUTES).map((route) => {
    const [from, to] = route.split(':');
    return { from, to };
  });
}

// Bridge operation timeouts (in milliseconds)
// These are based on observed bridge completion times
const BRIDGE_TIMEOUTS = {
  scroll: 10800000,     // 3 hours - Scroll L2->L1 requires waiting for finalization
  aztec: 3600000,       // 1 hour - Aztec messages need L1 confirmations
  scrollAztec: 14400000,// 4 hours - multi-hop: aztec leg + scroll messenger
  local: 1800000,       // 30 minutes - Local testing, should be faster
};

const MAX_TIMEOUT = 21600000; // 6 hours - absolute maximum

/**
 * Get the appropriate timeout for a bridge operation based on chains involved
 * 
 * @param fromChainId - Source chain
 * @param toChainId - Destination chain
 * @returns Timeout in milliseconds
 */
export function getBridgeTimeout(fromChainId: ChainId, toChainId: ChainId): number {
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);

  const involvesAztec = fromChain.isAztec || toChain.isAztec;
  const involvesScroll = fromChain.type === 'L2' || toChain.type === 'L2';

  // Multi-hop: aztec + scroll
  if (involvesAztec && involvesScroll) {
    return BRIDGE_TIMEOUTS.scrollAztec;
  }
  if (involvesAztec) {
    return BRIDGE_TIMEOUTS.aztec;
  }
  if (involvesScroll) {
    return BRIDGE_TIMEOUTS.scroll;
  }
  if (fromChainId === '31337' || toChainId === '31337') {
    return BRIDGE_TIMEOUTS.local;
  }
  return BRIDGE_TIMEOUTS.aztec;
}

/**
 * Get human-readable expected duration for a bridge operation
 * 
 * @param fromChainId - Source chain
 * @param toChainId - Destination chain
 * @returns Human-readable duration string
 */
export function getExpectedBridgeDuration(fromChainId: ChainId, toChainId: ChainId): string {
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);

  const involvesAztec = fromChain.isAztec || toChain.isAztec;
  const involvesScroll = fromChain.type === 'L2' || toChain.type === 'L2';

  if (involvesAztec && involvesScroll) {
    return '2-4 hours (multi-hop via L1)';
  }
  if (involvesAztec) {
    return '30 minutes - 1 hour';
  }
  if (involvesScroll) {
    return '2-3 hours';
  }
  if (fromChainId === '31337' || toChainId === '31337') {
    return '15-30 minutes';
  }
  return '30 minutes - 1 hour';
}

export { MAX_TIMEOUT, BRIDGE_TIMEOUTS };
