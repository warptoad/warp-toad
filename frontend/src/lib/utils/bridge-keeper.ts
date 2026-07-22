/**
 * BridgeKeeper API Client
 * 
 * Handles communication with the BridgeKeeper service for triggering
 * cross-chain root synchronization operations.
 */

import type { Chain } from '$lib/types/bridge.js';
import { getChainIdFor } from '$lib/config/chains.js';
import { rpcSettings } from '$lib/stores/rpc-settings.svelte';

/**
 * Whether the BridgeKeeper service is reachable from this build.
 *
 * - Testnet/mainnet build (`VITE_TEST_MODE != 'true'`): always enabled,
 *   defaults to bridge.warptoad.xyz, override via VITE_BRIDGE_KEEPER_URL.
 * - Local sandbox build (`VITE_TEST_MODE = 'true'`): off by default
 *   (fall back to running `pnpm l:sync` manually). Set
 *   `VITE_BRIDGE_KEEPER_URL=http://localhost:6969` (or any URL) to opt in -
 *   useful for testing the bridge-sync service against the sandbox.
 */
const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
export const isBridgeKeeperEnabled = !isTestMode || !!import.meta.env.VITE_BRIDGE_KEEPER_URL;

// Default to the production URL on testnet/mainnet builds, otherwise use the
// explicit local override (only set when opting in to local bridge-sync).
const BRIDGE_KEEPER_URL =
	import.meta.env.VITE_BRIDGE_KEEPER_URL ||
	(isTestMode ? 'http://localhost:6969' : 'https://bridge.warptoad.xyz');

/**
 * Burn-leaf indexer toggle. An RPC-cost optimization: instead of every user
 * re-scanning all Burn events to rebuild a merkle path, the keeper serves a
 * cached leaf snapshot and the client builds the path locally.
 *
 * Gating keeps it an opt-in convenience, never an implicit/mainnet dependency.
 * NOTE: VITE_TEST_MODE=true means the LOCAL SANDBOX build (anvil/localhost), not
 * a public testnet. A VPS testnet deployment is a VITE_TEST_MODE=false build, so
 * it must opt in explicitly:
 *   - Local sandbox (VITE_TEST_MODE=true): ON by default; set
 *     VITE_USE_BRIDGE_INDEXER=false to disable.
 *   - Any real deployment (public testnet on a VPS, mainnet): OFF by default;
 *     set VITE_USE_BRIDGE_INDEXER=true to enable. Turn it on for your testnet
 *     deploy to cut RPC cost; leave it unset for mainnet.
 *   - Every consumer falls back to a direct on-chain scan on ANY failure and
 *     re-verifies the reconstructed root, so enabling it is never a hard
 *     dependency and removing the indexer just makes withdraws scan again.
 */
export const isBridgeIndexerEnabled =
	isBridgeKeeperEnabled &&
	(import.meta.env.VITE_USE_BRIDGE_INDEXER === 'true' ||
		(isTestMode && import.meta.env.VITE_USE_BRIDGE_INDEXER !== 'false'));

export interface IndexerBurnLeaf { index: number; commitment: bigint; amount: bigint; }

/**
 * Fetch the burn-leaf snapshot for [fromBlock, toBlock] from the keeper's
 * indexer. Throws on any non-OK response so callers fall back to a direct scan.
 * The server only sees the block range, never which commitment is wanted.
 */
export async function fetchBurnLeavesFromKeeper(
	chainId: number,
	warpToadAddress: string,
	fromBlock: bigint,
	toBlock: bigint,
): Promise<IndexerBurnLeaf[]> {
	const url = `${BRIDGE_KEEPER_URL}/burn-leaves/${chainId}/${warpToadAddress}?fromBlock=${fromBlock}&toBlock=${toBlock}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`indexer /burn-leaves HTTP ${res.status}`);
	const data = await res.json();
	if (!data?.ok || !Array.isArray(data.leaves)) throw new Error('indexer /burn-leaves bad shape');
	return data.leaves.map((l: any) => ({
		index: Number(l.index),
		commitment: BigInt(l.commitment),
		amount: BigInt(l.amount),
	}));
}

/**
 * Thrown when a withdraw flow detects that the bridge keeper hasn't yet
 * pushed the source chain's local root to L1 (or hasn't dispatched the
 * resulting gigaRoot to the destination chain). The central WithdrawForm
 * catch block fires `triggerBridge(fromChainId, toChainId)` and surfaces
 * a "wait 30min-3hrs and retry" message.
 *
 * `fromChainId` / `toChainId` use the BridgeKeeper convention: numeric
 * EVM chain IDs as strings ('11155111', '300') and 'aztec' for Aztec.
 */
export class BridgeSyncStaleError extends Error {
	constructor(
		message: string,
		public readonly fromChainId: string,
		public readonly toChainId: string,
	) {
		super(message);
		this.name = 'BridgeSyncStaleError';
	}
}

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
	/**
	 * Operation lifecycle.
	 * - 'noop': returned by the unified scheduler when a tick runs but on-chain
	 *   state was already fresh (no L1 tx, no leg work). Treat as completed
	 *   for UX: the user's commitment is already on the destination chain.
	 */
	status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'noop';
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
	if (chain === 'Aztec') {
		return 'aztec';
	}

	// Everything else resolves through the chain registry. Hardcoding the L2 id here
	// is what pointed the keeper at retired Scroll Sepolia (534351) after the L2 had
	// already moved: the keeper rejects the unknown leg, so every bridge silently fails.
	const chainId = getChainIdFor(chain);
	if (chainId === undefined) {
		throw new Error(`Unknown chain: ${chain}`);
	}
	return String(chainId);
}

/**
 * Get expected duration for a bridge operation
 * This matches the BridgeKeeper's duration logic
 */
export function getExpectedDuration(fromChain: Chain, toChain: Chain): string {
	// ZKsync Era bridges take longest
	if (fromChain === 'ZKsync' || toChain === 'ZKsync') {
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
 * Snapshot of the L1 GigaBridge state as returned by `/giga-state/:chainId`.
 * Computed server-side from a handful of contract reads (cached briefly) so
 * the frontend doesn't have to replay 70+ getLogs chunks to reconstruct the
 * same data from ReceivedNewLocalRoot events.
 */
export interface GigaStateResponse {
	ok: true;
	chainId: string;
	gigaBridge: string;
	gigaRoot: string;
	amountOfLocalRoots: number;
	leaves: Array<{
		provider: string;
		index: number;
		localRoot: string;
		localRootBlockNumber: number;
	}>;
	fetchedAtMs: number;
}

/**
 * Fetch the L1 giga state from BridgeKeeper. Use this whenever the user is
 * on the default (proxied) RPC path - the server does the aggregation. When
 * the user supplied their own RPC via the wallet settings they take the
 * client-side scan instead (they get to pay the RPC cost themselves, and
 * we don't know their endpoint to relay for them).
 */
export async function fetchGigaStateFromKeeper(chainId: string): Promise<GigaStateResponse> {
	const url = `${BRIDGE_KEEPER_URL}/giga-state/${chainId}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching giga state`);
	const data = await res.json();
	if (!data?.ok) throw new Error(data?.error ?? 'giga-state endpoint returned ok=false');
	return data as GigaStateResponse;
}

export interface CachedGigaLeaves {
	amountOfLocalRoots: number;
	/** Indexed by leaf position. Missing entries default to 0n at the call site. */
	leaves: Map<number, { localRoot: bigint; localRootBlockNumber: number }>;
}

/**
 * Fast path for giga-tree leaf reconstruction: returns the keeper's snapshot
 * iff its current gigaRoot equals the one we want to prove against. Returns
 * null when the user opted into a custom RPC (we don't know their endpoint to
 * relay for them), when the keeper is on a different gigaRoot (likely a
 * historical lookup), or when the keeper request fails. Callers fall back to
 * client-side event scanning in those cases.
 */
export async function tryGetGigaLeavesForRoot(
	chainId: number,
	expectedGigaRoot: bigint,
): Promise<CachedGigaLeaves | null> {
	if (rpcSettings.isUsingCustom(chainId)) return null;
	try {
		const state = await fetchGigaStateFromKeeper(String(chainId));
		if (BigInt(state.gigaRoot) !== expectedGigaRoot) {
			console.log(
				`[keeper] giga-state gigaRoot mismatch (state=${state.gigaRoot.slice(0, 12)}... expected=${expectedGigaRoot.toString().slice(0, 12)}...); falling back to RPC scan`,
			);
			return null;
		}
		const leaves = new Map<number, { localRoot: bigint; localRootBlockNumber: number }>();
		for (const leaf of state.leaves) {
			leaves.set(leaf.index, {
				localRoot: BigInt(leaf.localRoot),
				localRootBlockNumber: leaf.localRootBlockNumber,
			});
		}
		return { amountOfLocalRoots: state.amountOfLocalRoots, leaves };
	} catch (e) {
		console.warn('[keeper] giga-state fetch failed, falling back to RPC scan:', e);
		return null;
	}
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
 * Poll-friendly wrapper around checkBridgeStatus. Returns null instead of
 * throwing on transient network errors so the caller's poll loop doesn't
 * have to wrap every call in try/catch. Distinguishes 404 (operation expired
 * server-side, drop the local bridgeSync record) from other errors via the
 * `expired` flag.
 *
 * Used by the WithdrawForm in-progress panel: every 30s poll returns one of
 * these and the panel updates without crashing on a flaky network.
 */
export interface PollOperationResult {
	response: BridgeStatusResponse | null;
	expired: boolean;
	error: string | null;
}

export async function pollOperation(
	operationId: string,
	signal?: AbortSignal,
): Promise<PollOperationResult> {
	const url = `${BRIDGE_KEEPER_URL}/status/${operationId}`;
	try {
		const response = await fetch(url, { signal });
		if (response.status === 404) {
			return { response: null, expired: true, error: null };
		}
		if (!response.ok) {
			return {
				response: null,
				expired: false,
				error: `HTTP ${response.status}: ${response.statusText}`,
			};
		}
		const data = (await response.json()) as BridgeStatusResponse;
		return { response: data, expired: false, error: null };
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			return { response: null, expired: false, error: null };
		}
		return {
			response: null,
			expired: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
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
