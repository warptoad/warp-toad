/**
 * Manual L1 -> Aztec gigaRoot sync for testnet (Sepolia <-> Aztec testnet).
 *
 * Same flow as `syncLocal.ts` but reads from the testnet deployment files
 * (chain-11155111 + aztecDeployments/11155111) and pulls config from
 * `backend/.env` instead of using sandbox defaults.
 *
 * Skips the L2->L1 root bridging step that `bridgeBetweenL1AndL2` does
 * because the Aztec testnet prover lags real time and that step times out.
 * For the L1->Aztec direction we don't need a fresh L2->L1 root, the
 * gigaRoot just uses whatever the L1AztecBridgeAdapter's current local root
 * happens to be.
 *
 * Steps:
 *   1. updateGigaRoot on Sepolia
 *   2. sendGigaRoot via L1->L2 message
 *   3. receiveGigaRootOnAztec consumes the L1->L2 message on Aztec
 *
 * Usage:
 *   pnpm t:sync
 *
 * Required env (backend/.env, loaded automatically below):
 *   DEPLOYER_PRIVATE_KEY  (or EVM_PRIVATE_KEY) - signs L1 root-update txs
 *   SEPOLIA_RPC_URL                            - Sepolia RPC
 *   AZTEC_NODE_URL                             - Aztec testnet node URL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
	createPublicClient,
	createWalletClient,
	getContract,
	http,
	type Address,
	type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";

import {
	updateGigaRoot,
	sendGigaRoot,
	receiveGigaRootOnAztec,
	getPayableGigaRootRecipients,
} from "../lib/bridging.js";
import { initPXE, getAztecWallet } from "../deploy/utils/aztecUtilsNoEnv.js";
import {
	WarpToadCoreContractArtifact,
	WarpToadCoreContract,
} from "../aztec/WarpToadCore/src/artifacts/WarpToadCore.js";
import {
	L2AztecBridgeAdapterContractArtifact,
	L2AztecBridgeAdapterContract,
} from "../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// .env loader (no dotenv dep on the backend workspace)
// =============================================================================

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
// Config
// =============================================================================

const SEPOLIA_CHAIN_ID = 11155111n;

const PRIVATE_KEY = (process.env.DEPLOYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY) as Hex | undefined;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL;

if (!PRIVATE_KEY) {
	throw new Error("DEPLOYER_PRIVATE_KEY (or EVM_PRIVATE_KEY) must be set in backend/.env");
}
if (!SEPOLIA_RPC_URL) {
	throw new Error("SEPOLIA_RPC_URL must be set in backend/.env");
}
if (!AZTEC_NODE_URL) {
	throw new Error("AZTEC_NODE_URL must be set in backend/.env");
}

// =============================================================================
// Address loading (raw fs reads, no Hardhat dependency)
// =============================================================================

function loadAbi(relPath: string): any[] {
	const file = path.resolve(__dirname, `../artifacts/contracts/${relPath}`);
	if (!fs.existsSync(file)) {
		throw new Error(`Hardhat artifact not found at ${file}. Run \`pnpm b:compile\` first.`);
	}
	return JSON.parse(fs.readFileSync(file, "utf8")).abi as any[];
}

async function main() {
	console.log("manual L1 -> Aztec sync (testnet)");
	console.log("=================================");
	console.log(`Sepolia RPC:  ${SEPOLIA_RPC_URL}`);
	console.log(`Aztec node:   ${AZTEC_NODE_URL}`);
	console.log("");

	// ========================================================================
	// 1. Load addresses
	// ========================================================================
	const l1AddressesPath = path.resolve(
		__dirname,
		"../deploy/ignition/deployments/chain-11155111/deployed_addresses.json",
	);
	const aztecAddressesPath = path.resolve(
		__dirname,
		"../deploy/aztec/aztecDeployments/11155111/deployed_addresses.json",
	);
	if (!fs.existsSync(l1AddressesPath) || !fs.existsSync(aztecAddressesPath)) {
		throw new Error(
			`Missing testnet deployment files. Run \`pnpm t:deploy\` first.\n` +
			`  Expected: ${l1AddressesPath}\n` +
			`  Expected: ${aztecAddressesPath}`,
		);
	}
	const l1Addrs = JSON.parse(fs.readFileSync(l1AddressesPath, "utf8")) as Record<string, string>;
	const aztecAddrs = JSON.parse(fs.readFileSync(aztecAddressesPath, "utf8")) as any;

	const l1WarpToadAddress = (l1Addrs["L1InfraModule#L1WarpToad"] || l1Addrs["L1WarpToadModule#L1WarpToad"]) as Address;
	const gigaBridgeAddress = l1Addrs["L1InfraModule#GigaBridge"] as Address;
	const l1AztecBridgeAdapterAddress = l1Addrs["L1InfraModule#L1AztecBridgeAdapter"] as Address;
	if (!l1WarpToadAddress || !gigaBridgeAddress || !l1AztecBridgeAdapterAddress) {
		throw new Error("Missing L1 addresses in chain-11155111/deployed_addresses.json");
	}

	console.log("Addresses loaded:");
	console.log(`  L1WarpToad             ${l1WarpToadAddress}`);
	console.log(`  GigaBridge             ${gigaBridgeAddress}`);
	console.log(`  L1AztecBridgeAdapter   ${l1AztecBridgeAdapterAddress}`);
	console.log(`  Aztec WarpToadCore     ${aztecAddrs.AztecWarpToad.address}`);
	console.log(`  L2AztecBridgeAdapter   ${aztecAddrs.L2AztecBridgeAdapter.address}`);

	// ========================================================================
	// 2. L1 viem clients + contract handles
	// ========================================================================
	const l1Account = privateKeyToAccount(PRIVATE_KEY!);
	const l1PublicClient = createPublicClient({ transport: http(SEPOLIA_RPC_URL) });
	const l1Wallet = createWalletClient({ account: l1Account, transport: http(SEPOLIA_RPC_URL) });
	const l1ChainId = BigInt(await l1PublicClient.getChainId());
	if (l1ChainId !== SEPOLIA_CHAIN_ID) {
		throw new Error(`Expected chain ${SEPOLIA_CHAIN_ID}, got ${l1ChainId}. Check SEPOLIA_RPC_URL.`);
	}
	console.log(`\nSepolia connected. Deployer: ${l1Account.address}`);

	const gigaBridge: any = getContract({
		address: gigaBridgeAddress,
		abi: loadAbi("bridge/GigaBridge.sol/GigaBridge.json"),
		client: { public: l1PublicClient as any, wallet: l1Wallet as any },
	});
	const l1AztecBridgeAdapter: any = getContract({
		address: l1AztecBridgeAdapterAddress,
		abi: loadAbi("bridge/adapters/L1AztecBridgeAdapter.sol/L1AztecBridgeAdapter.json"),
		client: { public: l1PublicClient as any, wallet: l1Wallet as any },
	});

	// ========================================================================
	// 3. Aztec wallet (sponsored FPC, ephemeral) + reconstruct contracts
	// ========================================================================
	console.log(`\nConnecting to Aztec testnet...`);
	const node = createAztecNodeClient(AZTEC_NODE_URL!);

	console.log("Generating ephemeral Aztec wallet (sponsored FPC)...");
	const secrets = {
		secret: Fr.random(),
		salt: Fr.random(),
		signingKey: GrumpkinScalar.random(),
	};
	const { wallet: aztecWallet, sponsoredPaymentMethod } = await getAztecWallet(
		AZTEC_NODE_URL!,
		secrets,
		false, // not sandbox
	);
	const pxe = await initPXE(node, l1ChainId);
	const aztecAccountAddress = (await aztecWallet.getAccounts())[0].item;
	console.log(`Aztec deployer: ${aztecAccountAddress.toString()}`);

	const warpToadCtorArgs = aztecAddrs.AztecWarpToad.constructorArgs.map((v: any, i: number, arr: any[]) =>
		i === arr.length - 1 ? BigInt(v) : v,
	);
	const warpToadInstance = await getContractInstanceFromInstantiationParams(
		WarpToadCoreContractArtifact,
		{
			constructorArgs: warpToadCtorArgs,
			deployer: AztecAddress.fromStringUnsafe(aztecAddrs.AztecWarpToad.deployer),
			salt: Fr.fromHexString(aztecAddrs.AztecWarpToad.salt),
		},
	);
	await aztecWallet.registerContract(warpToadInstance, WarpToadCoreContractArtifact);
	const aztecWarpToad = await WarpToadCoreContract.at(warpToadInstance.address, aztecWallet);

	const adapterInstance = await getContractInstanceFromInstantiationParams(
		L2AztecBridgeAdapterContractArtifact,
		{
			constructorArgs: aztecAddrs.L2AztecBridgeAdapter.constructorArgs,
			deployer: AztecAddress.fromStringUnsafe(aztecAddrs.L2AztecBridgeAdapter.deployer),
			salt: Fr.fromHexString(aztecAddrs.L2AztecBridgeAdapter.salt),
		},
	);
	await aztecWallet.registerContract(adapterInstance, L2AztecBridgeAdapterContractArtifact);
	const aztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(adapterInstance.address, aztecWallet);

	// ========================================================================
	// 4. updateGigaRoot + sendGigaRoot + receiveGigaRootOnAztec
	// ========================================================================
	const localRootProviders = [l1WarpToadAddress, l1AztecBridgeAdapterAddress] as Address[];
	const payableLocalRootProviders = await getPayableGigaRootRecipients(l1ChainId);
	const confirmations = 3;

	console.log("\n--- step 1/3: updateGigaRoot on L1 ---");
	const { gigaRootUpdateTxHash } = await updateGigaRoot(
		l1PublicClient as any,
		l1Wallet as any,
		gigaBridge,
		localRootProviders,
		confirmations,
	);
	console.log(`  ✓ updateGigaRoot ${gigaRootUpdateTxHash}`);

	console.log("\n--- step 2/3: sendGigaRoot via L1->L2 message ---");
	const { sendGigaRootTx, sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
		l1PublicClient as any,
		l1Wallet as any,
		gigaBridge,
		localRootProviders,
		payableLocalRootProviders,
		confirmations,
	);
	console.log(`  ✓ sendGigaRoot ${sendGigaRootTxHash}`);
	console.log(`  gigaRoot value: ${gigaRootSent}`);

	console.log("\n--- step 3/3: receiveGigaRootOnAztec ---");
	await receiveGigaRootOnAztec(
		aztecBridgeAdapter,
		l1AztecBridgeAdapter,
		aztecWarpToad,
		l1PublicClient as any,
		sendGigaRootTx,
		node,
		false, // not sandbox
		sponsoredPaymentMethod,
		aztecWallet,
	);
	console.log(`  ✓ receiveGigaRootOnAztec`);

	// ========================================================================
	// 5. Cross-check the gigaRoot landed on Aztec
	// ========================================================================
	const { result: aztecGigaRootRaw } = await aztecWarpToad.methods
		.get_giga_root()
		.simulate({ from: aztecAccountAddress }) as any;
	const aztecGigaRoot = BigInt(aztecGigaRootRaw.toString());
	const l1GigaRoot = BigInt(await gigaBridge.read.gigaRoot());

	console.log("\n--- gigaRoot status ---");
	console.log(`  L1 GigaBridge.gigaRoot:   ${l1GigaRoot}`);
	console.log(`  Aztec WarpToad.gigaRoot:  ${aztecGigaRoot}`);
	if (l1GigaRoot === aztecGigaRoot) {
		console.log(`  ✓ MATCH - L1->Aztec withdraw is now possible`);
	} else {
		console.log(`  ✗ MISMATCH - the L1->L2 message may not have been consumed yet`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("\nSYNC FAILED:");
		console.error(err);
		process.exit(1);
	});
