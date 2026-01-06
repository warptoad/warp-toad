import { AztecWallet } from '@azguardwallet/aztec-wallet';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { AZTEC_CONFIG } from '$lib/config/environment.js';

// Dapp metadata for Azguard connection
const DAPP_METADATA = {
	name: 'Warptoad',
	description: 'Cross-chain privacy bridge',
	logo: '', // To be filled later
	url: typeof window !== 'undefined' ? window.location.origin : ''
};

// Store the wallet instance globally
let walletInstance: Wallet | null = null;

/**
 * Check if Azguard wallet is available
 * Note: The package uses browser extension detection internally
 */
export function isAzguardAvailable(): boolean {
	// The AztecWallet.connect() will handle detection
	// For now, we assume it's available in browser context
	return typeof window !== 'undefined';
}

/**
 * Connect to Azguard wallet
 */
export async function connectAzguardWallet(): Promise<{ wallet: Wallet; address: string }> {
	try {
		// Connect with metadata and network from environment config
		const wallet = await AztecWallet.connect(DAPP_METADATA, AZTEC_CONFIG.network);
		
		// Store the wallet instance for later use
		walletInstance = wallet;

		// Get accounts from the wallet
		const accounts = await wallet.getAccounts();
		
		if (!accounts || accounts.length === 0) {
			throw new Error('No accounts found in Azguard wallet');
		}
		// Get address of first account 
		const address: string = accounts[0].item.toString();
		
		console.log('Final address string:', address);

		return { wallet, address };
	} catch (error: unknown) {
		console.error('Failed to connect to Azguard:', error);
		
		if (error instanceof Error) {
			// Check for common error types
			if (error.message.includes('rejected') || error.message.includes('denied')) {
				throw new Error('Connection rejected. Please approve the connection in Azguard wallet.');
			}
			if (error.message.includes('not found') || error.message.includes('not installed')) {
				throw new Error('Azguard wallet not found. Please install the Azguard wallet extension.');
			}
			throw error;
		}
		
		throw new Error('Failed to connect to Azguard wallet');
	}
}

/**
 * Get the current wallet instance
 */
export function getWalletInstance(): Wallet | null {
	return walletInstance;
}

/**
 * Get the Aztec node URL from the connected Azguard wallet
 * Falls back to environment config if wallet doesn't expose it
 */
export async function getAztecNodeUrlFromWallet(): Promise<string> {
	if (!walletInstance) {
		// No wallet connected, use environment config
		return AZTEC_CONFIG.nodeUrl;
	}
	
	try {
		// Try to get chain info from wallet (may include node URL)
		const chainInfo = await walletInstance.getChainInfo();
		
		// Check if chainInfo has a node/pxe URL property
		// The Azguard wallet may expose this differently
		const walletWithUrl = chainInfo as any;
		if (walletWithUrl.nodeUrl) {
			console.log('Using Aztec node URL from Azguard wallet:', walletWithUrl.nodeUrl);
			return walletWithUrl.nodeUrl;
		}
		if (walletWithUrl.pxeUrl) {
			console.log('Using Aztec PXE URL from Azguard wallet:', walletWithUrl.pxeUrl);
			return walletWithUrl.pxeUrl;
		}
		
		// If Azguard doesn't expose the URL, check the wallet object directly
		const walletObj = walletInstance as any;
		if (walletObj.nodeUrl) {
			console.log('Using node URL from wallet object:', walletObj.nodeUrl);
			return walletObj.nodeUrl;
		}
		if (walletObj.pxe?.nodeUrl) {
			console.log('Using node URL from PXE:', walletObj.pxe.nodeUrl);
			return walletObj.pxe.nodeUrl;
		}
	} catch (error) {
		console.warn('Could not get node URL from Azguard wallet, using config:', error);
	}
	
	// Fallback to environment config
	console.log('Using Aztec node URL from environment config:', AZTEC_CONFIG.nodeUrl);
	return AZTEC_CONFIG.nodeUrl;
}

/**
 * Check if wallet is currently connected
 */
export function isWalletConnected(): boolean {
	if (!walletInstance) return false;
	
	// Check if wallet instance has connected property
	const azguardWallet = walletInstance as unknown as { connected?: boolean };

	return azguardWallet.connected ?? false;
}

/**
 * Disconnect from Azguard wallet
 */
export async function disconnectAzguardWallet(): Promise<void> {
	if (!walletInstance) return;

	try {
		// Check if disconnect method exists
		const azguardWallet = walletInstance as unknown as { disconnect?: () => Promise<void> };
		if (azguardWallet.disconnect) {
			await azguardWallet.disconnect();
		}
		walletInstance = null;
	} catch (error) {
		console.error('Failed to disconnect Azguard wallet:', error);
		// Clear instance anyway
		walletInstance = null;
	}
}

/**
 * Setup event listeners for connection state changes
 */
export function onConnectionChanged(
	onConnected: () => void,
	onDisconnected: () => void
): () => void {
	if (!walletInstance) return () => {};

	const azguardWallet = walletInstance as unknown as {
		onConnected?: { addHandler: (handler: () => void) => void };
		onDisconnected?: { addHandler: (handler: () => void) => void };
	};

	// Add handlers if available
	if (azguardWallet.onConnected) {
		azguardWallet.onConnected.addHandler(onConnected);
	}
	if (azguardWallet.onDisconnected) {
		azguardWallet.onDisconnected.addHandler(onDisconnected);
	}

	// Return cleanup function
	return () => {
		// Note: The package doesn't expose removeHandler,
		// so cleanup is handled by disconnecting
	};
}

/**
 * Auto-reconnect if wallet was previously connected
 */
export async function autoReconnect(): Promise<{ wallet: Wallet; address: string } | null> {
	if (!isAzguardAvailable()) return null;

	try {
		// Try to connect (Azguard handles session persistence internally)
		const wallet = await AztecWallet.connect(DAPP_METADATA, AZTEC_CONFIG.network);
		
		// Check if already connected
		const azguardWallet = wallet as unknown as { connected?: boolean };
		if (!azguardWallet.connected) {
			return null;
		}

		// Azguard is not updated to the new devnet yet
		walletInstance = wallet;
		const accounts = await wallet.getAccounts();
		
		if (!accounts || accounts.length === 0) {
			return null;
		}

		// Extract address from account
		const address: string = accounts[0].item.toString();
		

		return { wallet, address };
	} catch (error) {
		// Silent fail for auto-reconnect
		console.debug('Auto-reconnect failed:', error);
		return null;
	}
}
