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
import type { BridgeRequest, BridgeOperation } from './types/index.js';
import { fetchGigaState } from './bridge/gigaState.js';
import { startAztecHeartbeat, getHeartbeatState } from './bridge/aztecHeartbeat.js';

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

if (!EVM_PRIVATE_KEY) {
  console.error('ERROR: EVM_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

// In-memory operation state. Each HTTP request gets its own operationId, but
// many operationIds end up attached to the same orchestrator cycle.
const operations = new Map<string, BridgeOperation>();

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

const RPC_UPSTREAMS: Record<string, string | undefined> = {
  sepolia: process.env.SEPOLIA_RPC_URL,
  'scroll-sepolia': process.env.SCROLL_RPC_URL,
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
  const upstream = RPC_UPSTREAMS[chain];
  if (!upstream) {
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

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstreamRes.text();
    // Pass through the upstream status so the client still sees 429 on rate
    // limits (viem respects Retry-After). We deliberately do NOT forward the
    // upstream URL in any header, so the key never reaches the browser.
    res.status(upstreamRes.status).type('application/json').send(text);
  } catch (err: any) {
    // Scrub: err.message from node-fetch / undici can contain the upstream URL.
    const msg = typeof err?.message === 'string' ? err.message.replace(/https?:\/\/\S+/g, '<upstream>') : 'upstream fetch failed';
    console.error(`[rpc-proxy] ${chain} upstream error:`, msg);
    res.status(502).json(rpcError(null, -32603, 'Upstream RPC error'));
  }
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

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    orchestrator: getOrchestratorState(),
    heartbeat: getHeartbeatState(),
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
 * Values are 'N/A' when a leg was skipped (e.g. missing SCROLL_RPC_URL).
 */
function resultToTxHashes(r: FullSyncResult): Record<string, string> {
  return {
    aztecSendRootToL1: r.aztec?.sendRootToL1TxHash || 'N/A',
    aztecRefreshRoot: r.aztec?.refreshRootTxHash || 'N/A',
    aztecReceiveGigaRoot: r.aztec?.receiveGigaRootTxHash || 'N/A',
    scrollSendRootToL1: r.scroll?.sendRootToL1TxHash || 'N/A',
    scrollReceiveGigaRoot: r.scroll?.receiveGigaRootTxHash || 'N/A',
    updateGigaRoot: r.updateGigaRootTxHash,
    sendGigaRoot: r.sendGigaRootTxHash,
  };
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

  // Derive the minimal work this route needs, then hand off to the
  // orchestrator. If a cycle is already running, our requirements get OR'd
  // into its batch; otherwise we kick off a fresh one.
  const requirements = routeToRequirements(fromChainId, toChainId);
  requestSync(EVM_PRIVATE_KEY, confirmations, requirements)
    .then((result) => {
      operation.status = 'completed';
      operation.endTime = Date.now();
      operation.txHashes = resultToTxHashes(result);
    })
    .catch((error) => {
      operation.status = 'failed';
      operation.endTime = Date.now();
      operation.error = String(error);
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
});
