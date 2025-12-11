/**
 * Environment Configuration
 * 
 * Central configuration file for environment-dependent settings.
 * 
 * VITE_TEST_MODE=true  -> Local development (Anvil + Aztec Sandbox)
 * VITE_TEST_MODE=false -> Testnet (Sepolia + Scroll Sepolia + Aztec Devnet)
 */

import { anvil, sepolia, scrollSepolia, type Chain as ViemChain } from 'viem/chains';
import type { Chain, Token } from '$lib/types/bridge.js';

// For test mode, import directly from deployed JSON files (always up-to-date after redeploys)
import LocalAztecDeployments from '../../../../backend/scripts/deploy/aztec/aztecDeployments/31337/deployed_addresses.json';

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Test mode flag - determines which environment configuration to use
 * true = local development (anvil + aztec sandbox)
 * false = testnet (sepolia + scroll sepolia + aztec devnet)
 */
export const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

// ============================================================================
// Chain Configuration
// ============================================================================

export interface ChainConfig {
	chainId: number;
	name: string;
	viemChain: ViemChain;
	rpcUrl: string;
	available: boolean; // Whether this chain is available in current mode
}

/**
 * L1 chain configuration
 */
export const L1_CONFIG: ChainConfig = isTestMode
	? {
		chainId: 31337,
		name: 'Localhost (Anvil)',
		viemChain: anvil,
		rpcUrl: 'http://localhost:8545',
		available: true,
	}
	: {
		chainId: 11155111,
		name: 'Sepolia Testnet',
		viemChain: sepolia,
		rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
		available: true,
	};

/**
 * L2 (Scroll) chain configuration
 * Only available in testnet mode
 */
export const L2_SCROLL_CONFIG: ChainConfig | null = isTestMode
	? null // Scroll not available in test mode
	: {
		chainId: 534351,
		name: 'Scroll Sepolia',
		viemChain: scrollSepolia,
		rpcUrl: 'https://sepolia-rpc.scroll.io',
		available: true,
	};

/**
 * Aztec network configuration
 */
export const AZTEC_CONFIG = {
	network: isTestMode ? 'sandbox' : 'devnet',
	nodeUrl: isTestMode
		? (import.meta.env.VITE_AZTEC_NODE_URL || 'http://localhost:8080')
		: 'https://devnet.aztec-labs.com',
} as const;

// ============================================================================
// Contract Addresses
// ============================================================================

export interface ContractAddresses {
	// L1 Contracts
	USDcoin: string;
	L1WarpToad: string;
	L1AztecBridgeAdapter: string;
	L1ScrollBridgeAdapter: string;
	GigaBridge: string;
	// L2 Scroll Contracts (testnet only)
	L2WarpToad?: string;
	L2ScrollBridgeAdapter?: string;
}

/**
 * Full Aztec contract deployment info (needed for contract instantiation)
 */
export interface AztecContractDeployment {
	address: string;
	constructorArgs: string[];
	contractAddressSalt: string;
	deployer: string;
}

export interface AztecContractAddresses {
	AztecWarpToad: AztecContractDeployment;
	L2AztecBridgeAdapter: AztecContractDeployment;
}

/**
 * L1 contract addresses based on environment
 */
export const L1_CONTRACTS: ContractAddresses = isTestMode
	? {
		// Anvil (localhost) - chain 31337
		USDcoin: '0x95401dc811bb5740090279Ba06cfA8fcF6113778',
		L1WarpToad: '0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf',
		L1AztecBridgeAdapter: '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF',
		L1ScrollBridgeAdapter: '0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf',
		GigaBridge: '0x9d4454B023096f34B160D6B654540c56A1F81688',
	}
	: {
		// Sepolia Testnet - chain 11155111
		USDcoin: '0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413',
		L1WarpToad: '0x5BFA9A4f358470774eC2997623efA97ecbf32263',
		L1AztecBridgeAdapter: '0x056B0485c1A76bf0A158e7DCd3D19e4d31f0CC5b',
		L1ScrollBridgeAdapter: '0x1c9b9Fdfb57fDdF18588e0247F7Dc786d9eA3D92',
		GigaBridge: '0xeae835289f34dE789C370929d33458919c106a22',
	};

/**
 * L2 Scroll contract addresses (testnet only)
 */
export const L2_SCROLL_CONTRACTS: ContractAddresses | null = isTestMode
	? null
	: {
		USDcoin: '', // No USDcoin directly on Scroll (bridged via WarpToad)
		L1WarpToad: '', // Reference to L1
		L1AztecBridgeAdapter: '', // Reference to L1
		L1ScrollBridgeAdapter: '0x1c9b9Fdfb57fDdF18588e0247F7Dc786d9eA3D92',
		GigaBridge: '', // Reference to L1
		L2WarpToad: '0x0f7776D959e3B410eb84736527F863c631259C9F',
		L2ScrollBridgeAdapter: '0x15d38553738792B6E97Dc06E4eCf9f335C9cDD80',
	};

/**
 * Aztec contract deployment info based on environment
 * 
 * For TEST MODE: Dynamically imported from deployed_addresses.json
 *   - This ensures addresses are always up-to-date after local redeployments
 * 
 * For TESTNET MODE: Hardcoded addresses (more stable, less frequent changes)
 */
export const AZTEC_CONTRACTS: AztecContractAddresses = isTestMode
	? {
		// Aztec Sandbox (local) - DYNAMIC from JSON file
		AztecWarpToad: {
			address: LocalAztecDeployments.AztecWarpToad.address,
			constructorArgs: LocalAztecDeployments.AztecWarpToad.constructorArgs,
			contractAddressSalt: LocalAztecDeployments.AztecWarpToad.contractAddressSalt,
			deployer: LocalAztecDeployments.AztecWarpToad.deployer,
		},
		L2AztecBridgeAdapter: {
			address: LocalAztecDeployments.L2AztecBridgeAdapter.address,
			constructorArgs: LocalAztecDeployments.L2AztecBridgeAdapter.constructorArgs,
			contractAddressSalt: LocalAztecDeployments.L2AztecBridgeAdapter.contractAddressSalt,
			deployer: LocalAztecDeployments.L2AztecBridgeAdapter.deployer,
		},
	}
	: {
		// Aztec Devnet - HARDCODED (linked to Sepolia, chain 11155111)
		AztecWarpToad: {
			address: '0x2938a934bac6c4705ab0ac7fe3be249f5bd7a0feb92368b3773a02295022b6d1',
			constructorArgs: [
				'0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413',
				'wrapped-warptoad-USD Coin',
				'wrptd-USDC',
				'6'
			],
			contractAddressSalt: '0x07aa40a60174428b7d2acc4041f21d4aeddfa1dac11df78e6a7dec187ed963df',
			deployer: '0x11deabd59b872d17c737b66f61d332230f341e774c6b5d3762f46a74536f947f',
		},
		L2AztecBridgeAdapter: {
			address: '0x16f90325fa9e9445cdd52dc910724ee2ffe3fd2ce0852ea3d680d0f5e2d22f90',
			constructorArgs: ['0x056B0485c1A76bf0A158e7DCd3D19e4d31f0CC5b'],
			contractAddressSalt: '0x25205f537d449e052dbaa15b7916c7bc8355735c5759e99dbcbeaa358c43d2fc',
			deployer: '0x11deabd59b872d17c737b66f61d332230f341e774c6b5d3762f46a74536f947f',
		},
	};

// ============================================================================
// Token Configuration
// ============================================================================

export interface TokenConfig {
	symbol: Token;
	name: string;
	decimals: number;
	addresses: {
		l1: string;
		scrollL2?: string;
		aztec?: string; // Aztec uses wrapped version
	};
}

/**
 * Supported tokens
 * Currently only USDC is supported
 */
export const SUPPORTED_TOKENS: TokenConfig[] = [
	{
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
		addresses: {
			l1: L1_CONTRACTS.USDcoin,
			// Note: On Aztec, users receive wrapped USDC via the WarpToad contract
		},
	},
];

/**
 * Get token config by symbol
 */
export function getTokenConfig(symbol: Token): TokenConfig | undefined {
	return SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
}

// ============================================================================
// Chain Availability
// ============================================================================

/**
 * All possible chains in the app
 */
export const ALL_CHAINS: Chain[] = ['Ethereum', 'Scroll', 'Aztec'];

/**
 * Chains available in current environment mode
 */
export const AVAILABLE_CHAINS: Chain[] = isTestMode
	? ['Ethereum', 'Aztec']
	: ['Ethereum', 'Scroll', 'Aztec'];

/**
 * Check if a chain is available in current mode
 */
export function isChainAvailable(chain: Chain): boolean {
	return AVAILABLE_CHAINS.includes(chain);
}

/**
 * Check if a chain is disabled (exists but not available in current mode)
 */
export function isChainDisabled(chain: Chain): boolean {
	return ALL_CHAINS.includes(chain) && !AVAILABLE_CHAINS.includes(chain);
}

// ============================================================================
// Chain ID Mappings
// ============================================================================

/**
 * Get chain ID for a given Chain type
 */
export function getChainId(chain: Chain): number | null {
	switch (chain) {
		case 'Ethereum':
			return L1_CONFIG.chainId;
		case 'Scroll':
			return L2_SCROLL_CONFIG?.chainId ?? null;
		case 'Aztec':
			// Aztec doesn't have a standard chain ID - handled separately
			return null;
		default:
			return null;
	}
}

/**
 * Get Chain name from chain ID
 */
export function getChainFromId(chainId: number): Chain | null {
	if (chainId === L1_CONFIG.chainId) return 'Ethereum';
	if (L2_SCROLL_CONFIG && chainId === L2_SCROLL_CONFIG.chainId) return 'Scroll';
	// Legacy anvil ID mapping
	if (chainId === 31337) return 'Ethereum';
	return null;
}

/**
 * Get viem chain config for a chain ID
 */
export function getViemChain(chainId: number): ViemChain | null {
	if (chainId === L1_CONFIG.chainId) return L1_CONFIG.viemChain;
	if (L2_SCROLL_CONFIG && chainId === L2_SCROLL_CONFIG.chainId) return L2_SCROLL_CONFIG.viemChain;
	// Fallback for anvil
	if (chainId === 31337) return anvil;
	return null;
}

// ============================================================================
// Network Configuration for Viem
// ============================================================================

/**
 * Get viem chain configs for EVM networks
 */
export function getNetworkConfigs(): Record<string, ViemChain> {
	const configs: Record<string, ViemChain> = {
		Ethereum: L1_CONFIG.viemChain,
	};

	if (L2_SCROLL_CONFIG) {
		configs.Scroll = L2_SCROLL_CONFIG.viemChain;
	}

	return configs;
}

// ============================================================================
// Contract Address Helpers
// ============================================================================

/**
 * Get contract addresses for a chain ID
 */
export function getContractAddresses(chainId: number): ContractAddresses | null {
	if (chainId === L1_CONFIG.chainId || chainId === 31337) {
		return L1_CONTRACTS;
	}
	if (L2_SCROLL_CONFIG && chainId === L2_SCROLL_CONFIG.chainId) {
		return L2_SCROLL_CONTRACTS;
	}
	return null;
}

/**
 * Get token address for a chain
 */
export function getTokenAddress(token: Token, chainId: number): string | null {
	const tokenConfig = getTokenConfig(token);
	if (!tokenConfig) return null;

	if (chainId === L1_CONFIG.chainId || chainId === 31337) {
		return tokenConfig.addresses.l1;
	}
	if (L2_SCROLL_CONFIG && chainId === L2_SCROLL_CONFIG.chainId) {
		return tokenConfig.addresses.scrollL2 ?? null;
	}
	return null;
}

// ============================================================================
// Exports Summary
// ============================================================================

/**
 * Main environment configuration object
 * Use this for quick access to all config values
 */
export const ENV_CONFIG = {
	isTestMode,
	l1: L1_CONFIG,
	l2Scroll: L2_SCROLL_CONFIG,
	aztec: AZTEC_CONFIG,
	contracts: {
		l1: L1_CONTRACTS,
		l2Scroll: L2_SCROLL_CONTRACTS,
		aztec: AZTEC_CONTRACTS,
	},
	tokens: SUPPORTED_TOKENS,
	availableChains: AVAILABLE_CHAINS,
} as const;
