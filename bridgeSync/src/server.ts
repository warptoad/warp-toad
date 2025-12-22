import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { 
  getChainConfig, 
  isValidChainId, 
  isValidRoute, 
  getSupportedChains, 
  getSupportedRoutes,
  getBridgeTimeout,
  getExpectedBridgeDuration,
  MAX_TIMEOUT
} from './bridge/chainMapper.js';
import { executeBridge as executeBridgeOperation } from './bridge/executor.js';
import type { BridgeRequest, BridgeOperation } from './types/index.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '6969');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://warptoad.xyz,http://localhost:5173,http://localhost:3000').split(',');
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || '';

if (!EVM_PRIVATE_KEY) {
  console.error('ERROR: EVM_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

// In-memory storage (replace with SQLite later)
const operations = new Map<string, BridgeOperation>();
const locks = new Set<string>();

// CORS configuration - must be applied before other middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow localhost with any port for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get configuration
app.get('/config', (req, res) => {
  const chains = getSupportedChains();
  const routes = getSupportedRoutes();
  
  res.json({
    ok: true,
    supportedChains: chains.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type
    })),
    supportedRoutes: routes,
    port: PORT
  });
});

// Bridge operation
app.post('/bridge/:fromChainId/:toChainId', async (req, res) => {
  const { fromChainId, toChainId } = req.params;
  const body: BridgeRequest = req.body || {};
  
  // Validate chain IDs
  if (!isValidChainId(fromChainId)) {
    return res.status(400).json({ ok: false, error: `Invalid source chain ID: ${fromChainId}` });
  }
  if (!isValidChainId(toChainId)) {
    return res.status(400).json({ ok: false, error: `Invalid destination chain ID: ${toChainId}` });
  }
  
  // Validate route
  if (!isValidRoute(fromChainId, toChainId)) {
    return res.status(400).json({ 
      ok: false, 
      error: `Unsupported bridge route: ${fromChainId} -> ${toChainId}` 
    });
  }
  
  // Check for lock (prevent concurrent operations on same route)
  const routeKey = `${fromChainId}:${toChainId}`;
  if (locks.has(routeKey)) {
    return res.status(409).json({
      ok: false,
      error: `Bridge operation already in progress for route: ${fromChainId} -> ${toChainId}`
    });
  }
  
  // Create operation
  const operationId = randomUUID();
  const operation: BridgeOperation = {
    operationId,
    fromChainId,
    toChainId,
    status: 'pending',
    startTime: Date.now(),
    confirmations: body.confirmations || parseInt(process.env.DEFAULT_CONFIRMATIONS || '3')
  };
  
  operations.set(operationId, operation);
  locks.add(routeKey);
  
  // Start bridge operation asynchronously
  executeBridgeOperation(operationId, fromChainId, toChainId, EVM_PRIVATE_KEY, operation.confirmations)
    .then((result) => {
      const op = operations.get(operationId);
      if (op) {
        op.status = 'completed';
        op.endTime = Date.now();
        op.txHashes = {
          sendRootToL1: result.sendRootToL1TxHash || 'N/A',
          updateGigaRoot: result.updateGigaRootTxHash || 'N/A',
          sendGigaRoot: result.sendGigaRootTxHash || 'N/A',
        };
      }
      locks.delete(routeKey);
    })
    .catch((error) => {
      const op = operations.get(operationId);
      if (op) {
        op.status = 'failed';
        op.endTime = Date.now();
        op.error = String(error);
      }
      locks.delete(routeKey);
      console.error(`Bridge operation ${operationId} failed:`, error);
    });
  
  // Return immediately or wait based on request
  if (body.waitForCompletion) {
    // Get route-specific timeout or use custom timeout (capped at MAX_TIMEOUT)
    const routeTimeout = getBridgeTimeout(fromChainId, toChainId);
    const customTimeout = body.timeoutMs ? Math.min(body.timeoutMs, MAX_TIMEOUT) : routeTimeout;
    const timeout = customTimeout;
    
    const expectedDuration = getExpectedBridgeDuration(fromChainId, toChainId);
    console.log(`[${operationId}] Expected duration: ${expectedDuration}`);
    console.log(`[${operationId}] Timeout set to: ${(timeout / 60000).toFixed(0)} minutes`);
    
    const startTime = Date.now();
    
    while (operation.status === 'pending' || operation.status === 'running') {
      if (Date.now() - startTime > timeout) {
        operation.status = 'timeout';
        locks.delete(routeKey);
        return res.status(408).json({
          ok: false,
          operationId,
          status: 'timeout',
          error: `Operation timed out after ${(timeout / 60000).toFixed(0)} minutes. Expected duration: ${expectedDuration}.`,
          expectedDuration
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return res.json({
      ok: operation.status === 'completed',
      operationId,
      status: operation.status,
      txHashes: operation.txHashes,
      error: operation.error
    });
  } else {
    // Return immediately with expected duration info
    const expectedDuration = getExpectedBridgeDuration(fromChainId, toChainId);
    return res.json({
      ok: true,
      operationId,
      status: 'pending',
      message: `Bridge operation queued: ${fromChainId} -> ${toChainId}`,
      expectedDuration,
      note: 'Poll /status/:operationId to check progress. Do not use waitForCompletion for production.'
    });
  }
});

// Get operation status
app.get('/status/:operationId', (req, res) => {
  const { operationId } = req.params;
  const operation = operations.get(operationId);
  
  if (!operation) {
    return res.status(404).json({ ok: false, error: 'Operation not found' });
  }
  
  res.json({
    ok: true,
    ...operation
  });
});

// Note: executeBridge is now imported from ./bridge/executor.ts

// Start server
app.listen(PORT, () => {
  console.log(`BridgeKeeper running on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`CORS: Enabled with origin validation`);
  console.log(`\nSupported routes:`);
  getSupportedRoutes().forEach(route => {
    console.log(`  ${route.from} -> ${route.to}`);
  });
});
