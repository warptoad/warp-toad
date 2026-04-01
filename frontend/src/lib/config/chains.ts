/**
 * Chain Registry
 *
 * Central configuration for all supported chains.
 * This architecture makes it easy to add new chains in the future.
 *
 * To add a new chain:
 * 1. Add the chain to the Chain type in types/bridge.ts
 * 2. Add a ChainDefinition here with contracts and config
 * 3. Implement chain-specific interactions in utils/[chain]-interactions.ts
 * 4. The rest of the app will automatically pick up the new chain
 */

import { anvil, sepolia, scrollSepolia, type Chain as ViemChain } from 'viem/chains';
import type { Chain } from '$lib/types/bridge.js';

// For test mode, import directly from deployed JSON files
import LocalEvmDeployments from '../../../../backend/ignition/deployments/chain-31337/deployed_addresses.json';
import LocalAztecDeployments from '../../../../backend/scripts/deploy/aztec/aztecDeployments/31337/deployed_addresses.json';

// For testnet mode, import from testnet deployment files
import SepoliaDeployments from '../../../../backend/ignition/deployments/chain-11155111/deployed_addresses.json';
import ScrollSepoliaDeployments from '../../../../backend/ignition/deployments/chain-534351/deployed_addresses.json';
import TestnetAztecDeployments from '../../../../backend/scripts/deploy/aztec/aztecDeployments/11155111/deployed_addresses.json';

// ============================================================================
// Environment Detection
// ============================================================================

export const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

// ============================================================================
// Chain Role Types
// ============================================================================

export type ChainRole = 'L1' | 'L2' | 'Privacy';

// ============================================================================
// Chain Definition Interface
// ============================================================================

export interface EVMChainContracts {
	warpToad: string;
	nativeToken: string;
	bridgeAdapter?: string;
	gigaBridge?: string;
}

export interface AztecChainContracts {
	warpToad: {
		address: string;
		constructorArgs: string[];
		contractAddressSalt: string;
		deployer: string;
	};
	bridgeAdapter: {
		address: string;
		constructorArgs: string[];
		contractAddressSalt: string;
		deployer: string;
	};
}

export interface EVMChainDefinition {
	id: Chain;
	name: string;
	type: 'EVM';
	role: ChainRole;
	chainId: number;
	viemChain: ViemChain;
	rpcUrl: string;
	contracts: EVMChainContracts;
	enabled: boolean;
}

export interface AztecChainDefinition {
	id: Chain;
	name: string;
	type: 'Aztec';
	role: ChainRole;
	nodeUrl: string;
	network: 'sandbox' | 'devnet' | 'testnet';
	contracts: AztecChainContracts;
	enabled: boolean;
}

export type ChainDefinition = EVMChainDefinition | AztecChainDefinition;

// ============================================================================
// Chain Definitions
// ============================================================================

/**
 * Ethereum L1 Chain Definition
 */
const ETHEREUM_CHAIN: EVMChainDefinition = isTestMode
	? {
		id: 'Ethereum',
		name: 'Localhost (Anvil)',
		type: 'EVM',
		role: 'L1',
		chainId: 31337,
		viemChain: anvil,
		rpcUrl: 'http://localhost:8545',
		contracts: {
			warpToad: LocalEvmDeployments['L1WarpToadModule#L1WarpToad'],
			nativeToken: LocalEvmDeployments['TestToken#USDcoin'],
			bridgeAdapter: LocalEvmDeployments['L1InfraModule#L1AztecBridgeAdapter'],
			gigaBridge: LocalEvmDeployments['L1InfraModule#GigaBridge'],
		},
		enabled: true,
	}
	: {
		id: 'Ethereum',
		name: 'Sepolia Testnet',
		type: 'EVM',
		role: 'L1',
		chainId: 11155111,
		viemChain: sepolia,
		rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
		contracts: {
			warpToad: (SepoliaDeployments as Record<string, string>)['L1WarpToadModule#L1WarpToad'],
			nativeToken: (SepoliaDeployments as Record<string, string>)['TestToken#USDcoin'],
			bridgeAdapter: (SepoliaDeployments as Record<string, string>)['L1InfraModule#L1AztecBridgeAdapter'],
			gigaBridge: (SepoliaDeployments as Record<string, string>)['L1InfraModule#GigaBridge'],
		},
		enabled: true,
	};

/**
 * Scroll L2 Chain Definition
 * Only enabled in testnet mode (not local test mode)
 */
const SCROLL_CHAIN: EVMChainDefinition = {
	id: 'Scroll',
	name: 'Scroll Sepolia',
	type: 'EVM',
	role: 'L2',
	chainId: 534351,
	viemChain: scrollSepolia,
	rpcUrl: import.meta.env.VITE_SCROLL_SEPOLIA_RPC_URL || 'https://sepolia-rpc.scroll.io',
	contracts: {
		warpToad: (ScrollSepoliaDeployments as Record<string, string>)['L2ScrollModule#L2WarpToad'],
		nativeToken: (ScrollSepoliaDeployments as Record<string, string>)['TestToken#USDcoin'],
		bridgeAdapter: (ScrollSepoliaDeployments as Record<string, string>)['L2ScrollModule#L2ScrollBridgeAdapter'],
	},
	enabled: !isTestMode, // Only available in testnet mode
};

/**
 * Aztec Chain Definition
 */
const AZTEC_CHAIN: AztecChainDefinition = isTestMode
	? {
		id: 'Aztec',
		name: 'Sandbox',
		type: 'Aztec',
		role: 'Privacy',
		nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL || 'http://localhost:8080',
		network: 'sandbox',
		contracts: {
			warpToad: {
				address: LocalAztecDeployments.AztecWarpToad.address,
				constructorArgs: LocalAztecDeployments.AztecWarpToad.constructorArgs,
				contractAddressSalt: LocalAztecDeployments.AztecWarpToad.salt,
				deployer: LocalAztecDeployments.AztecWarpToad.deployer,
			},
			bridgeAdapter: {
				address: LocalAztecDeployments.L2AztecBridgeAdapter.address,
				constructorArgs: LocalAztecDeployments.L2AztecBridgeAdapter.constructorArgs,
				contractAddressSalt: LocalAztecDeployments.L2AztecBridgeAdapter.salt,
				deployer: LocalAztecDeployments.L2AztecBridgeAdapter.deployer,
			},
		},
		enabled: true,
	}
	: {
		id: 'Aztec',
		name: 'Testnet',
		type: 'Aztec',
		role: 'Privacy',
		nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL || 'https://rpc.testnet.aztec-labs.com',
		network: 'testnet',
		contracts: {
			warpToad: {
				address: TestnetAztecDeployments.AztecWarpToad.address,
				constructorArgs: TestnetAztecDeployments.AztecWarpToad.constructorArgs,
				contractAddressSalt: TestnetAztecDeployments.AztecWarpToad.salt,
				deployer: TestnetAztecDeployments.AztecWarpToad.deployer,
			},
			bridgeAdapter: {
				address: TestnetAztecDeployments.L2AztecBridgeAdapter.address,
				constructorArgs: TestnetAztecDeployments.L2AztecBridgeAdapter.constructorArgs,
				contractAddressSalt: TestnetAztecDeployments.L2AztecBridgeAdapter.salt,
				deployer: TestnetAztecDeployments.L2AztecBridgeAdapter.deployer,
			},
		},
		enabled: true,
	};

// ============================================================================
// Chain Registry
// ============================================================================

/**
 * All chain definitions indexed by chain ID
 */
export const CHAIN_REGISTRY: Record<Chain, ChainDefinition> = {
	Ethereum: ETHEREUM_CHAIN,
	Scroll: SCROLL_CHAIN,
	Aztec: AZTEC_CHAIN,
};

// ============================================================================
// Chain Registry Helper Functions
// ============================================================================

/**
 * Get chain definition by chain name
 */
export function getChain(id: Chain): ChainDefinition {
	return CHAIN_REGISTRY[id];
}

/**
 * Get chain definition by EVM chain ID
 */
export function getChainByChainId(chainId: number): Chain | undefined {
	for (const [name, def] of Object.entries(CHAIN_REGISTRY)) {
		if (def.type === 'EVM' && def.chainId === chainId) {
			return name as Chain;
		}
	}
	return undefined;
}

/**
 * Get all enabled chains
 */
export function getEnabledChains(): Chain[] {
	return (Object.keys(CHAIN_REGISTRY) as Chain[]).filter((id) => CHAIN_REGISTRY[id].enabled);
}

/**
 * Get all disabled chains (for showing greyed out in UI)
 */
export function getDisabledChains(): Chain[] {
	return (Object.keys(CHAIN_REGISTRY) as Chain[]).filter((id) => !CHAIN_REGISTRY[id].enabled);
}

/**
 * Check if a chain is enabled
 */
export function isChainEnabled(chain: Chain): boolean {
	return CHAIN_REGISTRY[chain]?.enabled ?? false;
}

/**
 * Check if a chain is an EVM chain
 */
export function isEVMChain(chain: Chain): chain is Chain {
	return CHAIN_REGISTRY[chain]?.type === 'EVM';
}

/**
 * Check if a chain is Aztec
 */
export function isAztecChain(chain: Chain): boolean {
	return CHAIN_REGISTRY[chain]?.type === 'Aztec';
}

/**
 * Get EVM chain definition (type-safe)
 */
export function getEVMChain(chain: Chain): EVMChainDefinition | undefined {
	const def = CHAIN_REGISTRY[chain];
	return def?.type === 'EVM' ? def : undefined;
}

/**
 * Get Aztec chain definition (type-safe)
 */
export function getAztecChain(chain: Chain): AztecChainDefinition | undefined {
	const def = CHAIN_REGISTRY[chain];
	return def?.type === 'Aztec' ? def : undefined;
}

/**
 * Get viem chain config for an EVM chain
 */
export function getViemChain(chain: Chain): ViemChain | undefined {
	const def = getEVMChain(chain);
	return def?.viemChain;
}

/**
 * Get viem chain config by chain ID
 */
export function getViemChainById(chainId: number): ViemChain | undefined {
	const chainName = getChainByChainId(chainId);
	if (!chainName) return undefined;
	return getViemChain(chainName);
}

/**
 * Get all EVM chains (for network configs)
 */
export function getEVMChains(): EVMChainDefinition[] {
	return Object.values(CHAIN_REGISTRY).filter((def): def is EVMChainDefinition => def.type === 'EVM' && def.enabled);
}

/**
 * Get network configs for viem (Record<chainName, ViemChain>)
 */
export function getNetworkConfigs(): Record<string, ViemChain> {
	const configs: Record<string, ViemChain> = {};
	for (const chain of getEVMChains()) {
		configs[chain.id] = chain.viemChain;
	}
	return configs;
}

/**
 * Get WarpToad contract address for a chain
 */
export function getWarpToadAddress(chain: Chain): string | undefined {
	const def = CHAIN_REGISTRY[chain];
	if (!def) return undefined;

	if (def.type === 'EVM') {
		return def.contracts.warpToad;
	} else {
		return def.contracts.warpToad.address;
	}
}

/**
 * Get native token address for an EVM chain
 */
export function getNativeTokenAddress(chain: Chain): string | undefined {
	const def = getEVMChain(chain);
	return def?.contracts.nativeToken;
}

/**
 * Get bridge adapter address for a chain
 */
export function getBridgeAdapterAddress(chain: Chain): string | undefined {
	const def = CHAIN_REGISTRY[chain];
	if (!def) return undefined;

	if (def.type === 'EVM') {
		return def.contracts.bridgeAdapter;
	} else {
		return def.contracts.bridgeAdapter.address;
	}
}

/**
 * Get GigaBridge address (only on L1)
 */
export function getGigaBridgeAddress(): string | undefined {
	const l1 = getEVMChain('Ethereum');
	return l1?.contracts.gigaBridge;
}

// ============================================================================
// Token Configuration
// ============================================================================

export interface TokenConfig {
	symbol: string;
	name: string;
	decimals: number;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
	{
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
	},
];

/**
 * Get token config by symbol
 */
export function getTokenConfig(symbol: string): TokenConfig | undefined {
	return SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
}
