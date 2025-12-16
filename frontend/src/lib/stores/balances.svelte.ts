/**
 * Balance Store
 *
 * Manages token balances for all supported chains with manual refresh capability.
 * Call `balanceStore.refresh()` after transactions to update displayed balances.
 *
 * Supports:
 * - Ethereum L1 (native token balance)
 * - Scroll L2 (wrapped token balance from L2WarpToad)
 * - Aztec (wrapped token balance from AztecWarpToad)
 */

import type { Chain, Token } from '$lib/types/bridge.js';
import { createPublicClient, http, type Chain as ViemChain } from 'viem';
import { walletStore } from './wallets.svelte';
import { getWalletInstance } from '$lib/utils/aztec-wallet';
import { getAztecWarpToadBalance, getAztecWarpToadDecimals } from '$lib/utils/aztec-interactions';
import { L2WarpToadAbi, USDcoinAbi } from '$lib/contracts/abis';
import { getEVMChain, isChainEnabled } from '$lib/config/chains.js';

class BalanceStore {
	// Reactive state - separate balance for each chain type
	private _ethereumBalance = $state<string>('0.00');
	private _scrollBalance = $state<string>('0.00');
	private _aztecBalance = $state<string>('0.00');

	private _isLoadingEthereum = $state<boolean>(false);
	private _isLoadingScroll = $state<boolean>(false);
	private _isLoadingAztec = $state<boolean>(false);

	private _lastRefresh = $state<number>(0);
	private _selectedToken = $state<Token>('USDC');

	// Getters
	get ethereumBalance(): string {
		return this._ethereumBalance;
	}

	get scrollBalance(): string {
		return this._scrollBalance;
	}

	get aztecBalance(): string {
		return this._aztecBalance;
	}

	// Legacy getter for backwards compatibility
	get evmBalance(): string {
		// Return balance based on current connected chain
		const chainId = walletStore.chainId;
		if (!chainId) return this._ethereumBalance;

		const scrollChain = getEVMChain('Scroll');
		if (scrollChain?.enabled && chainId === scrollChain.chainId) {
			return this._scrollBalance;
		}
		return this._ethereumBalance;
	}

	get isLoadingEthereum(): boolean {
		return this._isLoadingEthereum;
	}

	get isLoadingScroll(): boolean {
		return this._isLoadingScroll;
	}

	get isLoadingAztec(): boolean {
		return this._isLoadingAztec;
	}

	// Legacy getter
	get isLoadingEvm(): boolean {
		return this._isLoadingEthereum || this._isLoadingScroll;
	}

	get isLoading(): boolean {
		return this._isLoadingEthereum || this._isLoadingScroll || this._isLoadingAztec;
	}

	get lastRefresh(): number {
		return this._lastRefresh;
	}

	/**
	 * Get balance for a specific chain
	 */
	getBalance(chain: Chain): string {
		switch (chain) {
			case 'Aztec':
				return this._aztecBalance;
			case 'Scroll':
				return this._scrollBalance;
			case 'Ethereum':
			default:
				return this._ethereumBalance;
		}
	}

	/**
	 * Check if loading for a specific chain
	 */
	isChainLoading(chain: Chain): boolean {
		switch (chain) {
			case 'Aztec':
				return this._isLoadingAztec;
			case 'Scroll':
				return this._isLoadingScroll;
			case 'Ethereum':
			default:
				return this._isLoadingEthereum;
		}
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

		const refreshTasks: Promise<void>[] = [this.refreshEthereumBalance(), this.refreshAztecBalance()];

		// Only refresh Scroll if enabled
		if (isChainEnabled('Scroll')) {
			refreshTasks.push(this.refreshScrollBalance());
		}

		await Promise.all(refreshTasks);
		this._lastRefresh = Date.now();
		console.log('[BalanceStore] Refresh complete');
	}

	/**
	 * Refresh Ethereum L1 balance
	 */
	async refreshEthereumBalance(): Promise<void> {
		const evmAddress = walletStore.wallets.evm;

		if (!evmAddress) {
			this._ethereumBalance = 'Connect wallet';
			return;
		}

		const ethereumChain = getEVMChain('Ethereum');
		if (!ethereumChain) {
			this._ethereumBalance = '0.00';
			return;
		}

		const tokenAddress = ethereumChain.contracts.nativeToken;
		if (!tokenAddress) {
			console.log(`[BalanceStore] No token address for ${this._selectedToken} on Ethereum`);
			this._ethereumBalance = '0.00';
			return;
		}

		this._isLoadingEthereum = true;

		try {
			const publicClient = createPublicClient({
				chain: ethereumChain.viemChain,
				transport: http(ethereumChain.rpcUrl),
			});

			const [decimals, rawBalance] = await Promise.all([
				publicClient.readContract({
					address: tokenAddress as `0x${string}`,
					abi: USDcoinAbi,
					functionName: 'decimals',
				}),
				publicClient.readContract({
					address: tokenAddress as `0x${string}`,
					abi: USDcoinAbi,
					functionName: 'balanceOf',
					args: [evmAddress as `0x${string}`],
				}),
			]);

			const balance = Number(rawBalance) / 10 ** Number(decimals);
			this._ethereumBalance = balance.toString();
			console.log(`[BalanceStore] Ethereum balance: ${this._ethereumBalance}`);
		} catch (error) {
			console.error('[BalanceStore] Failed to fetch Ethereum balance:', error);
		} finally {
			this._isLoadingEthereum = false;
		}
	}

	/**
	 * Refresh Scroll L2 balance
	 * On Scroll, users hold wrapped tokens from L2WarpToad
	 */
	async refreshScrollBalance(): Promise<void> {
		const evmAddress = walletStore.wallets.evm;

		if (!evmAddress) {
			this._scrollBalance = 'Connect wallet';
			return;
		}

		const scrollChain = getEVMChain('Scroll');
		if (!scrollChain || !scrollChain.enabled) {
			this._scrollBalance = 'N/A';
			return;
		}

		this._isLoadingScroll = true;

		try {
			const publicClient = createPublicClient({
				chain: scrollChain.viemChain,
				transport: http(scrollChain.rpcUrl),
			});

			// On Scroll, query the L2WarpToad contract for balance
			// L2WarpToad is itself an ERC20 token
			const [decimals, rawBalance] = await Promise.all([
				publicClient.readContract({
					address: scrollChain.contracts.warpToad as `0x${string}`,
					abi: L2WarpToadAbi,
					functionName: 'decimals',
				}),
				publicClient.readContract({
					address: scrollChain.contracts.warpToad as `0x${string}`,
					abi: L2WarpToadAbi,
					functionName: 'balanceOf',
					args: [evmAddress as `0x${string}`],
				}),
			]);

			const balance = Number(rawBalance) / 10 ** Number(decimals);
			this._scrollBalance = balance.toString();
			console.log(`[BalanceStore] Scroll balance: ${this._scrollBalance}`);
		} catch (error) {
			console.error('[BalanceStore] Failed to fetch Scroll balance:', error);
			// Don't reset balance on error - keep previous value
		} finally {
			this._isLoadingScroll = false;
		}
	}

	/**
	 * Refresh Aztec balance
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
				getAztecWarpToadDecimals(aztecWallet),
			]);

			const formatted = Number(balance) / 10 ** decimals;
			this._aztecBalance = formatted.toString();
			console.log(`[BalanceStore] Aztec balance: ${this._aztecBalance}`);
		} catch (error) {
			console.error('[BalanceStore] Failed to fetch Aztec balance:', error);
		} finally {
			this._isLoadingAztec = false;
		}
	}

	// Legacy method for backwards compatibility
	async refreshEvmBalance(): Promise<void> {
		await Promise.all([this.refreshEthereumBalance(), this.refreshScrollBalance()]);
	}

	/**
	 * Initialize balances (call on app mount or wallet connection)
	 */
	async initialize(): Promise<void> {
		await this.refresh();
	}
}

export const balanceStore = new BalanceStore();
