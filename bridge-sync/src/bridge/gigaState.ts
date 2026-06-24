/**
 * Server-side aggregator for "current state of the L1 giga tree".
 *
 * The frontend's merkle-proof builder needs the leaf value + block number for
 * each local-root provider registered in the GigaBridge, plus the current
 * gigaRoot. Previously it reconstructed this by scanning ReceivedNewLocalRoot
 * events from deployment block to head (~700k blocks on Sepolia), which at
 * 10k-block chunks was 70+ getLogs calls on every withdraw - routinely
 * tripping Infura's rate limit even on paid tier.
 *
 * This aggregator does the same work in a handful of contract reads:
 *   1. GigaBridge.gigaRoot()            — current root
 *   2. per-provider: getLocalRootProvidersIndex(addr)  — tree index
 *   3. per-provider: adapter.getLocalRootAndBlock()    — current leaf value
 *
 * The result is deterministic against the chain's current state, so we just
 * cache briefly (5 s) to coalesce concurrent withdraw-page loads without
 * stale-reading through a fresh updateGigaRoot tx.
 */
import { createPublicClient, http, type Address } from 'viem';
import { loadL1Contracts, loadL1AdapterByType } from './contractLoader.js';
import { getChainConfig } from './chainMapper.js';

const LOCAL_ROOT_PROVIDER_ABI = [
	{ type: 'function', name: 'mostRecentL2Root', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{ type: 'function', name: 'mostRecentL2RootBlockNumber', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{ type: 'function', name: 'getLocalRootAndBlock', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const;

export interface GigaLeaf {
	provider: Address;
	/** 0-based index into the giga tree's leaves. */
	index: number;
	/** The local root this provider last committed. */
	localRoot: string;
	/** The L2 block number that root came from. For L1WarpToad this is an L1 block. */
	localRootBlockNumber: number;
}

export interface GigaState {
	chainId: string;
	gigaBridge: Address;
	gigaRoot: string;
	amountOfLocalRoots: number;
	leaves: GigaLeaf[];
	/** Unix ms when this snapshot was computed. */
	fetchedAtMs: number;
}

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, { state: GigaState; expiresAtMs: number }>();

/** Per-chain: the set of provider addresses the frontend wants leaves for.
 * L1WarpToad is always index 0 per the deployment module ordering; aztec and
 * scroll adapters follow. The GigaBridge itself stores the provider→index
 * mapping, so we just probe each one. */
function providersForChain(l1ChainId: bigint, addrs: {
	l1WarpToadAddress: Address;
	aztecAdapter: Address;
	scrollAdapter: Address;
}): Address[] {
	// Order here is cosmetic; actual index comes from getLocalRootProvidersIndex.
	return [addrs.l1WarpToadAddress, addrs.aztecAdapter, addrs.scrollAdapter];
}

export async function fetchGigaState(l1ChainIdStr: string): Promise<GigaState> {
	const hit = cache.get(l1ChainIdStr);
	if (hit && hit.expiresAtMs > Date.now()) return hit.state;

	const l1ChainConfig = getChainConfig(l1ChainIdStr as any);
	if (!l1ChainConfig.rpcUrl) throw new Error(`No RPC URL configured for chain ${l1ChainIdStr}`);
	const publicClient = createPublicClient({ transport: http(l1ChainConfig.rpcUrl) });
	const l1ChainId = BigInt(await publicClient.getChainId());

	const { gigaBridge, l1WarpToadAddress, gigaBridgeAddress } = loadL1Contracts(l1ChainId, publicClient as any, {} as any, true);
	const aztec = loadL1AdapterByType(l1ChainId, publicClient as any, {} as any, 'aztec');
	// Scroll adapter is absent on local/dev deploys (Scroll disabled); load it
	// optionally and only include it as a provider when present.
	const scroll = loadL1AdapterByType(l1ChainId, publicClient as any, {} as any, 'scroll', true);
	const providers = [l1WarpToadAddress, aztec.address];
	if (scroll) providers.push(scroll.address);

	// Collapse the contract reads into a single Promise.all; viem will
	// pipeline them to the upstream RPC. Pre-allocates leaves[] at the tree
	// index the GigaBridge assigns each provider.
	const [gigaRoot, amountOfLocalRootsRaw, ...perProvider] = await Promise.all([
		gigaBridge.read.gigaRoot() as Promise<bigint>,
		gigaBridge.read.amountOfLocalRoots() as Promise<bigint>,
		...providers.flatMap((addr) => [
			gigaBridge.read.getLocalRootProvidersIndex([addr]) as Promise<number>,
			// Each provider exposes getLocalRootAndBlock; L1WarpToad and the
			// adapters all implement it per the ILocalRootProvider interface.
			// It reverts before the first L2→L1 root lands, so tolerate that
			// and emit zeros instead of failing the whole snapshot.
			publicClient.readContract({
				address: addr,
				abi: LOCAL_ROOT_PROVIDER_ABI,
				functionName: 'getLocalRootAndBlock',
			}).catch(() => [0n, 0n] as readonly [bigint, bigint]),
		]),
	]);

	const amountOfLocalRoots = Number(amountOfLocalRootsRaw);
	const leaves: GigaLeaf[] = [];
	for (let i = 0; i < providers.length; i++) {
		const providerAddr = providers[i];
		const idx = Number(perProvider[i * 2]);
		const [localRoot, localRootBlockNumber] = perProvider[i * 2 + 1] as readonly [bigint, bigint];
		leaves[idx] = {
			provider: providerAddr,
			index: idx,
			localRoot: localRoot.toString(),
			localRootBlockNumber: Number(localRootBlockNumber),
		};
	}

	const state: GigaState = {
		chainId: l1ChainIdStr,
		gigaBridge: gigaBridgeAddress,
		gigaRoot: gigaRoot.toString(),
		amountOfLocalRoots,
		leaves: Array.from(leaves),
		fetchedAtMs: Date.now(),
	};
	cache.set(l1ChainIdStr, { state, expiresAtMs: Date.now() + CACHE_TTL_MS });
	return state;
}
