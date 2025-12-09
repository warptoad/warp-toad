import { AztecWallet } from '@azguardwallet/aztec-wallet';
import type { Wallet } from '@aztec/aztec.js/wallet';

const isLocal = import.meta.env.VITE_LOCAL;

// Determine network based on environment
const AZTEC_NETWORK = isLocal ? 'sandbox' : 'devnet';

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
		// Connect with metadata and network
		const wallet = await AztecWallet.connect(DAPP_METADATA, AZTEC_NETWORK);
		
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
		const wallet = await AztecWallet.connect(DAPP_METADATA, AZTEC_NETWORK);
		
		// Check if already connected
		const azguardWallet = wallet as unknown as { connected?: boolean };
		if (!azguardWallet.connected) {
			return null;
		}

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
