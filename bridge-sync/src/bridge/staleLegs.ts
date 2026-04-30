/**
 * Staleness check for the bridge-sync pipeline.
 *
 * Pure read-only function. Returns the minimal set of legs that actually
 * need to run, based on live on-chain state. Replaces the per-route flag
 * mapping in `routeToRequirements` (which set flags unconditionally and
 * burned gas on cycles where nothing had moved).
 *
 * The result feeds the unified scheduler:
 *   - flags = computeStaleLegs(...)
 *   - if !hasAnyRequirement(flags): return noop (no L1 tx)
 *   - else: runSyncCycle(privateKey, confirmations, flags)
 *
 * Trigger sources:
 *   - Aztec L2-to-L1: live aztec localRoot differs from L1-anchored leaf,
 *     OR aztec head lags more than `aztecBlockLagThreshold` blocks behind
 *     `mostRecentL2RootBlockNumber`. The lag branch is load-bearing for
 *     withdraw proof generation: testnet aztec nodes prune world state past
 *     ~100 blocks, so a stale L1-anchored block makes
 *     `node_getNoteHashMembershipWitness` fail with "block hash not found
 *     in world state". Pushing a fresh root before the lag exceeds
 *     retention keeps proofs buildable.
 *   - Scroll L2-to-L1: live Scroll localRoot differs from L1-anchored leaf.
 *   - Dispatch flags: if any L2-to-L1 leg fires, the gigaRoot will change,
 *     so dispatch to both L2s (executor step 4 always sends to all 3
 *     recipients anyway). Standalone Scroll dispatch fires when the L2
 *     mirror of gigaRoot lags. Standalone Aztec dispatch is not detected
 *     here (would need a PXE/aztec-node read and is heavyweight on this
 *     hot path); relying on the lag-threshold push to catch all aztec
 *     staleness.
 *
 * Failure semantics: never throws. Aztec node or Scroll RPC unreachable
 * yields conservative flags from whatever could be read. The next tick
 * retries.
 */
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { loadL1Contracts, loadL1AdapterByType, loadScrollContracts } from './contractLoader.js';
import { getChainConfig } from './chainMapper.js';
import {
	EMPTY_REQUIREMENTS,
	hasAnyRequirement,
	type SyncRequirements,
} from './syncRequirements.js';

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

export interface StaleLegInputs {
	/** L1 chain id (e.g. 11155111n for Sepolia, 31337n for local). */
	l1ChainId: bigint;
	/** Aztec head minus mostRecentL2RootBlockNumber tolerated before forcing a push. */
	aztecBlockLagThreshold: number;
	/** Override for the L1 RPC. Defaults to `getChainConfig(l1ChainId).rpcUrl`. */
	l1RpcUrl?: string;
	/** Override for AZTEC_NODE_URL. Empty/null disables the aztec branch. */
	aztecNodeUrl?: string | null;
	/** Override for SCROLL_RPC_URL. Empty/null disables the scroll branch. */
	scrollRpcUrl?: string | null;
}

/**
 * Observability payload returned alongside the flags. Surfaced via
 * `/health.scheduler.lastStaleLegs` and `/debug/stale-legs` so operators
 * can see why the scheduler did or did not run a cycle.
 */
export interface StaleLegsDetail {
	currentGigaRoot: string | null;
	aztec: {
		enabled: boolean;
		head: number | null;
		l1Anchored: number | null;
		lag: number | null;
		threshold: number;
		localRootOnL1: string | null;
		/** True when the lag-threshold branch (node-pruning workaround) fired. */
		lagTriggered: boolean;
	};
	scroll: {
		enabled: boolean;
		liveLocalRoot: string | null;
		l1AnchoredLocalRoot: string | null;
		l2GigaRoot: string | null;
		gigaRootProvider: string | null;
		deployBugDetected: boolean;
	};
	errors: string[];
	checkedAtMs: number;
}

export interface StaleLegsReport {
	flags: SyncRequirements;
	detail: StaleLegsDetail;
}

/** Build StaleLegInputs from process.env. Centralizes the env reads so callers
 * (server, scheduler, debug endpoint, heartbeat-shim) don't duplicate
 * boilerplate. */
export function buildStaleLegInputs(): StaleLegInputs {
	const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
	const aztecBlockLagThreshold = Number(
		process.env.AZTEC_HEARTBEAT_THRESHOLD_BLOCKS || '80',
	);
	return {
		l1ChainId: BigInt(l1ChainIdStr),
		aztecBlockLagThreshold,
		aztecNodeUrl: process.env.AZTEC_NODE_URL || null,
		scrollRpcUrl: process.env.SCROLL_RPC_URL || null,
	};
}

export async function computeStaleLegs(inputs: StaleLegInputs): Promise<StaleLegsReport> {
	const errors: string[] = [];
	const detail: StaleLegsDetail = {
		currentGigaRoot: null,
		aztec: {
			enabled: false,
			head: null,
			l1Anchored: null,
			lag: null,
			threshold: inputs.aztecBlockLagThreshold,
			localRootOnL1: null,
			lagTriggered: false,
		},
		scroll: {
			enabled: false,
			liveLocalRoot: null,
			l1AnchoredLocalRoot: null,
			l2GigaRoot: null,
			gigaRootProvider: null,
			deployBugDetected: false,
		},
		errors,
		checkedAtMs: Date.now(),
	};

	// === L1 setup ===
	let l1Public: PublicClient;
	try {
		const l1RpcUrl =
			inputs.l1RpcUrl || getChainConfig(inputs.l1ChainId.toString() as any).rpcUrl;
		l1Public = createPublicClient({ transport: http(l1RpcUrl) });
	} catch (e) {
		errors.push(`L1 client init failed: ${e instanceof Error ? e.message : String(e)}`);
		return { flags: { ...EMPTY_REQUIREMENTS }, detail };
	}

	let gigaBridge: any;
	let aztecAdapterAddr: Address;
	let scrollAdapterAddr: Address;
	try {
		const L1 = loadL1Contracts(inputs.l1ChainId, l1Public, {} as any, true);
		gigaBridge = L1.gigaBridge;
		const aztecHandle = loadL1AdapterByType(inputs.l1ChainId, l1Public, {} as any, 'aztec');
		const scrollHandle = loadL1AdapterByType(inputs.l1ChainId, l1Public, {} as any, 'scroll');
		aztecAdapterAddr = aztecHandle.address;
		scrollAdapterAddr = scrollHandle.address;
		// Bind for downstream Promise.all reads. Re-getContract via the loader
		// helpers gives us typed read methods.
		var aztecAdapter = aztecHandle.adapter;
		var scrollAdapter = scrollHandle.adapter;
	} catch (e) {
		errors.push(`L1 contract load failed: ${e instanceof Error ? e.message : String(e)}`);
		return { flags: { ...EMPTY_REQUIREMENTS }, detail };
	}

	// === Optional clients ===
	const scrollEnabled = !!inputs.scrollRpcUrl;
	const aztecEnabled = !!inputs.aztecNodeUrl;
	detail.scroll.enabled = scrollEnabled;
	detail.aztec.enabled = aztecEnabled;

	let scroll: ReturnType<typeof loadScrollContracts> | null = null;
	if (scrollEnabled) {
		try {
			const scrollPublic = createPublicClient({ transport: http(inputs.scrollRpcUrl!) });
			scroll = loadScrollContracts(534351n, scrollPublic as any, {} as any);
		} catch (e) {
			errors.push(`Scroll client init failed: ${e instanceof Error ? e.message : String(e)}`);
			scroll = null;
			detail.scroll.enabled = false;
		}
	}

	let aztecNode: ReturnType<typeof createAztecNodeClient> | null = null;
	if (aztecEnabled) {
		try {
			aztecNode = createAztecNodeClient(inputs.aztecNodeUrl!);
		} catch (e) {
			errors.push(`Aztec node init failed: ${e instanceof Error ? e.message : String(e)}`);
			aztecNode = null;
			detail.aztec.enabled = false;
		}
	}

	// === Parallel reads ===
	const safeRead = async <T>(p: Promise<T>, label: string, fallback: T): Promise<T> => {
		try {
			return await p;
		} catch (e) {
			errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
			return fallback;
		}
	};

	const reads = await Promise.all([
		safeRead<bigint>(gigaBridge.read.gigaRoot() as Promise<bigint>, 'gigaBridge.gigaRoot', 0n),
		safeRead<readonly [bigint, bigint]>(
			aztecAdapter.read.getLocalRootAndBlock() as Promise<readonly [bigint, bigint]>,
			'aztecAdapter.getLocalRootAndBlock',
			[0n, 0n] as const,
		),
		safeRead<readonly [bigint, bigint]>(
			scrollAdapter.read.getLocalRootAndBlock() as Promise<readonly [bigint, bigint]>,
			'scrollAdapter.getLocalRootAndBlock',
			[0n, 0n] as const,
		),
		safeRead<bigint>(
			aztecAdapter.read.mostRecentL2RootBlockNumber() as Promise<bigint>,
			'aztecAdapter.mostRecentL2RootBlockNumber',
			0n,
		),
		scroll
			? safeRead<bigint>(scroll.L2WarpToad.read.localRoot() as Promise<bigint>, 'L2WarpToad.localRoot', 0n)
			: Promise.resolve(null),
		scroll
			? safeRead<bigint>(scroll.L2WarpToad.read.gigaRoot() as Promise<bigint>, 'L2WarpToad.gigaRoot', 0n)
			: Promise.resolve(null),
		scroll
			? safeRead<Address>(
					scroll.L2WarpToad.read.gigaRootProvider() as Promise<Address>,
					'L2WarpToad.gigaRootProvider',
					ZERO_ADDRESS,
				)
			: Promise.resolve(null),
		aztecNode
			? safeRead<number>(
					(aztecNode.getBlockNumber() as Promise<number>),
					'aztecNode.getBlockNumber',
					0,
				)
			: Promise.resolve(null),
	]);

	const [
		currentGigaRoot,
		[aztecLocalRootOnL1, aztecLocalRootBlockOnL1],
		[scrollLocalRootOnL1],
		mostRecentAztecBlock,
		scrollLiveLocalRoot,
		scrollL2GigaRoot,
		scrollGigaRootProvider,
		aztecHead,
	] = reads;

	detail.currentGigaRoot = currentGigaRoot.toString();
	detail.aztec.l1Anchored = Number(mostRecentAztecBlock);
	detail.aztec.localRootOnL1 = aztecLocalRootOnL1.toString();
	detail.scroll.l1AnchoredLocalRoot = scrollLocalRootOnL1.toString();
	if (scrollLiveLocalRoot !== null) detail.scroll.liveLocalRoot = scrollLiveLocalRoot.toString();
	if (scrollL2GigaRoot !== null) detail.scroll.l2GigaRoot = scrollL2GigaRoot.toString();
	if (scrollGigaRootProvider !== null) detail.scroll.gigaRootProvider = scrollGigaRootProvider;
	if (aztecHead !== null) detail.aztec.head = aztecHead;

	// === Deploy-bug guard ===
	// L2WarpToad.gigaRootProvider == 0x0 means initialize() was never called
	// after the Ignition deploy. The Scroll messenger will silently
	// FailedRelayedMessage every send because the adapter's call to
	// L2WarpToad.receiveGigaRoot reverts on the onlyGigaRootProvider modifier.
	// Don't burn gas on a doomed cycle; surface the deploy bug loudly.
	if (scroll && scrollGigaRootProvider === ZERO_ADDRESS) {
		detail.scroll.deployBugDetected = true;
		errors.push(
			'L2WarpToad.gigaRootProvider is 0x0 on Scroll; deploy-bug, run initializeL2Scroll.ts',
		);
		console.error(
			'[stale-legs] L2WarpToad.gigaRootProvider is 0x0; refusing to spin a cycle, run initializeL2Scroll.ts',
		);
		return { flags: { ...EMPTY_REQUIREMENTS }, detail };
	}

	// === Flag derivation ===
	const flags: SyncRequirements = { ...EMPTY_REQUIREMENTS };

	// Aztec L2-to-L1 staleness.
	if (aztecEnabled && aztecHead !== null) {
		const lag = aztecHead - Number(mostRecentAztecBlock);
		detail.aztec.lag = lag;
		// l1Anchored === 0 means the adapter has never received a push (fresh
		// deploy). Treat as definitely-push, mirrors aztecHeartbeat.ts:174.
		const lagTrigger = mostRecentAztecBlock === 0n || lag > inputs.aztecBlockLagThreshold;
		if (lagTrigger) {
			flags.needAztecL2ToL1 = true;
			detail.aztec.lagTriggered = true;
		}
		// Note: we don't compare live-aztec-localRoot to L1-anchored localRoot
		// here. Reading it requires an aztec-node call beyond getBlockNumber
		// (and PXE for the contract storage). The lag-threshold check above
		// catches all the cases that matter for withdraw proof generation; if
		// the local root truly diverged without the block lag growing, the
		// next user-driven cycle picks it up.
	}

	// Scroll L2-to-L1 staleness.
	if (scroll && scrollLiveLocalRoot !== null) {
		if (scrollLiveLocalRoot !== scrollLocalRootOnL1) {
			flags.needScrollL2ToL1 = true;
		}
	}

	// Dispatch flags. If we already need an L2-to-L1 leg, the gigaRoot will
	// change, so dispatch to both L2s; executor step 4 always sends to all 3
	// recipients anyway, but the dispatch flag gates step 5's per-recipient
	// `receive` polling.
	if (flags.needAztecL2ToL1 || flags.needScrollL2ToL1) {
		flags.dispatchToAztec = true;
		flags.dispatchToScroll = true;
	}

	// Standalone Scroll dispatch: L2 mirror of gigaRoot lags the L1 source of
	// truth (e.g. a previous cycle's sendGigaRoot to Scroll failed without
	// blocking the rest). Single L2 read tells us.
	if (scroll && scrollL2GigaRoot !== null && scrollL2GigaRoot !== currentGigaRoot) {
		flags.dispatchToScroll = true;
	}

	// Standalone Aztec dispatch is not checked here. The lag-threshold branch
	// above is the catch-all for aztec staleness; it forces needAztecL2ToL1
	// (which sets dispatchToAztec) whenever the L1-anchored block ages out.

	return { flags, detail };
}

export async function isStale(inputs: StaleLegInputs): Promise<boolean> {
	const { flags } = await computeStaleLegs(inputs);
	return hasAnyRequirement(flags);
}
