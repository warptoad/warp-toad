import type { Wallets, Chain, ChainType } from '$lib/types/bridge.js';
import { CHAIN_TYPES } from '$lib/types/bridge.js';
import {
	connectWallet,
	getAccounts,
	getChainId,
	isWalletAvailable,
	onAccountsChanged,
	onChainChanged,
	switchNetwork,
	CHAIN_ID_TO_NAME,
	NETWORKS
} from '$lib/utils/evm-wallet.js';
import {
	connectAztecBrowserWallet,
	disconnectAztecWallet,
	isAztecWalletAvailable,
	autoReconnect as autoReconnectAztec,
	onConnectionChanged,
	getWalletInstance,
	getAccountMode,
	setAccountMode,
	clearCustomSecrets,
	type AztecAccountMode,
} from '$lib/utils/aztec-wallet.js';
import type { Wallet } from '@aztec/aztec.js/wallet';

const STORAGE_KEY = 'warptoad:wallets';
const CHAIN_ID_KEY = 'warptoad:chainId';

// Load from localStorage or return default
function loadWallets(): Wallets {
	if (typeof window === 'undefined') return { evm: null, aztec: null };

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch {
			return { evm: null, aztec: null };
		}
	}
	return { evm: null, aztec: null };
}

// Save to localStorage
function saveWallets(wallets: Wallets) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

// Load chain ID from localStorage
function loadChainId(): number | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem(CHAIN_ID_KEY);
	return stored ? parseInt(stored, 10) : null;
}

// Save chain ID to localStorage
function saveChainId(chainId: number | null) {
	if (typeof window === 'undefined') return;
	if (chainId === null) {
		localStorage.removeItem(CHAIN_ID_KEY);
	} else {
		localStorage.setItem(CHAIN_ID_KEY, chainId.toString());
	}
}



// Create reactive state
class WalletStore {
	private _wallets = $state<Wallets>(loadWallets());
	private _chainId = $state<number | null>(loadChainId());
	private _isConnecting = $state<boolean>(false);
	private _isConnectingAztec = $state<boolean>(false);
	private _error = $state<string | null>(null);
	private _aztecError = $state<string | null>(null);
	private _balance = $state<bigint | null>(null);
	private _aztecWallet: Wallet | null = null;
	private cleanupAccountListener: (() => void) | null = null;
	private cleanupChainListener: (() => void) | null = null;
	private cleanupAztecConnectionListener: (() => void) | null = null;

	constructor() {
		// Auto-reconnect on page load
		if (typeof window !== 'undefined') {
			this.autoReconnect();
			this.autoReconnectAztec();
		}
	}

	get wallets(): Wallets {
		return this._wallets;
	}

	get chainId(): number | null {
		return this._chainId;
	}

	get chainName(): Chain | null {
		if (this._chainId === null) return null;
		return CHAIN_ID_TO_NAME[this._chainId] || null;
	}

	get isConnecting(): boolean {
		return this._isConnecting;
	}

	get isConnectingAztec(): boolean {
		return this._isConnectingAztec;
	}

	get error(): string | null {
		return this._error;
	}

	get aztecError(): string | null {
		return this._aztecError;
	}

	get balance(): bigint | null {
		return this._balance;
	}

	get isEVMConnected(): boolean {
		return this._wallets.evm !== null;
	}

	get isAztecConnected(): boolean {
		return this._wallets.aztec !== null;
	}

	get isBothConnected(): boolean {
		return this.isEVMConnected && this.isAztecConnected;
	}

	get isWalletInstalled(): boolean {
		return isWalletAvailable();
	}

	/**
	 * In-browser Aztec wallet is always available (no extension required).
	 * Kept under the legacy getter name so component templates don't churn.
	 */
	get isAztecWalletAvailable(): boolean {
		return isAztecWalletAvailable();
	}

	/** @deprecated retained for template compatibility; always returns isAztecWalletAvailable */
	get isAzguardInstalled(): boolean {
		return isAztecWalletAvailable();
	}

	get aztecWallet(): Wallet | null {
		return this._aztecWallet;
	}

	get aztecAccountMode(): AztecAccountMode {
		return getAccountMode();
	}

	async connectEVM(): Promise<void> {
		this._isConnecting = true;
		this._error = null;

		try {
			const { address, chainId } = await connectWallet();
			this._wallets.evm = address;
			this._chainId = chainId;

			saveWallets(this._wallets);
			saveChainId(chainId);

			// Setup event listeners
			this.setupEventListeners();
		} catch (error) {
			console.error('Failed to connect EVM wallet:', error);
			this._error = error instanceof Error ? error.message : 'Failed to connect wallet';
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	async autoReconnect(): Promise<void> {
		if (!isWalletAvailable()) return;

		try {
			const accounts = await getAccounts();
			if (accounts.length > 0) {
				const chainId = await getChainId();

				this._wallets.evm = accounts[0];
				this._chainId = chainId;

				saveWallets(this._wallets);
				if (chainId) saveChainId(chainId);

				// Setup event listeners
				this.setupEventListeners();
			}
		} catch (error) {
			console.error('Auto-reconnect failed:', error);
		}
	}

	async autoReconnectAztec(): Promise<void> {
		if (!isAztecWalletAvailable()) return;

		try {
			const result = await autoReconnectAztec();
			if (result) {
				this._aztecWallet = result.wallet;
				this._wallets.aztec = result.address;
				saveWallets(this._wallets);

				// Setup event listeners
				this.setupAztecEventListeners();
			}
		} catch (error) {
			console.debug('Aztec auto-reconnect failed:', error);
		}
	}

	private setupEventListeners(): void {
		// Clean up existing listeners
		this.cleanupAccountListener?.();
		this.cleanupChainListener?.();

		// Listen to account changes
		this.cleanupAccountListener = onAccountsChanged((accounts) => {
			if (accounts.length === 0) {
				this.disconnectEVM();
			} else if (accounts[0] !== this._wallets.evm) {
				this._wallets.evm = accounts[0];
				saveWallets(this._wallets);
			}
		});

		// Listen to chain changes
		this.cleanupChainListener = onChainChanged((chainId) => {
			this._chainId = chainId;
			saveChainId(chainId);
		});
	}

	async switchToChain(chain: Chain): Promise<void> {
		if (chain === 'Aztec') return; // Don't switch for Aztec
		if (!this.isEVMConnected) {
			throw new Error('Please connect your EVM wallet first');
		}

		this._isConnecting = true;
		this._error = null;

		try {
			await switchNetwork(chain);
			// Chain ID will be updated via the chainChanged event listener
		} catch (error) {
			console.error('Failed to switch network:', error);
			this._error = error instanceof Error ? error.message : 'Failed to switch network';
			throw error;
		} finally {
			this._isConnecting = false;
		}
	}

	async connectAztec(): Promise<void> {
		this._isConnectingAztec = true;
		this._aztecError = null;

		try {
			const { wallet, address } = await connectAztecBrowserWallet();

			this._aztecWallet = wallet;
			this._wallets.aztec = address;

			saveWallets(this._wallets);

			// Setup event listeners
			this.setupAztecEventListeners();
		} catch (error) {
			console.error('Failed to connect Aztec wallet:', error);
			this._aztecError = error instanceof Error ? error.message : 'Failed to connect Aztec wallet';
			throw error;
		} finally {
			this._isConnectingAztec = false;
		}
	}

	/**
	 * Switch the Aztec account mode (sandbox-test vs custom). Disconnects any
	 * currently-connected wallet so the next connect rebuilds with the new mode.
	 */
	async setAztecAccountMode(mode: AztecAccountMode): Promise<void> {
		const current = getAccountMode();
		if (current === mode) return;
		setAccountMode(mode);
		if (this._aztecWallet) {
			await this.disconnectAztec();
		}
	}

	/** Wipe the persisted custom Aztec secret. Forces a fresh account on next connect. */
	async resetCustomAztecAccount(): Promise<void> {
		clearCustomSecrets();
		if (this._aztecWallet && getAccountMode() === 'custom') {
			await this.disconnectAztec();
		}
	}

	private setupAztecEventListeners(): void {
		// Clean up existing listener
		this.cleanupAztecConnectionListener?.();

		// Setup connection state listeners
		this.cleanupAztecConnectionListener = onConnectionChanged(
			() => {
				// On connected - refresh the wallet instance and address
				const wallet = getWalletInstance();
				if (wallet) {
					this._aztecWallet = wallet;
					wallet.getAccounts().then(accounts => {
						if (accounts.length > 0) {
							// Extract address from CompleteAddress object
							const address: string = accounts[0].item.toString();
							this._wallets.aztec = address;
							saveWallets(this._wallets);
						}
					}).catch(console.error);
				}
			},
			() => {
				// On disconnected - clear state
				this.disconnectAztec();
			}
		);
	}

	disconnectEVM() {
		this._wallets.evm = null;
		this._chainId = null;
		this._balance = null;
		this._error = null;

		saveWallets(this._wallets);
		saveChainId(null);

		// Clean up event listeners
		this.cleanupAccountListener?.();
		this.cleanupChainListener?.();
		this.cleanupAccountListener = null;
		this.cleanupChainListener = null;
	}

	async disconnectAztec(): Promise<void> {
		try {
			await disconnectAztecWallet();
		} catch (error) {
			console.error('Error disconnecting Aztec wallet:', error);
		}

		this._aztecWallet = null;
		this._wallets.aztec = null;
		this._aztecError = null;

		saveWallets(this._wallets);

		// Clean up event listener
		this.cleanupAztecConnectionListener?.();
		this.cleanupAztecConnectionListener = null;
	}

	clearError() {
		this._error = null;
	}

	clearAztecError() {
		this._aztecError = null;
	}

	// Format address for display
	formatAddress(address: string | null): string {
		if (!address) return '';

		// Safety check: if address is somehow an object, convert it to string
		if (typeof address !== 'string') {
			console.warn('Address is not a string:', address);
			address = String(address);
		}

		if (address.length <= 10) return address;
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	// Format balance for display (in ETH)
	formatBalance(decimals: number = 4): string {
		if (this._balance === null) return '0';
		const eth = Number(this._balance) / 1e18;
		return eth.toFixed(decimals);
	}

	// Get chain type (EVM or Aztec)
	getChainType(chain: Chain): ChainType {
		return CHAIN_TYPES[chain];
	}

	// Check if chain wallet is connected
	isChainConnected(chain: Chain): boolean {
		const chainType = this.getChainType(chain);
		return chainType === 'EVM' ? this.isEVMConnected : this.isAztecConnected;
	}

	// Check if we're on the correct network for the selected chain
	isOnCorrectNetwork(chain: Chain): boolean {
		if (chain === 'Aztec') return true;
		if (!this._chainId) return false;

		const network = NETWORKS[chain];
		return network ? this._chainId === network.id : false;
	}
}

export const walletStore = new WalletStore();
