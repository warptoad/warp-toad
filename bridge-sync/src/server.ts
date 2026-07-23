import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import {
  isValidChainId,
  isValidRoute,
  getSupportedChains,
  getSupportedRoutes,
  getExpectedBridgeDuration,
} from './bridge/chainMapper.js';
import { requestSync, getOrchestratorState } from './bridge/syncOrchestrator.js';
import { routeToRequirements } from './bridge/syncRequirements.js';
import type { FullSyncResult } from './bridge/executor.js';
import { LEGS, legRpcUrl, zkStackLegs } from './bridge/legRegistry.js';
import { proxyUpstreams, forwardToUpstreams, RETRYABLE_UPSTREAM_STATUS } from './bridge/rpcProxy.js';
import type { BridgeRequest, BridgeOperation } from './types/index.js';
import { fetchGigaState } from './bridge/gigaState.js';
import { fetchBurnLeaves } from './bridge/burnLeaves.js';
import { startAztecHeartbeat, getHeartbeatState } from './bridge/aztecHeartbeat.js';
import { computeStaleLegs, buildStaleLegInputs } from './bridge/staleLegs.js';
import { loadAll, saveOperation } from './bridge/operationsStore.js';
import {
  startScheduler,
  enqueueOperation,
  getSchedulerState,
} from './bridge/unifiedScheduler.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '6969');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://warptoad.xyz,https://www.warptoad.xyz,http://localhost:5173,http://localhost:3000').split(',');
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '';
const DEFAULT_CONFIRMATIONS = parseInt(process.env.DEFAULT_CONFIRMATIONS || '3');

// Aztec heartbeat config. Defaults target the testnet node's ~100-block retention:
// check every 5 min, push once the L1-anchored aztec block is >80 blocks behind
// the aztec head (20-block safety margin). Set AZTEC_HEARTBEAT_ENABLED=false to
// opt out (e.g. when running a second bridge-sync instance that shouldn't push).
const AZTEC_HEARTBEAT_ENABLED = (process.env.AZTEC_HEARTBEAT_ENABLED ?? 'true').toLowerCase() !== 'false';
const AZTEC_HEARTBEAT_CHECK_INTERVAL_MS = parseInt(process.env.AZTEC_HEARTBEAT_CHECK_INTERVAL_MS || '300000');
const AZTEC_HEARTBEAT_THRESHOLD_BLOCKS = parseInt(process.env.AZTEC_HEARTBEAT_THRESHOLD_BLOCKS || '80');
const AZTEC_HEARTBEAT_RETENTION_BLOCKS = parseInt(process.env.AZTEC_HEARTBEAT_RETENTION_BLOCKS || '100');

// Unified scheduler feature flag. When true, POST /bridge/:from/:to and the
// idle-cadence convergence loop go through unifiedScheduler (which subsumes
// the heartbeat). When false, the legacy syncOrchestrator + aztecHeartbeat
// path stays in charge. Last fully-revertible step of the rollout; once
// flipped to true in production, watch /health.scheduler before flipping
// back.
const BRIDGE_SYNC_USE_UNIFIED_SCHEDULER = (process.env.BRIDGE_SYNC_USE_UNIFIED_SCHEDULER ?? 'false').toLowerCase() === 'true';
const BRIDGE_SYNC_COALESCE_WINDOW_MS = parseInt(process.env.BRIDGE_SYNC_COALESCE_WINDOW_MS || '90000');

if (!EVM_PRIVATE_KEY) {
  console.error('ERROR: EVM_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

// Operation state, persisted across restarts so the multi-hour L2-finalization
// wait survives a container rebuild. Each HTTP request gets its own
// operationId, but many operationIds end up attached to the same scheduler
// tick. The map is the source of truth in memory; saveOperation writes a
// debounced snapshot to disk on every mutation.
const operations = loadAll();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '2mb' }));

/**
 * JSON-RPC proxy.
 *
 * The frontend talks to the user's wallet for *signing* (window.ethereum) but
 * uses a plain viem publicClient for reads (getLogs, readContract, etc.). If
 * we point that publicClient directly at Infura, the key ends up in the URL
 * visible in devtools Network tab AND any viem HttpRequestError thrown into
 * console. Routing read traffic through here keeps the key server-side.
 *
 * We allowlist only the read methods the frontend actually uses; anything
 * else (sendTransaction, admin_*, debug_*) is rejected so this endpoint can't
 * be abused as a free generic RPC. Wallets keep using their own provider for
 * writes, so nothing legitimate needs write methods here.
 */
const RPC_METHOD_ALLOWLIST = new Set([
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getLogs',
  'eth_call',
  'eth_chainId',
  'eth_gasPrice',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_feeHistory',
  'eth_maxPriorityFeePerGas',
  'net_version',
]);

// Proxy targets, keyed by a URL-safe alias. L1 is fixed; the L2 entries are generated
// from the leg registry so a new chain gets a proxy route without editing this map.
// ZK Stack legs are addressable by chain id (e.g. /rpc/300) and by slug.
const RPC_UPSTREAMS: Record<string, string[]> = {
  sepolia: proxyUpstreams(['SEPOLIA_RPC_URL'], process.env.SEPOLIA_RPC_URL),
  ...Object.fromEntries(
    zkStackLegs().flatMap((leg) => {
      let url: string | undefined;
      try {
        url = legRpcUrl(leg);
      } catch {
        url = undefined;
      }
      const upstreams = proxyUpstreams(leg.rpcEnvVars, url);
      const slug = leg.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return [[leg.key, upstreams], [slug, upstreams]];
    }),
  ),
};

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
}

function rpcError(id: number | string | null | undefined, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

app.post('/rpc/:chain', async (req, res) => {
  const chain = req.params.chain;
  const upstreams = RPC_UPSTREAMS[chain];
  if (!upstreams || upstreams.length === 0) {
    return res.status(404).json({ ok: false, error: `Unknown RPC chain: ${chain}` });
  }

  // Accept both a single JSON-RPC call and viem's batch form (array of calls).
  const body = req.body as JsonRpcRequest | JsonRpcRequest[];
  const batch = Array.isArray(body) ? body : [body];
  for (const call of batch) {
    if (!call || typeof call.method !== 'string') {
      return res.status(400).json(rpcError(call?.id, -32600, 'Invalid JSON-RPC request'));
    }
    if (!RPC_METHOD_ALLOWLIST.has(call.method)) {
      return res.status(403).json(rpcError(call.id, -32601, `Method not allowed: ${call.method}`));
    }
  }

  // We deliberately do NOT forward the upstream URL in any header, so the key
  // never reaches the browser.
  const { status, text } = await forwardToUpstreams(upstreams, body, (msg) =>
    console.error(`[rpc-proxy] ${chain} upstream error:`, msg),
  );

  if (text === null) {
    return res.status(502).json(rpcError(null, -32603, 'Upstream RPC error'));
  }
  if (RETRYABLE_UPSTREAM_STATUS.has(status) && upstreams.length > 1) {
    console.warn(`[rpc-proxy] ${chain}: all ${upstreams.length} upstreams failed (last status ${status})`);
  }
  res.status(status).type('application/json').send(text);
});

/**
 * Returns a snapshot of the L1 GigaBridge state: current gigaRoot + the
 * current leaf (local root + block number) for every registered provider.
 *
 * The frontend's merkle-proof builder used to recover this by scanning
 * ReceivedNewLocalRoot events from deployment → head on every withdraw,
 * which routinely tripped rate limits. This endpoint replaces that with a
 * handful of contract reads (cached 5 s). Users who opted into a custom
 * RPC via the wallet settings bypass it and do the scan client-side.
 */
app.get('/giga-state/:chainId', async (req, res) => {
  const { chainId } = req.params;
  if (!isValidChainId(chainId)) {
    return res.status(400).json({ ok: false, error: `Invalid chain ID: ${chainId}` });
  }
  try {
    const state = await fetchGigaState(chainId);
    res.json({ ok: true, ...state });
  } catch (err: any) {
    console.error(`[giga-state] error for chain ${chainId}:`, err);
    res.status(502).json({ ok: false, error: err?.message ?? 'Failed to fetch giga state' });
  }
});

/**
 * TESTNET-CONVENIENCE burn-leaf snapshot for the frontend's EVM merkle-path
 * builder. Returns the full ordered leaf set for a block range so the client
 * builds its own path locally (the server never sees which commitment). The
 * client recomputes the local root and falls back to its own scan on mismatch,
 * so this is a pure RPC-cost optimization, never a correctness/liveness
 * dependency. Safe to remove for mainnet.
 */
app.get('/burn-leaves/:chainId/:warpToadAddress', async (req, res) => {
  const { chainId, warpToadAddress } = req.params;
  if (!isValidChainId(chainId)) {
    return res.status(400).json({ ok: false, error: `Invalid chain ID: ${chainId}` });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(warpToadAddress)) {
    return res.status(400).json({ ok: false, error: `Invalid address: ${warpToadAddress}` });
  }
  let fromBlock: bigint;
  let toBlock: bigint;
  try {
    fromBlock = BigInt((req.query.fromBlock as string) ?? '0');
    toBlock = BigInt((req.query.toBlock as string) ?? '0');
  } catch {
    return res.status(400).json({ ok: false, error: 'fromBlock/toBlock must be integers' });
  }
  try {
    const snap = await fetchBurnLeaves(chainId, warpToadAddress, fromBlock, toBlock);
    res.json({ ok: true, ...snap });
  } catch (err: any) {
    console.error(`[burn-leaves] error for chain ${chainId}:`, err?.message ?? err);
    res.status(502).json({ ok: false, error: err?.message ?? 'Failed to fetch burn leaves' });
  }
});

/**
 * Read-only debug endpoint: returns the live "what would the unified scheduler
 * decide to run right now?" report. No side effects, no L1 tx, no aztec push.
 *
 * Surfaces the same flags + observability detail the scheduler will use once
 * it's wired in step 4 of the rollout. Useful during the additive deployment
 * to verify the staleness algorithm against reality before trusting it as the
 * trigger source.
 */
app.get('/debug/stale-legs', async (_req, res) => {
  try {
    const report = await computeStaleLegs(buildStaleLegInputs());
    res.json({ ok: true, ...report });
  } catch (err: any) {
    console.error('[debug/stale-legs] unexpected error:', err);
    res.status(500).json({ ok: false, error: err?.message ?? 'computeStaleLegs threw' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mode: BRIDGE_SYNC_USE_UNIFIED_SCHEDULER ? 'scheduler' : 'orchestrator',
    orchestrator: getOrchestratorState(),
    heartbeat: getHeartbeatState(),
    scheduler: getSchedulerState(),
    operations: { tracked: operations.size },
  });
});

app.get('/config', (req, res) => {
  const chains = getSupportedChains();
  const routes = getSupportedRoutes();
  res.json({
    ok: true,
    supportedChains: chains.map(c => ({ id: c.id, name: c.name, type: c.type })),
    supportedRoutes: routes,
    port: PORT,
    note: 'Each /bridge/:from/:to request triggers only the sync sub-tasks needed for its route. Concurrent requests are batched.',
  });
});

/**
 * Flatten a FullSyncResult into the flat txHashes map the frontend polls for.
 * Values are 'N/A' when a leg was skipped (e.g. its RPC URL isn't configured).
 *
 * Keys are generated per leg (`<legKey>SendRootToL1`, ...) rather than hardcoded, so a
 * new L2 shows up in the response without touching this function. The 'aztec' prefix
 * is unchanged; ZK Stack legs are keyed by chain id, e.g. `300SendRootToL1`.
 */
function resultToTxHashes(r: FullSyncResult): Record<string, string> {
  const out: Record<string, string> = {
    updateGigaRoot: r.updateGigaRootTxHash,
    sendGigaRoot: r.sendGigaRootTxHash,
  };
  for (const leg of LEGS) {
    const res = r.legs?.[leg.key] ?? null;
    out[`${leg.key}SendRootToL1`] = res?.sendRootToL1TxHash || 'N/A';
    out[`${leg.key}ReceiveGigaRoot`] = res?.receiveGigaRootTxHash || 'N/A';
    if (leg.kind === 'aztec') out[`${leg.key}RefreshRoot`] = res?.refreshRootTxHash || 'N/A';
  }
  return out;
}

app.post('/bridge/:fromChainId/:toChainId', async (req, res) => {
  const { fromChainId, toChainId } = req.params;
  const body: BridgeRequest = req.body || {};

  if (!isValidChainId(fromChainId)) {
    return res.status(400).json({ ok: false, error: `Invalid source chain ID: ${fromChainId}` });
  }
  if (!isValidChainId(toChainId)) {
    return res.status(400).json({ ok: false, error: `Invalid destination chain ID: ${toChainId}` });
  }
  if (!isValidRoute(fromChainId, toChainId)) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported bridge route: ${fromChainId} -> ${toChainId}`,
    });
  }

  const operationId = randomUUID();
  const confirmations = body.confirmations || DEFAULT_CONFIRMATIONS;
  const operation: BridgeOperation = {
    operationId,
    fromChainId,
    toChainId,
    status: 'pending',
    startTime: Date.now(),
    confirmations,
  };
  operations.set(operationId, operation);
  saveOperation(operation);

  // Branch on the feature flag. The scheduler path computes staleness
  // on-chain and runs only stale legs (subsuming routeToRequirements +
  // aztecHeartbeat). The legacy path stays available for one-flag rollback.
  const syncPromise = BRIDGE_SYNC_USE_UNIFIED_SCHEDULER
    ? enqueueOperation(operationId, { from: fromChainId, to: toChainId })
    : (() => {
        const requirements = routeToRequirements(fromChainId, toChainId);
        return requestSync(EVM_PRIVATE_KEY, confirmations, requirements);
      })();

  syncPromise
    .then((result) => {
      operation.status = 'completed';
      operation.endTime = Date.now();
      operation.txHashes = resultToTxHashes(result);
      saveOperation(operation);
    })
    .catch((error) => {
      operation.status = 'failed';
      operation.endTime = Date.now();
      operation.error = String(error);
      saveOperation(operation);
      console.error(`Bridge operation ${operationId} failed:`, error);
    });

  const expectedDuration = getExpectedBridgeDuration(fromChainId, toChainId);
  return res.json({
    ok: true,
    operationId,
    status: 'pending',
    message: `Sync queued (${fromChainId} -> ${toChainId}). Route params are informational; every request triggers a full cross-chain root sync.`,
    expectedDuration,
    note: 'Poll /status/:operationId to check progress.',
  });
});

app.get('/status/:operationId', (req, res) => {
  const { operationId } = req.params;
  const operation = operations.get(operationId);
  if (!operation) {
    return res.status(404).json({ ok: false, error: 'Operation not found' });
  }
  res.json({ ok: true, ...operation });
});

app.listen(PORT, () => {
  console.log(`BridgeKeeper running on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`\nSupported routes:`);
  getSupportedRoutes().forEach(route => {
    console.log(`  ${route.from} -> ${route.to}`);
  });
  if (BRIDGE_SYNC_USE_UNIFIED_SCHEDULER) {
    console.log(`\nAll routes funnel through the unified scheduler (coalescing single-slot ticker, staleness-driven).`);
    startScheduler({
      privateKey: EVM_PRIVATE_KEY,
      confirmations: DEFAULT_CONFIRMATIONS,
      idleIntervalMs: AZTEC_HEARTBEAT_CHECK_INTERVAL_MS,
      coalesceWindowMs: BRIDGE_SYNC_COALESCE_WINDOW_MS,
    });
    if (AZTEC_HEARTBEAT_ENABLED) {
      console.log('[heartbeat] superseded by unified scheduler; legacy heartbeat NOT started');
    }
  } else {
    console.log(`\nAll routes funnel through the sync orchestrator (batched cross-chain root sync).`);
    if (AZTEC_HEARTBEAT_ENABLED) {
      startAztecHeartbeat({
        privateKey: EVM_PRIVATE_KEY,
        confirmations: DEFAULT_CONFIRMATIONS,
        checkIntervalMs: AZTEC_HEARTBEAT_CHECK_INTERVAL_MS,
        pushThresholdBlocks: AZTEC_HEARTBEAT_THRESHOLD_BLOCKS,
        retentionBlocks: AZTEC_HEARTBEAT_RETENTION_BLOCKS,
      });
    } else {
      console.log('[heartbeat] disabled via AZTEC_HEARTBEAT_ENABLED=false');
    }
  }
});
