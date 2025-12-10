/**
 * Balance Store
 * 
 * Manages token balances for EVM and Aztec chains with manual refresh capability.
 * Call `balanceStore.refresh()` after transactions to update displayed balances.
 */

import type { Chain, Token } from '$lib/types/bridge.js';
import { createPublicClient, http, type Chain as ViemChain } from 'viem';
import { anvil, sepolia, scroll, scrollSepolia } from 'viem/chains';
import { walletStore } from './wallets.svelte';
import { getWalletInstance } from '$lib/utils/aztec-wallet';
import { getAztecWarpToadBalance, getAztecWarpToadDecimals } from '$lib/utils/aztec-interactions';
import { USDcoinAbi } from '$lib/contracts/abis';

// Token contract addresses per chain
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
	USDC: {
		31337: '0x95401dc811bb5740090279Ba06cfA8fcF6113778', // Anvil/localhost
		11155111: '0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413', // Sepolia
	}
};

// Chain configs for viem
const CHAIN_CONFIGS: Record<number, ViemChain> = {
	31337: anvil,
	1: anvil, // Mainnet - fallback to anvil config for now
	11155111: sepolia,
	534351: scrollSepolia,
	534352: scroll,
};

/**
 * Get the appropriate viem chain config for a chain ID
 */
function getChainConfig(chainId: number): ViemChain {
	return CHAIN_CONFIGS[chainId] || anvil;
}

/**
 * Get token address for a chain
 */
function getTokenAddress(token: Token, chainId: number): string | null {
	return TOKEN_ADDRESSES[token]?.[chainId] || null;
}

class BalanceStore {
	// Reactive state
	private _evmBalance = $state<string>('0.00');
	private _aztecBalance = $state<string>('0.00');
	private _isLoadingEvm = $state<boolean>(false);
	private _isLoadingAztec = $state<boolean>(false);
	private _lastRefresh = $state<number>(0);
	private _selectedToken = $state<Token>('USDC');

	// Getters
	get evmBalance(): string {
		return this._evmBalance;
	}

	get aztecBalance(): string {
		return this._aztecBalance;
	}

	get isLoadingEvm(): boolean {
		return this._isLoadingEvm;
	}

	get isLoadingAztec(): boolean {
		return this._isLoadingAztec;
	}

	get isLoading(): boolean {
		return this._isLoadingEvm || this._isLoadingAztec;
	}

	get lastRefresh(): number {
		return this._lastRefresh;
	}

	/**
	 * Get balance for a specific chain
	 */
	getBalance(chain: Chain): string {
		if (chain === 'Aztec') {
			return this._aztecBalance;
		}
		return this._evmBalance;
	}

	/**
	 * Check if loading for a specific chain
	 */
	isChainLoading(chain: Chain): boolean {
		if (chain === 'Aztec') {
			return this._isLoadingAztec;
		}
		return this._isLoadingEvm;
	}

	/**
	 * Set the token to fetch balances for
	 */
	setToken(token: Token): void {
		this._selectedToken = token;
	}

	/**
	 * Refresh all balances
	 */
	async refresh(): Promise<void> {
		console.log('[BalanceStore] Refreshing all balances...');
		await Promise.all([
			this.refreshEvmBalance(),
			this.refreshAztecBalance()
		]);
		this._lastRefresh = Date.now();
		console.log('[BalanceStore] Refresh complete');
	}

	/**
	 * Refresh EVM balance only
	 */
	async refreshEvmBalance(): Promise<void> {
		const evmAddress = walletStore.wallets.evm;
		const chainId = walletStore.chainId;

		if (!evmAddress) {
			this._evmBalance = 'Connect wallet';
			return;
		}

		if (!chainId) {
			this._evmBalance = '0.00';
			return;
		}

		const tokenAddress = getTokenAddress(this._selectedToken, chainId);
		if (!tokenAddress) {
			console.log(`[BalanceStore] No token address for ${this._selectedToken} on chain ${chainId}`);
			this._evmBalance = '0.00';
			return;
		}

		this._isLoadingEvm = true;

		try {
			const chainConfig = getChainConfig(chainId);
			const publicClient = createPublicClient({
				chain: chainConfig,
				transport: http()
			});

			const [decimals, rawBalance] = await Promise.all([
				publicClient.readContract({
					address: tokenAddress as `0x${string}`,
					abi: USDcoinAbi,
					functionName: 'decimals'
				}),
				publicClient.readContract({
					address: tokenAddress as `0x${string}`,
					abi: USDcoinAbi,
					functionName: 'balanceOf',
					args: [evmAddress as `0x${string}`]
				})
			]);

			const balance = Number(rawBalance) / 10 ** Number(decimals);
			this._evmBalance = balance.toString();
			console.log(`[BalanceStore] EVM balance: ${this._evmBalance}`);
		} catch (error) {
			console.error('[BalanceStore] Failed to fetch EVM balance:', error);
			// Keep previous balance on error
		} finally {
			this._isLoadingEvm = false;
		}
	}

	/**
	 * Refresh Aztec balance only
	 */
	async refreshAztecBalance(): Promise<void> {
		const aztecWallet = getWalletInstance();

		if (!aztecWallet) {
			this._aztecBalance = 'Connect wallet';
			return;
		}

		this._isLoadingAztec = true;

		try {
			const [balance, decimals] = await Promise.all([
				getAztecWarpToadBalance(aztecWallet),
				getAztecWarpToadDecimals(aztecWallet)
			]);

			const formatted = Number(balance) / 10 ** decimals;
			this._aztecBalance = formatted.toString();
			console.log(`[BalanceStore] Aztec balance: ${this._aztecBalance}`);
		} catch (error) {
			console.error('[BalanceStore] Failed to fetch Aztec balance:', error);
			// Keep previous balance on error
		} finally {
			this._isLoadingAztec = false;
		}
	}

	/**
	 * Initialize balances (call on app mount or wallet connection)
	 */
	async initialize(): Promise<void> {
		await this.refresh();
	}
}

export const balanceStore = new BalanceStore();
