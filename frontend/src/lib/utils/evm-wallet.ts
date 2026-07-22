import { createWalletClient, custom, type WalletClient, type Chain as ViemChain, http, createPublicClient } from 'viem';
import { anvil, mainnet, zksyncSepoliaTestnet } from 'viem/chains';
import type { Chain } from '$lib/types/bridge.js';
import { L1_CONFIG, L2_SCROLL_CONFIG, getNetworkConfigs, isTestMode } from '$lib/config/environment.js';

// Network configurations from environment
export const NETWORKS: Record<string, ViemChain> = getNetworkConfigs();

// Chain ID to Chain name mapping. Use Partial because TS narrows the spread
// from a conditional `... ? {} : {}` to `Chain | undefined`.
export const CHAIN_ID_TO_NAME: Partial<Record<number, Chain>> = {
	[L1_CONFIG.chainId]: 'Ethereum',
	// Always include anvil for backwards compatibility in test mode
	...(isTestMode ? { [anvil.id]: 'Ethereum' } : {}),
	// Include Scroll if available
	...(L2_SCROLL_CONFIG ? { [L2_SCROLL_CONFIG.chainId]: 'ZKsync' } : {}),
};

export interface EVMWalletState {
	address: string | null;
	chainId: number | null;
	isConnecting: boolean;
	error: string | null;
}

export interface EVMProvider {
	request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	on?: (event: string, handler: (...args: unknown[]) => void) => void;
	removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
	isMetaMask?: boolean;
}

declare global {
	interface Window {
		ethereum?: EVMProvider;
	}
}

/**
 * Check if an EVM wallet provider is available
 */
export function isWalletAvailable(): boolean {
	return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Get the wallet provider
 */
export function getProvider(): EVMProvider | null {
	if (!isWalletAvailable()) return null;
	return window.ethereum!;
}

/**
 * Connect to the EVM wallet
 */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
	const provider = getProvider();
	if (!provider) {
		throw new Error('No EVM wallet found. Please install MetaMask or another Web3 wallet.');
	}

	try {
		// Request account access
		const accounts = (await provider.request({
			method: 'eth_requestAccounts'
		})) as string[];

		if (!accounts || accounts.length === 0) {
			throw new Error('No accounts found. Please unlock your wallet.');
		}

		// Get current chain ID
		const chainId = (await provider.request({
			method: 'eth_chainId'
		})) as string;

		return {
			address: accounts[0],
			chainId: parseInt(chainId, 16)
		};
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'code' in error) {
			const err = error as { code: number; message: string };
			if (err.code === 4001) {
				throw new Error('Connection rejected. Please approve the connection request.');
			}
		}
		throw error;
	}
}

/**
 * Get current connected accounts without prompting
 */
export async function getAccounts(): Promise<string[]> {
	const provider = getProvider();
	if (!provider) return [];

	try {
		const accounts = (await provider.request({
			method: 'eth_accounts'
		})) as string[];
		return accounts;
	} catch (error) {
		console.error('Failed to get accounts:', error);
		return [];
	}
}

/**
 * Get current chain ID
 */
export async function getChainId(): Promise<number | null> {
	const provider = getProvider();
	if (!provider) return null;

	try {
		const chainId = (await provider.request({
			method: 'eth_chainId'
		})) as string;
		return parseInt(chainId, 16);
	} catch (error) {
		console.error('Failed to get chain ID:', error);
		return null;
	}
}

/**
 * Switch to a specific network
 */
export async function switchNetwork(chain: Chain): Promise<boolean> {
	const provider = getProvider();
	if (!provider) {
		throw new Error('No wallet provider found');
	}

	const network = NETWORKS[chain];
	if (!network) {
		throw new Error(`Network ${chain} not configured`);
	}

	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: `0x${network.id.toString(16)}` }]
		});
		return true;
	} catch (error: unknown) {
		// If the chain hasn't been added to MetaMask
		if (error && typeof error === 'object' && 'code' in error) {
			const err = error as { code: number };
			if (err.code === 4902) {
				try {
					await addNetwork(chain);
					return true;
				} catch (addError) {
					console.error('Failed to add network:', addError);
					throw new Error(`Failed to add ${chain} network to your wallet`);
				}
			}
		}
		throw error;
	}
}

/**
 * Add a network to the wallet
 */
async function addNetwork(chain: Chain): Promise<void> {
	const provider = getProvider();
	if (!provider) {
		throw new Error('No wallet provider found');
	}

	const network = NETWORKS[chain];
	if (!network) {
		throw new Error(`Network ${chain} not configured`);
	}

	await provider.request({
		method: 'wallet_addEthereumChain',
		params: [
			{
				chainId: `0x${network.id.toString(16)}`,
				chainName: network.name,
				nativeCurrency: network.nativeCurrency,
				rpcUrls: network.rpcUrls.default.http,
				blockExplorerUrls: network.blockExplorers?.default?.url
					? [network.blockExplorers.default.url]
					: undefined
			}
		]
	});
}

/**
 * Create a wallet client for signing transactions
 */
export function createClient(chainId: number): WalletClient | null {
	const provider = getProvider();
	if (!provider) return null;

	// Find the chain configuration
	const chain = Object.values(NETWORKS).find((n) => n.id === chainId);
	if (!chain) return null;

	return createWalletClient({
		chain,
		transport: custom(provider)
	});
}


/**
 * Listen to account changes
 */
export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
	const provider = getProvider();
	if (!provider?.on) return () => { };

	const handler = (accounts: unknown) => {
		callback(accounts as string[]);
	};

	provider.on('accountsChanged', handler);

	return () => {
		provider.removeListener?.('accountsChanged', handler);
	};
}

/**
 * Listen to chain changes
 */
export function onChainChanged(callback: (chainId: number) => void): () => void {
	const provider = getProvider();
	if (!provider?.on) return () => { };

	const handler = (chainId: unknown) => {
		// Chain ID is returned as hex string
		const id = typeof chainId === 'string' ? parseInt(chainId, 16) : (chainId as number);
		callback(id);
	};

	provider.on('chainChanged', handler);

	return () => {
		provider.removeListener?.('chainChanged', handler);
	};
}

/**
 * Disconnect wallet (no standard way, just clear state)
 */
export function disconnectWallet(): void {
	// Note: There's no standard way to programmatically disconnect from MetaMask
	// Users need to disconnect from their wallet extension
	// We just clear our local state
}
