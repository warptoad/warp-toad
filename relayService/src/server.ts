import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { createRelayRouter } from './routes/relay.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '7777');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://warptoad.xyz,http://localhost:5173,http://localhost:3000').split(',');

// Validate required environment variables
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const L1_RPC_URL = process.env.L1_RPC_URL;

if (!RELAYER_PRIVATE_KEY) {
  console.error('ERROR: RELAYER_PRIVATE_KEY environment variable is required');
  process.exit(1);
}

if (!L1_RPC_URL) {
  console.error('ERROR: L1_RPC_URL environment variable is required');
  process.exit(1);
}

// Fee configuration
const MIN_FEE_FACTOR = parseInt(process.env.MIN_FEE_FACTOR || '25'); // 0.25%
const MAX_FEE_FACTOR = parseInt(process.env.MAX_FEE_FACTOR || '500'); // 5%
const MIN_PROFIT_USD = parseFloat(process.env.MIN_PROFIT_USD || '1.0');

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(L1_RPC_URL);
const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

console.log('='.repeat(60));
console.log('WarpToad Relay Service');
console.log('='.repeat(60));
console.log(`Relayer Address: ${wallet.address}`);
console.log(`RPC URL: ${L1_RPC_URL}`);
console.log(`Min Fee: ${MIN_FEE_FACTOR / 100}% (${MIN_FEE_FACTOR} basis points)`);
console.log(`Max Fee: ${MAX_FEE_FACTOR / 100}% (${MAX_FEE_FACTOR} basis points)`);
console.log(`Min Profit: $${MIN_PROFIT_USD} USD`);
console.log('='.repeat(60));

// CORS configuration
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
    timestamp: new Date().toISOString(),
    relayerAddress: wallet.address
  });
});

// Mount relay routes
const relayRouter = createRelayRouter(provider, wallet, {
  minFeeFactor: MIN_FEE_FACTOR,
  maxFeeFactor: MAX_FEE_FACTOR,
  minProfitUsd: MIN_PROFIT_USD
});
app.use('/relay', relayRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /relay/info',
      'POST /relay/withdraw',
      'GET /relay/status/:operationId'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✓ Relay Service running on port ${PORT}`);
  console.log(`✓ Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/relay/info`);
  console.log(`  POST http://localhost:${PORT}/relay/withdraw`);
  console.log(`  GET  http://localhost:${PORT}/relay/status/:operationId`);
  console.log('\n' + '='.repeat(60));
});
