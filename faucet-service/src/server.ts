import express from "express";
import cors from "cors";
import {
	createPublicClient,
	createWalletClient,
	http,
	parseEther,
	type Hex,
	type PublicClient,
	type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, zksyncSepoliaTestnet, type Chain } from "viem/chains";

import { createFaucetRouter } from "./routes/faucet.js";
import { LedgerStore } from "./ledger.js";

// =============================================================================
// .env loader (no dotenv dep - keeps the dep tree tiny)
// =============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(function loadDotEnv() {
	const envFile = path.resolve(__dirname, "../.env");
	if (!fs.existsSync(envFile)) return;
	for (const rawLine of fs.readFileSync(envFile, "utf8").split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 0) continue;
		const key = line.slice(0, eq).trim();
		let val = line.slice(eq + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}
		if (!process.env[key]) process.env[key] = val;
	}
})();

// =============================================================================
// Required env
// =============================================================================

const PORT = parseInt(process.env.PORT || "8888");
const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY as Hex | undefined;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.L1_RPC_URL;
// zkSync Era Sepolia replaced Scroll Sepolia as the L2. Optional: viem's public
// endpoint is a fine default for a faucet's low request volume.
const ZKSYNC_ERA_SEPOLIA_RPC_URL =
	process.env.ZKSYNC_ERA_SEPOLIA_RPC_URL || "https://sepolia.era.zksync.dev";
const DRIP_AMOUNT_ETH = process.env.FAUCET_DRIP_AMOUNT_ETH || "0.05";
const ALLOWED_ORIGINS = (
	process.env.ALLOWED_ORIGINS || "https://warptoad.xyz,http://localhost:5173,http://localhost:4173"
).split(",");
const LEDGER_PATH = process.env.FAUCET_LEDGER_PATH || path.resolve(__dirname, "../db/claims.json");

if (!FAUCET_PRIVATE_KEY) {
	console.error("ERROR: FAUCET_PRIVATE_KEY environment variable is required");
	process.exit(1);
}
if (!SEPOLIA_RPC_URL) {
	console.error("ERROR: SEPOLIA_RPC_URL (or L1_RPC_URL) environment variable is required");
	process.exit(1);
}

// =============================================================================
// viem account + per-chain clients
// =============================================================================

const account = privateKeyToAccount(FAUCET_PRIVATE_KEY);
const dripWei = parseEther(DRIP_AMOUNT_ETH);

export interface ChainBinding {
	chain: Chain;
	publicClient: PublicClient;
	walletClient: WalletClient;
}

function buildBinding(chain: Chain, rpcUrl: string): ChainBinding {
	const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
	const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
	return { chain, publicClient, walletClient };
}

const bindings = new Map<number, ChainBinding>([
	[11155111, buildBinding(sepolia, SEPOLIA_RPC_URL)],
	[300, buildBinding(zksyncSepoliaTestnet, ZKSYNC_ERA_SEPOLIA_RPC_URL)],
]);

// =============================================================================
// Ledger
// =============================================================================

const ledger = new LedgerStore(LEDGER_PATH);

// =============================================================================
// Express
// =============================================================================

const app = express();

app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true);
			if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
			if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
				return callback(null, true);
			}
			callback(new Error(`Origin ${origin} not allowed by CORS`));
		},
		credentials: true,
		methods: ["GET", "POST", "OPTIONS"],
		allowedHeaders: ["Content-Type"],
		maxAge: 86400,
	}),
);
app.use(express.json());

// Health
app.get("/health", async (_req, res) => {
	const balances: Record<string, string> = {};
	for (const [chainId, binding] of bindings.entries()) {
		try {
			const bal = await binding.publicClient.getBalance({ address: account.address });
			balances[chainId.toString()] = bal.toString();
		} catch (err) {
			balances[chainId.toString()] = `error: ${(err as Error).message}`;
		}
	}
	res.json({
		ok: true,
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
		faucetAddress: account.address,
		dripAmountWei: dripWei.toString(),
		dripAmountEth: DRIP_AMOUNT_ETH,
		supportedChains: Array.from(bindings.keys()),
		balances,
		totalClaims: ledger.totalClaims(),
	});
});

// Faucet routes
app.use("/faucet", createFaucetRouter(bindings, ledger, dripWei, account.address));

// 404
app.use((_req, res) => {
	res.status(404).json({
		ok: false,
		error: "Endpoint not found",
		availableEndpoints: ["GET /health", "GET /faucet/info", "POST /faucet/claim"],
	});
});

console.log("=".repeat(60));
console.log("WarpToad Testnet Faucet");
console.log("=".repeat(60));
console.log(`Faucet Address:    ${account.address}`);
console.log(`Drip Amount:       ${DRIP_AMOUNT_ETH} ETH (${dripWei} wei)`);
console.log(`Supported Chains:  ${Array.from(bindings.keys()).join(", ")}`);
console.log(`Ledger:            ${LEDGER_PATH}`);
console.log(`Total Claims:      ${ledger.totalClaims()}`);
console.log("=".repeat(60));

app.listen(PORT, () => {
	console.log(`\n✓ Faucet running on port ${PORT}`);
	console.log(`✓ Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
	console.log("\nEndpoints:");
	console.log(`  GET  http://localhost:${PORT}/health`);
	console.log(`  GET  http://localhost:${PORT}/faucet/info?address=0x...`);
	console.log(`  POST http://localhost:${PORT}/faucet/claim`);
	console.log("\n" + "=".repeat(60));
});
