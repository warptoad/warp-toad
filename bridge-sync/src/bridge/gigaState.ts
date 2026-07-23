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
 * IMPORTANT (fixed 2026-06-26): the leaf value MUST be the root that was
 * actually FOLDED into the gigaRoot - i.e. the latest `ReceivedNewLocalRoot`
 * event per index - NOT each provider's current `getLocalRootAndBlock()`. The
 * adapter's current root runs ahead of the gigaRoot whenever a fresh L2->L1
 * root has landed but `updateGigaRoot` hasn't folded it yet (every keeper sync
 * window). Using `getLocalRootAndBlock()` made the snapshot self-inconsistent:
 * its leaves could not reconstruct the gigaRoot it returned, so the frontend
 * threw "Could not recreate the gigaRoot". We read the folded values from
 * events here (bounded, cached) so clients still never scan logs themselves.
 *
 * The result is deterministic against the chain's current state, so we cache
 * briefly (5 s) to coalesce concurrent withdraw-page loads.
 */
import { createPublicClient, type Address, type AbiEvent } from 'viem';
import { rpcTransport } from './rpcTransport.js';
import { loadL1Contracts, loadL1AdapterForLeg } from './contractLoader.js';
import { AZTEC_LEG, LEGS } from './legRegistry.js';
import { getChainConfig } from './chainMapper.js';

export interface GigaLeaf {
	provider: Address;
	/** 0-based index into the giga tree's leaves. */
	index: number;
	/** The local root this provider last committed (the value FOLDED into gigaRoot). */
	localRoot: string;
	/** The L2 block number that folded root came from. For L1WarpToad this is an L1 block. */
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

// getLogs chunk size (Infura caps eth_getLogs at 10k blocks per call).
const CHUNK = 10_000n;
// Block where each chain's GigaBridge was deployed, so the folded-leaf scan
// starts at the first possible ReceivedNewLocalRoot instead of genesis. An
// index that has never been folded legitimately has leaf value 0 (the
// constructor's LazyIMT.insert(0)), so we must scan the full lifetime to be
// sure - hence the explicit deploy block. Fallback below for unlisted chains.
const GIGA_BRIDGE_DEPLOY_BLOCK: Record<string, bigint> = {
	'11155111': 11130522n, // Sepolia, v5 redeploy
};
// For chains without a recorded deploy block, look back this far from head.
const DEFAULT_LOOKBACK = 250_000n;

let receivedEventCache: AbiEvent | undefined;
function receivedEvent(abi: any[]): AbiEvent {
	if (!receivedEventCache) {
		const ev = abi.find((x: any) => x.type === 'event' && x.name === 'ReceivedNewLocalRoot');
		if (!ev) throw new Error('ReceivedNewLocalRoot event not found in GigaBridge ABI');
		receivedEventCache = ev as AbiEvent;
	}
	return receivedEventCache;
}

/**
 * The leaf actually folded into gigaRoot for each index = the latest
 * ReceivedNewLocalRoot(newLocalRoot, localRootIndex, localRootBlockNumber)
 * event per index, up to `toBlock`. Returns index -> { root, blockNumber }.
 */
async function fetchFoldedLeaves(
	client: ReturnType<typeof createPublicClient>,
	gigaBridgeAddress: Address,
	abi: any[],
	fromBlock: bigint,
	toBlock: bigint,
): Promise<Map<number, { root: bigint; blockNumber: bigint }>> {
	const ev = receivedEvent(abi);
	// index -> { root, blockNumber (folded L2 block), evBlock, logIndex }
	const latest = new Map<number, { root: bigint; blockNumber: bigint; evBlock: bigint; logIndex: number }>();
	for (let start = fromBlock; start <= toBlock; start += CHUNK) {
		let end = start + CHUNK - 1n;
		if (end > toBlock) end = toBlock;
		const logs = await client.getLogs({ address: gigaBridgeAddress, event: ev, fromBlock: start, toBlock: end });
		for (const log of logs as any[]) {
			const idx = Number(log.args.localRootIndex);
			const cand = {
				root: log.args.newLocalRoot as bigint,
				blockNumber: log.args.localRootBlockNumber as bigint,
				evBlock: log.blockNumber as bigint,
				logIndex: Number(log.logIndex),
			};
			const cur = latest.get(idx);
			// Forward scan, so a later block (or higher logIndex in the same block)
			// is the more recent fold and wins.
			if (!cur || cand.evBlock > cur.evBlock || (cand.evBlock === cur.evBlock && cand.logIndex > cur.logIndex)) {
				latest.set(idx, cand);
			}
		}
	}
	const out = new Map<number, { root: bigint; blockNumber: bigint }>();
	for (const [idx, v] of latest) out.set(idx, { root: v.root, blockNumber: v.blockNumber });
	return out;
}

export async function fetchGigaState(l1ChainIdStr: string): Promise<GigaState> {
	const hit = cache.get(l1ChainIdStr);
	if (hit && hit.expiresAtMs > Date.now()) return hit.state;

	const l1ChainConfig = getChainConfig(l1ChainIdStr as any);
	if (!l1ChainConfig.rpcUrl) throw new Error(`No RPC URL configured for chain ${l1ChainIdStr}`);
	const publicClient = createPublicClient({ transport: rpcTransport(l1ChainConfig.rpcUrl) });
	const l1ChainId = BigInt(await publicClient.getChainId());

	const { gigaBridge, l1WarpToadAddress, gigaBridgeAddress } = loadL1Contracts(l1ChainId, publicClient as any, {} as any, AZTEC_LEG);
	// Every leg's adapter is a provider. Loaded optionally because local/dev deploys
	// omit the ZK Stack adapters; a missing one is simply not a provider. Unclaimed
	// spare slots are never in LEGS, so they can't be included (they'd revert).
	const providers = [l1WarpToadAddress];
	for (const leg of LEGS) {
		const handle = loadL1AdapterForLeg(l1ChainId, publicClient as any, {} as any, leg.key, true);
		if (handle) providers.push(handle.address);
	}

	// Pin the gigaRoot read and the folded-leaf scan to the SAME head block, so a
	// concurrent updateGigaRoot can't make the returned root and leaves disagree.
	const head = await publicClient.getBlockNumber();

	const [gigaRoot, amountOfLocalRootsRaw, ...providerIndexes] = await Promise.all([
		publicClient.readContract({
			address: gigaBridgeAddress,
			abi: gigaBridge.abi,
			functionName: 'gigaRoot',
			blockNumber: head,
		}) as Promise<bigint>,
		gigaBridge.read.amountOfLocalRoots() as Promise<bigint>,
		...providers.map((addr) => gigaBridge.read.getLocalRootProvidersIndex([addr]) as Promise<number>),
	]);

	const amountOfLocalRoots = Number(amountOfLocalRootsRaw);
	const fromBlock = GIGA_BRIDGE_DEPLOY_BLOCK[l1ChainIdStr] ?? (head > DEFAULT_LOOKBACK ? head - DEFAULT_LOOKBACK : 0n);
	const folded = await fetchFoldedLeaves(publicClient, gigaBridgeAddress, gigaBridge.abi, fromBlock, head);

	const leaves: GigaLeaf[] = [];
	for (let i = 0; i < providers.length; i++) {
		const providerAddr = providers[i];
		const idx = Number(providerIndexes[i]);
		const f = folded.get(idx);
		leaves[idx] = {
			provider: providerAddr,
			index: idx,
			// No event for this index => never folded => leaf is the constructor's 0.
			localRoot: (f?.root ?? 0n).toString(),
			localRootBlockNumber: Number(f?.blockNumber ?? 0n),
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
