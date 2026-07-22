/**
 * Aztec root heartbeat.
 *
 * The Aztec testnet node prunes world state past ~100 blocks, so a proof
 * built against an old L1-committed aztec root fails at withdraw time with
 * "block hash not found in world state" / "Unable to find sibling path".
 * The fix is simply to keep the L1-committed root fresh: push a new aztec
 * local root before the currently-anchored block ages out.
 *
 * Smart vs dumb heartbeat: a naive "push every N minutes" burns L1 gas
 * during idle hours. Instead we read `L1AztecBridgeAdapter.
 * mostRecentL2RootBlockNumber` and compare it to the current aztec head.
 * If the lag exceeds the push threshold we request a sync; otherwise we
 * do nothing. User-driven bridges already refresh the anchor as a side
 * effect, so a busy day costs nothing extra here - heartbeat fires only
 * during quiet periods.
 *
 * The sync is dispatched via the existing `requestSync`, which means it
 * naturally batches with any in-flight user cycle and reuses the cached
 * Aztec wallet inside the executor.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, type Address } from 'viem';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getChainConfig } from './chainMapper.js';
import { requestSync } from './syncOrchestrator.js';
import { AZTEC_LEG, legRpcUrl, zkStackLegs } from './legRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..', '..', '..', 'backend');

const MOST_RECENT_BLOCK_ABI = [
  {
    type: 'function',
    name: 'mostRecentL2RootBlockNumber',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

function loadAztecAdapterAddress(l1ChainId: bigint): Address {
  const file = path.join(
    BACKEND_DIR,
    'deploy',
    'ignition',
    'deployments',
    `chain-${l1ChainId.toString()}`,
    'deployed_addresses.json',
  );
  if (!fs.existsSync(file)) {
    throw new Error(`[heartbeat] no ignition deployment at ${file}`);
  }
  const addrs = JSON.parse(fs.readFileSync(file, 'utf8'));
  const addr = addrs['L1InfraModule#L1AztecBridgeAdapter'];
  if (!addr) {
    throw new Error(`[heartbeat] L1AztecBridgeAdapter address missing for chain ${l1ChainId}`);
  }
  return addr as Address;
}

export interface HeartbeatState {
  enabled: boolean;
  lastCheckedAtMs: number | null;
  lastAztecHead: number | null;
  lastL1Anchored: number | null;
  lastLag: number | null;
  lastPushAtMs: number | null;
  checksRun: number;
  pushesTriggered: number;
  pushesFailed: number;
}

const state: HeartbeatState = {
  enabled: false,
  lastCheckedAtMs: null,
  lastAztecHead: null,
  lastL1Anchored: null,
  lastLag: null,
  lastPushAtMs: null,
  checksRun: 0,
  pushesTriggered: 0,
  pushesFailed: 0,
};

export function getHeartbeatState(): HeartbeatState {
  return { ...state };
}

export interface AztecHeartbeatConfig {
  privateKey: string;
  confirmations: number;
  /** How often to sample aztec head vs L1 anchor. */
  checkIntervalMs: number;
  /** Push when (aztecHead - L1Anchored) exceeds this. Should be < retentionBlocks. */
  pushThresholdBlocks: number;
  /** Informational; used for startup log only. Pruning is enforced by the aztec node. */
  retentionBlocks: number;
}

/**
 * Start the heartbeat. Returns a stop() function so callers (e.g. tests) can
 * shut it down cleanly. Returns a no-op stop() if the heartbeat can't run in
 * this environment (missing AZTEC_NODE_URL, sandbox L1, etc).
 */
export function startAztecHeartbeat(config: AztecHeartbeatConfig): () => void {
  const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
  const aztecNodeUrl = process.env.AZTEC_NODE_URL;
  if (!aztecNodeUrl) {
    console.log('[heartbeat] disabled: AZTEC_NODE_URL not set');
    return () => {};
  }

  const l1ChainId = BigInt(l1ChainIdStr);
  if (l1ChainId === 31337n) {
    // Sandbox aztec node doesn't have the testnet's aggressive retention, so
    // the heartbeat has no work to do. Skip to avoid noisy logs.
    console.log('[heartbeat] disabled: sandbox L1 (chainId=31337) does not need retention guarding');
    return () => {};
  }

  let l1ChainConfig;
  let aztecAdapterAddress: Address;
  try {
    l1ChainConfig = getChainConfig(l1ChainIdStr);
    aztecAdapterAddress = loadAztecAdapterAddress(l1ChainId);
  } catch (e) {
    console.error('[heartbeat] failed to initialize, disabling:', e);
    return () => {};
  }

  const l1PublicClient = createPublicClient({ transport: http(l1ChainConfig.rpcUrl) });
  const aztecNode = createAztecNodeClient(aztecNodeUrl);

  // Only dispatch to a ZK Stack leg if its RPC is configured - otherwise the executor
  // throws on that leg's setup step and the aztec push never runs. The heartbeat
  // prioritizes keeping aztec alive.
  const dispatchableZkStackLegs = zkStackLegs().filter((leg) => {
    try {
      legRpcUrl(leg);
      return true;
    } catch {
      console.log(`[heartbeat] no RPC configured for ${leg.label} - heartbeat cycles will not dispatch to it`);
      return false;
    }
  });

  let running = false;
  let stopped = false;

  async function tick() {
    // Re-entrancy guard: a sync cycle can take 30-90 min on testnet; don't
    // stack checks on top of a running cycle.
    if (stopped || running) return;
    running = true;
    try {
      state.checksRun += 1;
      state.lastCheckedAtMs = Date.now();

      const [l1AnchoredRaw, aztecHeadRaw] = await Promise.all([
        l1PublicClient.readContract({
          address: aztecAdapterAddress,
          abi: MOST_RECENT_BLOCK_ABI,
          functionName: 'mostRecentL2RootBlockNumber',
        }),
        aztecNode.getBlockNumber(),
      ]);
      const l1Anchored = Number(l1AnchoredRaw as bigint);
      const aztecHead = Number(aztecHeadRaw);
      const lag = aztecHead - l1Anchored;

      state.lastAztecHead = aztecHead;
      state.lastL1Anchored = l1Anchored;
      state.lastLag = lag;

      // l1Anchored === 0 means the adapter has never received a push. That
      // can happen on a freshly-deployed chain; treat it as "definitely push".
      const needsPush = l1Anchored === 0 || lag > config.pushThresholdBlocks;
      console.log(
        `[heartbeat] aztecHead=${aztecHead} L1Anchored=${l1Anchored} lag=${lag} ` +
        `threshold=${config.pushThresholdBlocks} retention~=${config.retentionBlocks}` +
        `${needsPush ? ' → triggering sync' : ''}`,
      );
      if (!needsPush) return;

      state.pushesTriggered += 1;
      const before = Date.now();
      try {
        await requestSync(config.privateKey, config.confirmations, {
          needL2ToL1: [AZTEC_LEG],
          // Dispatching the fresh root onward to the ZK Stack legs is cheap (an
          // L1->L2 message), so include them when they're behind.
          dispatchTo: [AZTEC_LEG, ...dispatchableZkStackLegs.map((l) => l.key)],
        });
        state.lastPushAtMs = Date.now();
        console.log(`[heartbeat] push completed in ${Math.round((Date.now() - before) / 1000)}s`);
      } catch (e) {
        state.pushesFailed += 1;
        console.error(`[heartbeat] push failed after ${Math.round((Date.now() - before) / 1000)}s:`, e);
      }
    } catch (e) {
      console.error('[heartbeat] tick failed:', e);
    } finally {
      running = false;
    }
  }

  state.enabled = true;

  // Stagger the first check so the server.listen startup log isn't buried.
  const initialTimer = setTimeout(tick, 5_000);
  const interval = setInterval(tick, config.checkIntervalMs);

  console.log(
    `[heartbeat] started: checking every ${Math.round(config.checkIntervalMs / 1000)}s, ` +
    `push when lag > ${config.pushThresholdBlocks} blocks (retention~=${config.retentionBlocks})`,
  );

  return () => {
    stopped = true;
    state.enabled = false;
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
