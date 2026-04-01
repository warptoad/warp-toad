/**
 * Aztec Browser Wallet
 *
 * Custom in-browser wallet for Aztec interactions.
 * Replaces the previous Azguard wallet integration.
 *
 * TODO: Implement full browser wallet using @aztec/aztec.js directly:
 * - Schnorr account creation from user-provided secret
 * - PXE connection to testnet node
 * - Transaction signing and sending
 */

import type { Wallet } from '@aztec/aztec.js/wallet';
import { AZTEC_CONFIG } from '$lib/config/environment.js';

// Store the wallet instance globally
let walletInstance: Wallet | null = null;

/**
 * Check if the Aztec browser wallet can be used
 */
export function isAztecWalletAvailable(): boolean {
	return typeof window !== 'undefined';
}

/** @deprecated Use isAztecWalletAvailable */
export const isAzguardAvailable = isAztecWalletAvailable;

/**
 * Connect the Aztec browser wallet
 *
 * TODO: Implement actual wallet creation:
 * 1. Prompt user for secret key (or generate one)
 * 2. Create PXE client connected to testnet node
 * 3. Create Schnorr account
 * 4. Return wallet + address
 */
export async function connectAztecBrowserWallet(): Promise<{ wallet: Wallet; address: string }> {
	// TODO: Replace with real implementation
	throw new Error(
		'Aztec browser wallet not yet implemented. ' +
		'This will use @aztec/aztec.js to create a Schnorr account connected to the testnet PXE.'
	);
}

/** @deprecated Use connectAztecBrowserWallet */
export const connectAzguardWallet = connectAztecBrowserWallet;

/**
 * Get the current wallet instance
 */
export function getWalletInstance(): Wallet | null {
	return walletInstance;
}

/**
 * Get the Aztec node URL
 */
export function getAztecNodeUrl(): string {
	return AZTEC_CONFIG.nodeUrl;
}

/** @deprecated Use getAztecNodeUrl */
export const getAztecNodeUrlFromWallet = async () => getAztecNodeUrl();

/**
 * Check if wallet is currently connected
 */
export function isWalletConnected(): boolean {
	return walletInstance !== null;
}

/**
 * Disconnect the wallet
 */
export async function disconnectAztecWallet(): Promise<void> {
	walletInstance = null;
}

/** @deprecated Use disconnectAztecWallet */
export const disconnectAzguardWallet = disconnectAztecWallet;

/**
 * Setup event listeners for connection state changes
 */
export function onConnectionChanged(
	_onConnected: () => void,
	_onDisconnected: () => void
): () => void {
	// TODO: Implement connection state events
	return () => {};
}

/**
 * Auto-reconnect if wallet was previously connected
 */
export async function autoReconnect(): Promise<{ wallet: Wallet; address: string } | null> {
	// TODO: Check localStorage for saved wallet state and reconnect
	return null;
}
