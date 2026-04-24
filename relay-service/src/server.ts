import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, scrollSepolia, anvil, type Chain } from 'viem/chains';
import { createRelayRouter } from './routes/relay.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '7777');
const ALLOWED_ORIGINS = (
	process.env.ALLOWED_ORIGINS ||
	'https://warptoad.xyz,http://localhost:5173,http://localhost:3000'
).split(',');

// ----- Required env -----
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
const L1_RPC_URL = process.env.L1_RPC_URL;
const SCROLL_RPC_URL = process.env.SCROLL_RPC_URL;

if (!RELAYER_PRIVATE_KEY) {
	console.error('ERROR: RELAYER_PRIVATE_KEY environment variable is required');
	process.exit(1);
}
if (!L1_RPC_URL) {
	console.error('ERROR: L1_RPC_URL environment variable is required');
	process.exit(1);
}
if (!SCROLL_RPC_URL) {
	console.error('ERROR: SCROLL_RPC_URL environment variable is required');
	process.exit(1);
}

// ----- Optional fee config -----
// All default to 0 = altruistic relayer (testnet demo).
const MIN_FEE_FACTOR = parseInt(process.env.MIN_FEE_FACTOR || '0');
const MAX_FEE_FACTOR = parseInt(process.env.MAX_FEE_FACTOR || '0');
const MIN_PROFIT_USD = parseFloat(process.env.MIN_PROFIT_USD || '0');

// ----- viem account + per-chain clients -----
const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);

interface ChainBinding {
	chain: Chain;
	publicClient: PublicClient;
	walletClient: WalletClient;
}

function buildBinding(chain: Chain, rpcUrl: string): ChainBinding {
	const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
	const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
	return { chain, publicClient, walletClient };
}

// Sepolia + local anvil share the L1 RPC; Scroll Sepolia uses its own.
const l1Binding = buildBinding(sepolia, L1_RPC_URL);
const anvilBinding = buildBinding(anvil, L1_RPC_URL);
const scrollBinding = buildBinding(scrollSepolia, SCROLL_RPC_URL);

const bindings = new Map<number, ChainBinding>([
	[11155111, l1Binding],
	[31337, anvilBinding],
	[534351, scrollBinding],
]);

console.log('='.repeat(60));
console.log('WarpToad Multi-Chain Relay Service');
console.log('='.repeat(60));
console.log(`Relayer Address: ${account.address}`);
console.log(`L1 RPC URL: ${L1_RPC_URL}`);
console.log(`Scroll RPC URL: ${SCROLL_RPC_URL}`);
console.log(`Fee bounds: min=${MIN_FEE_FACTOR}, max=${MAX_FEE_FACTOR} (0 = altruistic)`);
console.log(`Supported chains: ${Array.from(bindings.keys()).join(', ')}`);
console.log('='.repeat(60));

// ----- CORS -----
app.use(
	cors({
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
	}),
);
app.use(express.json());

// ----- Health -----
app.get('/health', (_req, res) => {
	res.json({
		ok: true,
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
		relayerAddress: account.address,
		supportedChains: Array.from(bindings.keys()),
	});
});

// ----- Relay routes -----
const relayRouter = createRelayRouter(bindings, {
	minFeeFactor: MIN_FEE_FACTOR,
	maxFeeFactor: MAX_FEE_FACTOR,
	minProfitUsd: MIN_PROFIT_USD,
});
app.use('/relay', relayRouter);

// ----- 404 -----
app.use((_req, res) => {
	res.status(404).json({
		ok: false,
		error: 'Endpoint not found',
		availableEndpoints: [
			'GET /health',
			'GET /relay/info',
			'POST /relay/withdraw',
			'GET /relay/status/:operationId',
		],
	});
});

app.listen(PORT, () => {
	console.log(`\n✓ Relay Service running on port ${PORT}`);
	console.log(`✓ Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
	console.log('\nEndpoints:');
	console.log(`  GET  http://localhost:${PORT}/health`);
	console.log(`  GET  http://localhost:${PORT}/relay/info`);
	console.log(`  POST http://localhost:${PORT}/relay/withdraw`);
	console.log(`  GET  http://localhost:${PORT}/relay/status/:operationId`);
	console.log('\n' + '='.repeat(60));
});

export type { ChainBinding };
