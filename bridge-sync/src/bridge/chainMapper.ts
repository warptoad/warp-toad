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
    rpcUrl: process.env.AZTEC_NODE_URL || 'https://next.devnet.aztec-labs.com',
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
  '31337:534351',     // Local -> Scroll (for testing)
  '31337:aztec',      // Local -> Aztec (for testing)
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
  scroll: 10800000,  // 3 hours - Scroll L2->L1 requires waiting for finalization
  aztec: 3600000,    // 1 hour - Aztec messages need L1 confirmations
  local: 1800000,    // 30 minutes - Local testing, should be faster
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
  
  // If either chain is Aztec, use Aztec timeout
  if (fromChain.isAztec || toChain.isAztec) {
    return BRIDGE_TIMEOUTS.aztec;
  }
  
  // If either chain is Scroll (L2), use Scroll timeout (longest)
  if (fromChain.type === 'L2' || toChain.type === 'L2') {
    return BRIDGE_TIMEOUTS.scroll;
  }
  
  // Local testing
  if (fromChainId === '31337' || toChainId === '31337') {
    return BRIDGE_TIMEOUTS.local;
  }
  
  // Default to Aztec timeout (safer)
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
  
  // Aztec bridges
  if (fromChain.isAztec || toChain.isAztec) {
    return '30 minutes - 1 hour';
  }
  
  // Scroll bridges
  if (fromChain.type === 'L2' || toChain.type === 'L2') {
    return '2-3 hours';
  }
  
  // Local
  if (fromChainId === '31337' || toChainId === '31337') {
    return '15-30 minutes';
  }
  
  return '30 minutes - 1 hour';
}

export { MAX_TIMEOUT, BRIDGE_TIMEOUTS };
