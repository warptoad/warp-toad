/**
 * Environment Configuration
 *
 * This file provides backwards-compatible exports from the chain registry.
 * New code should import directly from '$lib/config/chains.js' instead.
 *
 * VITE_TEST_MODE=true  -> Local development (Anvil + Aztec Sandbox)
 * VITE_TEST_MODE=false -> Testnet (Sepolia + ZKsync Era Sepolia + Aztec Devnet)
 */

import { anvil } from 'viem/chains';
import type { Chain as ViemChain } from 'viem/chains';
import type { Chain, Token } from '$lib/types/bridge.js';

// Re-export everything from chains.ts
export {
	isTestMode,
	CHAIN_REGISTRY,
	getChain,
	getChainByChainId,
	getEnabledChains,
	getDisabledChains,
	isChainEnabled,
	isEVMChain,
	isAztecChain,
	getEVMChain,
	getAztecChain,
	getViemChain as getViemChainByName,
	getViemChainById,
	getEVMChains,
	getNetworkConfigs,
	getWarpToadAddress,
	getNativeTokenAddress,
	getBridgeAdapterAddress,
	getGigaBridgeAddress,
	SUPPORTED_TOKENS,
	getTokenConfig,
	type ChainRole,
	type EVMChainContracts,
	type AztecChainContracts,
	type EVMChainDefinition,
	type AztecChainDefinition,
	type ChainDefinition,
	type TokenConfig,
} from './chains.js';

import {
	isTestMode,
	CHAIN_REGISTRY,
	getEnabledChains,
	getEVMChain,
	getAztecChain,
	getViemChainById,
	getTokenConfig as getTokenConfigFromChains,
	SUPPORTED_TOKENS,
} from './chains.js';

// ============================================================================
// Legacy Compatibility Exports
// ============================================================================

/**
 * @deprecated Use CHAIN_REGISTRY['Ethereum'] or getEVMChain('Ethereum') instead
 */
export interface ChainConfig {
	chainId: number;
	name: string;
	viemChain: ViemChain;
	rpcUrl: string;
	available: boolean;
}

/**
 * @deprecated Use CHAIN_REGISTRY['Ethereum'] instead
 */
export const L1_CONFIG: ChainConfig = (() => {
	const chain = getEVMChain('Ethereum')!;
	return {
		chainId: chain.chainId,
		name: chain.name,
		viemChain: chain.viemChain,
		rpcUrl: chain.rpcUrl,
		available: chain.enabled,
	};
})();

/**
 * @deprecated Use CHAIN_REGISTRY['ZKsync'] instead
 */
export const L2_SCROLL_CONFIG: ChainConfig | null = (() => {
	const chain = getEVMChain('ZKsync');
	if (!chain || !chain.enabled) return null;
	return {
		chainId: chain.chainId,
		name: chain.name,
		viemChain: chain.viemChain,
		rpcUrl: chain.rpcUrl,
		available: chain.enabled,
	};
})();

/**
 * @deprecated Use getAztecChain('Aztec') instead
 */
export const AZTEC_CONFIG = (() => {
	const chain = getAztecChain('Aztec')!;
	return {
		network: chain.network,
		nodeUrl: chain.nodeUrl,
	} as const;
})();

// ============================================================================
// Legacy Contract Address Exports
// ============================================================================

/**
 * @deprecated Use CHAIN_REGISTRY['Ethereum'].contracts instead
 */
export interface ContractAddresses {
	USDcoin: string;
	L1WarpToad: string;
	L1AztecBridgeAdapter: string;
	L1ScrollBridgeAdapter: string;
	GigaBridge: string;
	L2WarpToad?: string;
	L2ZkStackBridgeAdapter?: string;
}

/**
 * @deprecated Use getEVMChain('Ethereum').contracts instead
 */
export const L1_CONTRACTS: ContractAddresses = (() => {
	const chain = getEVMChain('Ethereum')!;
	return {
		USDcoin: chain.contracts.nativeToken,
		L1WarpToad: chain.contracts.warpToad,
		L1AztecBridgeAdapter: chain.contracts.bridgeAdapter || '',
		L1ScrollBridgeAdapter: '', // Not directly tracked in new system
		GigaBridge: chain.contracts.gigaBridge || '',
	};
})();

/**
 * @deprecated Use getEVMChain('ZKsync').contracts instead
 */
export const L2_SCROLL_CONTRACTS: ContractAddresses | null = (() => {
	const chain = getEVMChain('ZKsync');
	if (!chain || !chain.enabled) return null;
	return {
		USDcoin: chain.contracts.nativeToken,
		L1WarpToad: '',
		L1AztecBridgeAdapter: '',
		L1ScrollBridgeAdapter: '',
		GigaBridge: '',
		L2WarpToad: chain.contracts.warpToad,
		L2ZkStackBridgeAdapter: chain.contracts.bridgeAdapter,
	};
})();

/**
 * @deprecated Use getAztecChain('Aztec').contracts instead
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
 * @deprecated Use getAztecChain('Aztec').contracts instead
 */
export const AZTEC_CONTRACTS: AztecContractAddresses = (() => {
	const chain = getAztecChain('Aztec')!;
	console.log({chain})
	return {
		AztecWarpToad: chain.contracts.warpToad,
		L2AztecBridgeAdapter: chain.contracts.bridgeAdapter,
	};
})();

// ============================================================================
// Legacy Chain Availability
// ============================================================================

/**
 * @deprecated Use getEnabledChains() instead
 */
export const ALL_CHAINS: Chain[] = ['Ethereum', 'ZKsync', 'Aztec'];

/**
 * @deprecated Use getEnabledChains() instead
 */
export const AVAILABLE_CHAINS: Chain[] = getEnabledChains();

/**
 * @deprecated Use isChainEnabled() instead
 */
export function isChainAvailable(chain: Chain): boolean {
	return CHAIN_REGISTRY[chain]?.enabled ?? false;
}

/**
 * @deprecated Use !isChainEnabled() instead
 */
export function isChainDisabled(chain: Chain): boolean {
	const def = CHAIN_REGISTRY[chain];
	return def !== undefined && !def.enabled;
}

// ============================================================================
// Legacy Chain ID Mappings
// ============================================================================

/**
 * @deprecated Use getChainByChainId() instead
 */
export function getChainId(chain: Chain): number | null {
	const def = CHAIN_REGISTRY[chain];
	if (!def) return null;
	if (def.type === 'EVM') return def.chainId;
	return null; // Aztec doesn't have a standard chain ID
}

/**
 * @deprecated Use getChainByChainId() instead
 */
export function getChainFromId(chainId: number): Chain | null {
	for (const [name, def] of Object.entries(CHAIN_REGISTRY)) {
		if (def.type === 'EVM' && def.chainId === chainId) {
			return name as Chain;
		}
	}
	// Legacy anvil ID mapping
	if (chainId === 31337) return 'Ethereum';
	return null;
}

/**
 * @deprecated Use getViemChainById() instead
 */
export function getViemChain(chainId: number): ViemChain | null {
	const chain = getViemChainById(chainId);
	if (chain) return chain;
	// Fallback for anvil
	if (chainId === 31337) return anvil;
	return null;
}

// ============================================================================
// Legacy Contract Address Helpers
// ============================================================================

/**
 * @deprecated Use getEVMChain(getChainByChainId(chainId)).contracts instead
 */
export function getContractAddresses(chainId: number): ContractAddresses | null {
	// Check L1
	const l1 = getEVMChain('Ethereum');
	if (l1 && (l1.chainId === chainId || chainId === 31337)) {
		return L1_CONTRACTS;
	}

	// Check ZKsync Era
	const scroll = getEVMChain('ZKsync');
	if (scroll && scroll.enabled && scroll.chainId === chainId) {
		return L2_SCROLL_CONTRACTS;
	}

	return null;
}

/**
 * @deprecated Use getNativeTokenAddress() instead
 */
export function getTokenAddress(token: Token, chainId: number): string | null {
	const tokenConfig = getTokenConfigFromChains(token);
	if (!tokenConfig) return null;

	// Check L1
	const l1 = getEVMChain('Ethereum');
	if (l1 && (l1.chainId === chainId || chainId === 31337)) {
		return l1.contracts.nativeToken;
	}

	// Check ZKsync Era
	const scroll = getEVMChain('ZKsync');
	if (scroll && scroll.enabled && scroll.chainId === chainId) {
		return scroll.contracts.nativeToken || null;
	}

	return null;
}

// ============================================================================
// Legacy Environment Config Object
// ============================================================================

/**
 * @deprecated Use CHAIN_REGISTRY instead
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
