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
import type { FullSyncResult } from './bridge/executor.js';
import type { BridgeRequest, BridgeOperation } from './types/index.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '6969');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://warptoad.xyz,https://www.warptoad.xyz,http://localhost:5173,http://localhost:3000').split(',');
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '';
const DEFAULT_CONFIRMATIONS = parseInt(process.env.DEFAULT_CONFIRMATIONS || '3');

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

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    orchestrator: getOrchestratorState(),
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
    note: 'All /bridge/:from/:to requests funnel into a single batched sync cycle. Route params are informational.',
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

  // Attach to orchestrator. This either kicks off a fresh cycle or joins the
  // pending batch. All waiters on the same cycle resolve together.
  requestSync(EVM_PRIVATE_KEY, confirmations)
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
});
