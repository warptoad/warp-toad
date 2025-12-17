/**
 * BridgeKeeper API Client
 * 
 * Handles communication with the BridgeKeeper service for triggering
 * cross-chain root synchronization operations.
 */

import type { Chain } from '$lib/types/bridge.js';

const BRIDGE_KEEPER_URL = import.meta.env.VITE_BRIDGE_KEEPER_URL || 'http://localhost:6969';

export interface BridgeKeeperResponse {
	ok: boolean;
	operationId: string;
	status: string;
	message: string;
	expectedDuration: string;
	note: string;
	error?: string;
}

export interface BridgeStatusResponse {
	ok: boolean;
	operationId: string;
	fromChainId: string;
	toChainId: string;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
	startTime: number;
	endTime?: number;
	txHashes?: Record<string, string>;
	error?: string;
	confirmations: number;
}

export interface PendingBridgeSync {
	operationId: string;
	fromChain: Chain;
	toChain: Chain;
	expectedDuration: string;
	timestamp: number;
}

/**
 * Convert frontend Chain type to BridgeKeeper chain ID
 * - Aztec: 'aztec' (friendly name)
 * - EVM chains: numeric chain ID as string
 */
export function getChainIdForBridgeKeeper(chain: Chain): string {
	// Check if we're in test mode (local Anvil)
	const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
	
	if (chain === 'Aztec') {
		return 'aztec';
	}
	
	if (chain === 'Ethereum') {
		// Test mode: local Anvil (31337)
		// Production: Sepolia (11155111)
		return isTestMode ? '31337' : '11155111';
	}
	
	if (chain === 'Scroll') {
		// Scroll Sepolia testnet
		return '534351';
	}
	
	throw new Error(`Unknown chain: ${chain}`);
}

/**
 * Get expected duration for a bridge operation
 * This matches the BridgeKeeper's duration logic
 */
export function getExpectedDuration(fromChain: Chain, toChain: Chain): string {
	// Scroll bridges take longest
	if (fromChain === 'Scroll' || toChain === 'Scroll') {
		return '2-3 hours';
	}
	
	// Aztec bridges
	if (fromChain === 'Aztec' || toChain === 'Aztec') {
		return '30 minutes - 1 hour';
	}
	
	// Default
	return '30 minutes - 1 hour';
}

/**
 * Trigger a bridge operation on BridgeKeeper
 * 
 * @param fromChainId - Source chain ID
 * @param toChainId - Destination chain ID
 * @param confirmations - Number of block confirmations (default: 3)
 * @returns Bridge operation response with operation ID
 */
export async function triggerBridge(
	fromChainId: string,
	toChainId: string,
	confirmations: number = 3
): Promise<BridgeKeeperResponse> {
	const url = `${BRIDGE_KEEPER_URL}/bridge/${fromChainId}/${toChainId}`;
	
	console.log(`[BridgeKeeper] Triggering bridge: ${fromChainId} -> ${toChainId}`);
	console.log(`[BridgeKeeper] URL: ${url}`);
	
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			confirmations,
			waitForCompletion: false, // Always async - don't wait
		}),
	});
	
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
	}
	
	const data = await response.json();
	console.log('[BridgeKeeper] Response:', data);
	
	return data;
}

/**
 * Check the status of a bridge operation
 * 
 * @param operationId - The operation ID returned from triggerBridge
 * @returns Current status of the operation
 */
export async function checkBridgeStatus(operationId: string): Promise<BridgeStatusResponse> {
	const url = `${BRIDGE_KEEPER_URL}/status/${operationId}`;
	
	const response = await fetch(url);
	
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	
	return await response.json();
}

/**
 * Save pending bridge sync operation to localStorage
 */
export function savePendingBridgeSync(sync: PendingBridgeSync): void {
	localStorage.setItem('pendingBridgeSync', JSON.stringify(sync));
}

/**
 * Get pending bridge sync operation from localStorage
 */
export function getPendingBridgeSync(): PendingBridgeSync | null {
	const data = localStorage.getItem('pendingBridgeSync');
	if (!data) return null;
	
	try {
		return JSON.parse(data);
	} catch (error) {
		console.error('Failed to parse pending bridge sync:', error);
		return null;
	}
}

/**
 * Clear pending bridge sync from localStorage
 */
export function clearPendingBridgeSync(): void {
	localStorage.removeItem('pendingBridgeSync');
}
