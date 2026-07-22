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
 * Every leg comes from the registry, so adding an L2 needs no changes here.
 *
 * Trigger sources:
 *   - Aztec L2-to-L1: aztec head lags more than `aztecBlockLagThreshold` blocks behind
 *     `mostRecentL2RootBlockNumber`. The lag branch is load-bearing for withdraw proof
 *     generation: testnet aztec nodes prune world state past ~100 blocks, so a stale
 *     L1-anchored block makes `node_getNoteHashMembershipWitness` fail with "block hash
 *     not found in world state". Pushing a fresh root before the lag exceeds retention
 *     keeps proofs buildable.
 *   - ZK Stack L2-to-L1: live L2 localRoot differs from the L1-anchored leaf.
 *   - Dispatch: if any L2-to-L1 leg fires, the gigaRoot will change, so dispatch to
 *     every leg (executor step 3 always sends to all recipients anyway, but the
 *     dispatch list gates step 4's per-leg `receive` polling). A standalone dispatch
 *     fires for a ZK Stack leg whose L2 mirror of gigaRoot lags. Standalone Aztec
 *     dispatch is not detected here (would need a PXE/aztec-node read and is
 *     heavyweight on this hot path); the lag-threshold push catches aztec staleness.
 *
 * Failure semantics: never throws. An unreachable node or RPC yields conservative
 * flags from whatever could be read, and a leg that fails to initialize is skipped
 * rather than taking the whole check down with it. The next tick retries.
 */
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { loadL1Contracts, loadL1AdapterForLeg, loadZkStackContracts } from './contractLoader.js';
import { getChainConfig } from './chainMapper.js';
import { AZTEC_LEG, LEGS, legRpcUrl, zkStackLegs, type LegKey } from './legRegistry.js';
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
	/** Per-leg RPC overrides, keyed by LegKey. Null disables that leg. */
	legRpcUrls?: Partial<Record<LegKey, string | null>>;
}

/** Per-leg observability payload. Aztec-only and ZK-Stack-only fields are optional. */
export interface LegStaleDetail {
	kind: 'aztec' | 'zkstack';
	label: string;
	enabled: boolean;
	/** localRoot as anchored on L1 by this leg's adapter. */
	l1AnchoredLocalRoot: string | null;
	/** aztec: head block; zkstack: unused. */
	head?: number | null;
	/** aztec: L1-anchored block number. */
	l1Anchored?: number | null;
	lag?: number | null;
	threshold?: number;
	/** True when the lag-threshold branch (node-pruning workaround) fired. */
	lagTriggered?: boolean;
	/** zkstack: localRoot read live off the L2. */
	liveLocalRoot?: string | null;
	/** zkstack: the L2's mirror of gigaRoot. */
	l2GigaRoot?: string | null;
	gigaRootProvider?: string | null;
	deployBugDetected?: boolean;
}

/**
 * Observability payload returned alongside the flags. Surfaced via
 * `/health.scheduler.lastStaleLegs` and `/debug/stale-legs` so operators
 * can see why the scheduler did or did not run a cycle.
 */
export interface StaleLegsDetail {
	currentGigaRoot: string | null;
	legs: Record<LegKey, LegStaleDetail>;
	errors: string[];
	checkedAtMs: number;
}

export interface StaleLegsReport {
	flags: SyncRequirements;
	detail: StaleLegsDetail;
}

function emptyDetail(aztecBlockLagThreshold: number): StaleLegsDetail {
	const legs: Record<LegKey, LegStaleDetail> = {};
	for (const leg of LEGS) {
		legs[leg.key] = leg.kind === 'aztec'
			? {
					kind: 'aztec', label: leg.label, enabled: false,
					l1AnchoredLocalRoot: null, head: null, l1Anchored: null, lag: null,
					threshold: aztecBlockLagThreshold, lagTriggered: false,
				}
			: {
					kind: 'zkstack', label: leg.label, enabled: false,
					l1AnchoredLocalRoot: null, liveLocalRoot: null, l2GigaRoot: null,
					gigaRootProvider: null, deployBugDetected: false,
				};
	}
	return { currentGigaRoot: null, legs, errors: [], checkedAtMs: Date.now() };
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
	};
}

export async function computeStaleLegs(inputs: StaleLegInputs): Promise<StaleLegsReport> {
	const detail = emptyDetail(inputs.aztecBlockLagThreshold);
	const errors = detail.errors;

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
	const legAdapters = new Map<LegKey, any>();
	try {
		const L1 = loadL1Contracts(inputs.l1ChainId, l1Public, {} as any, AZTEC_LEG);
		gigaBridge = L1.gigaBridge;
		for (const leg of LEGS) {
			// Optional: a leg whose adapter isn't deployed here just can't be stale.
			const handle = loadL1AdapterForLeg(inputs.l1ChainId, l1Public, {} as any, leg.key, true);
			if (handle) legAdapters.set(leg.key, handle.adapter);
		}
	} catch (e) {
		errors.push(`L1 contract load failed: ${e instanceof Error ? e.message : String(e)}`);
		return { flags: { ...EMPTY_REQUIREMENTS }, detail };
	}

	const safeRead = async <T>(p: Promise<T>, label: string, fallback: T): Promise<T> => {
		try {
			return await p;
		} catch (e) {
			errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
			return fallback;
		}
	};

	const currentGigaRoot = await safeRead<bigint>(
		gigaBridge.read.gigaRoot() as Promise<bigint>, 'gigaBridge.gigaRoot', 0n,
	);
	detail.currentGigaRoot = currentGigaRoot.toString();

	const needL2ToL1: LegKey[] = [];
	const dispatchTo: LegKey[] = [];

	// === Aztec leg ===
	const aztecEnabled = !!inputs.aztecNodeUrl && legAdapters.has(AZTEC_LEG);
	const aztecDetail = detail.legs[AZTEC_LEG];
	aztecDetail.enabled = aztecEnabled;
	if (aztecEnabled) {
		const adapter = legAdapters.get(AZTEC_LEG);
		let aztecNode: ReturnType<typeof createAztecNodeClient> | null = null;
		try {
			aztecNode = createAztecNodeClient(inputs.aztecNodeUrl!);
		} catch (e) {
			errors.push(`Aztec node init failed: ${e instanceof Error ? e.message : String(e)}`);
			aztecDetail.enabled = false;
		}

		if (aztecNode) {
			const [[localRootOnL1], mostRecentAztecBlock, aztecHead] = await Promise.all([
				safeRead<readonly [bigint, bigint]>(
					adapter.read.getLocalRootAndBlock() as Promise<readonly [bigint, bigint]>,
					'aztecAdapter.getLocalRootAndBlock', [0n, 0n] as const,
				),
				safeRead<bigint>(
					adapter.read.mostRecentL2RootBlockNumber() as Promise<bigint>,
					'aztecAdapter.mostRecentL2RootBlockNumber', 0n,
				),
				safeRead<number>(aztecNode.getBlockNumber() as Promise<number>, 'aztecNode.getBlockNumber', 0),
			]);

			aztecDetail.l1AnchoredLocalRoot = localRootOnL1.toString();
			aztecDetail.l1Anchored = Number(mostRecentAztecBlock);
			aztecDetail.head = aztecHead;

			const lag = aztecHead - Number(mostRecentAztecBlock);
			aztecDetail.lag = lag;
			// l1Anchored === 0 means the adapter has never received a push (fresh
			// deploy). Treat as definitely-push, mirrors aztecHeartbeat.ts.
			if (mostRecentAztecBlock === 0n || lag > inputs.aztecBlockLagThreshold) {
				needL2ToL1.push(AZTEC_LEG);
				aztecDetail.lagTriggered = true;
			}
			// Note: we don't compare live-aztec-localRoot to the L1-anchored localRoot
			// here. Reading it requires an aztec-node call beyond getBlockNumber (and
			// PXE for the contract storage). The lag-threshold check above catches all
			// the cases that matter for withdraw proof generation; if the local root
			// truly diverged without the block lag growing, the next user-driven cycle
			// picks it up.
		}
	}

	// === ZK Stack legs ===
	for (const leg of zkStackLegs()) {
		const d = detail.legs[leg.key];
		const adapter = legAdapters.get(leg.key);
		if (!adapter) continue;

		const override = inputs.legRpcUrls?.[leg.key];
		if (override === null) continue; // explicitly disabled
		let rpcUrl: string;
		try {
			rpcUrl = override ?? legRpcUrl(leg);
		} catch {
			continue; // no RPC configured; leg simply isn't checked
		}
		d.enabled = true;

		let handles: ReturnType<typeof loadZkStackContracts>;
		let l2Public: PublicClient;
		try {
			l2Public = createPublicClient({ transport: http(rpcUrl) });
			handles = loadZkStackContracts(leg.chainId!, l2Public as any, {} as any);
		} catch (e) {
			errors.push(`${leg.label} client init failed: ${e instanceof Error ? e.message : String(e)}`);
			d.enabled = false;
			continue;
		}

		const [[localRootOnL1], liveLocalRoot, l2GigaRoot, gigaRootProvider] = await Promise.all([
			safeRead<readonly [bigint, bigint]>(
				adapter.read.getLocalRootAndBlock() as Promise<readonly [bigint, bigint]>,
				`${leg.label} adapter.getLocalRootAndBlock`, [0n, 0n] as const,
			),
			safeRead<bigint>(handles.L2WarpToad.read.localRoot() as Promise<bigint>, `${leg.label} L2WarpToad.localRoot`, 0n),
			safeRead<bigint>(handles.L2WarpToad.read.gigaRoot() as Promise<bigint>, `${leg.label} L2WarpToad.gigaRoot`, 0n),
			safeRead<Address>(
				handles.L2WarpToad.read.gigaRootProvider() as Promise<Address>,
				`${leg.label} L2WarpToad.gigaRootProvider`, ZERO_ADDRESS,
			),
		]);

		d.l1AnchoredLocalRoot = localRootOnL1.toString();
		d.liveLocalRoot = liveLocalRoot.toString();
		d.l2GigaRoot = l2GigaRoot.toString();
		d.gigaRootProvider = gigaRootProvider;

		// === Deploy-bug guard ===
		// L2WarpToad.gigaRootProvider == 0x0 means initialize() was never called after
		// the Ignition deploy, so every inbound giga root reverts on the
		// onlyGigaRootProvider modifier. Skip THIS leg rather than aborting the whole
		// check: with several L2s, one un-wired chain must not stop the others from
		// syncing (the old single-L2 code returned empty flags for everyone).
		if (gigaRootProvider === ZERO_ADDRESS) {
			d.deployBugDetected = true;
			const msg = `L2WarpToad.gigaRootProvider is 0x0 on ${leg.label}; deploy-bug, run the L2ZkStackWire module`;
			errors.push(msg);
			console.error(`[stale-legs] ${msg}; skipping this leg`);
			continue;
		}

		if (liveLocalRoot !== localRootOnL1) needL2ToL1.push(leg.key);
		// Standalone dispatch: the L2 mirror of gigaRoot lags the L1 source of truth
		// (e.g. a previous cycle's sendGigaRoot to this L2 failed without blocking the
		// rest). A single L2 read tells us.
		if (l2GigaRoot !== currentGigaRoot) dispatchTo.push(leg.key);
	}

	// If any L2-to-L1 leg fires the gigaRoot will change, so dispatch to every leg.
	if (needL2ToL1.length > 0) {
		for (const leg of LEGS) {
			if (!dispatchTo.includes(leg.key) && detail.legs[leg.key].enabled) dispatchTo.push(leg.key);
		}
	}

	const flags: SyncRequirements = {
		needL2ToL1,
		// keep registry order so logs and merges are deterministic
		dispatchTo: LEGS.map((l) => l.key).filter((k) => dispatchTo.includes(k)),
	};

	return { flags, detail };
}

export async function isStale(inputs: StaleLegInputs): Promise<boolean> {
	const { flags } = await computeStaleLegs(inputs);
	return hasAnyRequirement(flags);
}
