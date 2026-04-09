/**
 * Deploy the full warp-toad stack to public testnets.
 *
 * Targets:
 *   - L1:    Ethereum Sepolia (chain 11155111)
 *   - L2:    Scroll Sepolia    (chain 534351)
 *   - Aztec: Aztec testnet     (referenced by l1ChainId 11155111)
 *
 * Phases (in dependency order):
 *   A. Sepolia       - libs, USDcoin, verifier, L1WarpToad, L1AztecBridgeAdapter,
 *                      L1ScrollBridgeAdapter, GigaBridge
 *   B. Aztec testnet - WarpToadCore + L2AztecBridgeAdapter (needs L1AztecAdapter
 *                      address from phase A in L2AztecAdapter constructor)
 *   C. Scroll Sepolia- libs, USDcoin, verifier, L2WarpToad, L2ScrollBridgeAdapter
 *                      (L2ScrollAdapter constructor needs L1ScrollAdapter from A)
 *   D. Wire          - initialize() calls on L1WarpToad, L1AztecAdapter,
 *                      L1ScrollAdapter, AztecWarpToad. All cross-chain pointers
 *                      get baked in here.
 *
 * Idempotency:
 *   Each phase reads its target deployed_addresses.json before doing anything
 *   and SKIPS contracts that already have a recorded address. Safe to re-run
 *   after a partial failure - it will only deploy what's missing.
 *
 * Required env (in backend/.env):
 *   DEPLOYER_PRIVATE_KEY      - funded on Sepolia + Scroll Sepolia
 *   SEPOLIA_RPC_URL           - any reliable RPC
 *   SCROLL_SEPOLIA_RPC_URL    - any reliable RPC
 *   AZTEC_NODE_URL            - testnet full node
 *
 * Usage:
 *   pnpm hardhat run scripts/deployTestnet.ts --network sepolia
 *
 *   The --network flag is ONLY used to seed hardhat's first connection. The
 *   script switches networks internally (Sepolia -> ScrollSepolia) via
 *   getViemClients(networkName).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Address, type Hex, getContract, pad } from "viem";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Contract } from "@aztec/aztec.js/contracts";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";

import { deployEvmContracts } from "../test/helpers/deploy-evm.js";
import {
  getViemClients,
  deployFromArtifact,
  deployLibFromBuildInfo,
} from "../test/helpers/artifacts.js";
import { EVM_TREE_DEPTH } from "../test/helpers/constants.js";
import {
  L1_SCROLL_MESSENGER_SEPOLIA,
  L2_SCROLL_MESSENGER_SEPOLIA,
} from "../lib/constants.js";

import { initPXE, getAztecWallet } from "../deploy/utils/aztecUtilsNoEnv.js";
import { WarpToadCoreContractArtifact } from "../aztec/WarpToadCore/src/artifacts/WarpToadCore.js";
import { L2AztecBridgeAdapterContractArtifact } from "../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// .env loader (no dotenv dep - backend doesn't have it)
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
    // Strip surrounding quotes if present.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
})();

// =============================================================================
// Constants
// =============================================================================

const SEPOLIA_CHAIN_ID = 11155111n;
const SCROLL_SEPOLIA_CHAIN_ID = 534351n;

const SEPOLIA_DIR = path.resolve(
  __dirname,
  "../deploy/ignition/deployments/chain-11155111",
);
const SCROLL_SEPOLIA_DIR = path.resolve(
  __dirname,
  "../deploy/ignition/deployments/chain-534351",
);
const AZTEC_TESTNET_DIR = path.resolve(
  __dirname,
  "../deploy/aztec/aztecDeployments/11155111",
);

interface AztecDeploymentMetadata {
  address: string;
  constructorArgs: string[];
  salt: string;
  deployer: string;
}

// =============================================================================
// Address-file helpers (Ignition-format JSON)
// =============================================================================

function loadJsonOrEmpty(file: string): Record<string, any> {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(file: string, data: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

const sepoliaAddressFile = path.join(SEPOLIA_DIR, "deployed_addresses.json");
const scrollSepoliaAddressFile = path.join(SCROLL_SEPOLIA_DIR, "deployed_addresses.json");
const aztecAddressFile = path.join(AZTEC_TESTNET_DIR, "deployed_addresses.json");

// =============================================================================
// Phase A: Sepolia EVM deploy
// =============================================================================

async function phaseA_sepolia() {
  console.log("\n========== Phase A: Sepolia ==========");
  const existing = loadJsonOrEmpty(sepoliaAddressFile);

  // If a complete deploy is already recorded, skip and just rebuild handles.
  if (
    existing["L1InfraModule#L1WarpToad"] &&
    existing["L1InfraModule#GigaBridge"] &&
    existing["L1InfraModule#L1AztecBridgeAdapter"] &&
    existing["L1InfraModule#L1ScrollBridgeAdapter"]
  ) {
    console.log("Sepolia stack already deployed; skipping.");
    return existing as Record<string, string>;
  }

  console.log("Deploying full Sepolia stack via deployEvmContracts...");
  const evm = await deployEvmContracts({
    withAztecAdapter: true,
    withScrollAdapter: { l1ScrollMessenger: L1_SCROLL_MESSENGER_SEPOLIA as Address },
    networkName: "sepolia",
  });
  if (!evm.l1AztecBridgeAdapter || !evm.l1ScrollBridgeAdapter) {
    throw new Error("Sepolia deploy did not return both adapters");
  }

  const l1ChainId = BigInt(await evm.publicClient.getChainId());
  if (l1ChainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`Expected chain ${SEPOLIA_CHAIN_ID}, got ${l1ChainId}. Check SEPOLIA_RPC_URL.`);
  }

  const addresses: Record<string, string> = {
    "TestToken#USDcoin": evm.nativeToken.address,
    "L1WarpToadModule#L1WarpToad": evm.l1WarpToad.address,
    "L1WarpToadModule#WithdrawVerifier": evm.withdrawVerifier.address,
    "L1InfraModule#GigaBridge": evm.gigaBridge.address,
    "L1InfraModule#L1WarpToad": evm.l1WarpToad.address,
    "L1InfraModule#L1AztecBridgeAdapter": evm.l1AztecBridgeAdapter.address,
    "L1InfraModule#L1ScrollBridgeAdapter": evm.l1ScrollBridgeAdapter.address,
  };
  writeJson(sepoliaAddressFile, addresses);
  console.log("Sepolia addresses written:");
  for (const [k, v] of Object.entries(addresses)) console.log(`  ${k.padEnd(40)} ${v}`);
  return addresses;
}

// =============================================================================
// Phase B: Aztec testnet deploy
// =============================================================================

async function phaseB_aztec(sepoliaAddrs: Record<string, string>, nativeTokenL1: Address) {
  console.log("\n========== Phase B: Aztec testnet ==========");
  const existing = loadJsonOrEmpty(aztecAddressFile);
  if (existing.AztecWarpToad?.address && existing.L2AztecBridgeAdapter?.address) {
    console.log("Aztec contracts already deployed; skipping.");
    return existing as Record<string, AztecDeploymentMetadata>;
  }

  const aztecNodeUrl = process.env.AZTEC_NODE_URL;
  if (!aztecNodeUrl) throw new Error("AZTEC_NODE_URL must be set in backend/.env");

  console.log(`Connecting to Aztec node: ${aztecNodeUrl}`);
  const node = createAztecNodeClient(aztecNodeUrl);

  // Spin up an ephemeral sponsored wallet (no funded credentials needed; the
  // SponsoredFPC pays gas). Same pattern bridge-sync uses.
  console.log("Generating ephemeral Aztec deployer wallet (sponsored FPC)...");
  const secrets = {
    secret: Fr.random(),
    salt: Fr.random(),
    signingKey: GrumpkinScalar.random(),
  };
  const { wallet: deployerWallet, sponsoredPaymentMethod } = await getAztecWallet(
    aztecNodeUrl,
    secrets,
    false, // not sandbox
  );
  await initPXE(node, SEPOLIA_CHAIN_ID); // shared PXE for the chain

  const deployerAccounts = await deployerWallet.getAccounts();
  const deployer = deployerAccounts[0].item;
  console.log(`Aztec deployer: ${deployer.toString()}`);

  const l1AztecAdapterAddress = sepoliaAddrs["L1InfraModule#L1AztecBridgeAdapter"] as Address;

  // ---- WarpToadCore ----
  // Constructor args: (nativeToken: EthAddress, name: str<31>, symbol: str<31>, decimals: u8)
  const warpToadConstructorArgs = [
    nativeTokenL1,
    "wrpToad-TestUSD",
    "wrpToad-TUSD",
    6n,
  ];
  console.log("Deploying WarpToadCore...");
  const warpToadDeploy = Contract.deploy(
    deployerWallet,
    WarpToadCoreContractArtifact,
    warpToadConstructorArgs,
  );
  const { contract: warpToad } = await warpToadDeploy.send({
    from: deployer,
    fee: { paymentMethod: sponsoredPaymentMethod },
  });
  const warpToadInstance = await warpToadDeploy.getInstance();
  console.log(`  WarpToadCore        ${warpToad.address.toString()}`);

  // ---- L2AztecBridgeAdapter ----
  // Constructor args: (l1BridgeAdapter: EthAddress)
  const adapterConstructorArgs = [l1AztecAdapterAddress];
  console.log("Deploying L2AztecBridgeAdapter...");
  const adapterDeploy = Contract.deploy(
    deployerWallet,
    L2AztecBridgeAdapterContractArtifact,
    adapterConstructorArgs,
  );
  const { contract: bridgeAdapter } = await adapterDeploy.send({
    from: deployer,
    fee: { paymentMethod: sponsoredPaymentMethod },
  });
  const adapterInstance = await adapterDeploy.getInstance();
  console.log(`  L2AztecBridgeAdapter ${bridgeAdapter.address.toString()}`);

  // ---- WarpToadCore.initialize(L2 adapter, L1 adapter) ----
  console.log("Initializing WarpToadCore on Aztec...");
  await (warpToad as any).methods
    .initialize(bridgeAdapter.address, l1AztecAdapterAddress)
    .send({ from: deployer, fee: { paymentMethod: sponsoredPaymentMethod } });
  console.log("  ✓ WarpToadCore.initialize done");

  const aztecAddrs: Record<string, AztecDeploymentMetadata> = {
    AztecWarpToad: {
      address: warpToad.address.toString(),
      constructorArgs: warpToadConstructorArgs.map((v) =>
        typeof v === "bigint" ? v.toString() : String(v),
      ),
      salt: warpToadInstance.salt.toString(),
      deployer: deployer.toString(),
    },
    L2AztecBridgeAdapter: {
      address: bridgeAdapter.address.toString(),
      constructorArgs: adapterConstructorArgs.map((v) => String(v)),
      salt: adapterInstance.salt.toString(),
      deployer: deployer.toString(),
    },
  };
  writeJson(aztecAddressFile, aztecAddrs);
  console.log("Aztec addresses written.");
  return { aztecAddrs, node };
}

// =============================================================================
// Phase C: Scroll Sepolia EVM deploy
// =============================================================================

async function phaseC_scrollSepolia(l1ScrollBridgeAdapterAddress: Address) {
  console.log("\n========== Phase C: Scroll Sepolia ==========");
  const existing = loadJsonOrEmpty(scrollSepoliaAddressFile);
  if (
    existing["L2ScrollModule#L2WarpToad"] &&
    existing["L2ScrollModule#L2ScrollBridgeAdapter"]
  ) {
    console.log("Scroll Sepolia stack already deployed; skipping.");
    return existing as Record<string, string>;
  }

  const { deployer, publicClient } = await getViemClients("scrollSepolia");
  const l2ChainId = BigInt(await publicClient.getChainId());
  if (l2ChainId !== SCROLL_SEPOLIA_CHAIN_ID) {
    throw new Error(`Expected chain ${SCROLL_SEPOLIA_CHAIN_ID}, got ${l2ChainId}. Check SCROLL_SEPOLIA_RPC_URL.`);
  }
  console.log(`Scroll Sepolia chainId=${l2ChainId}`);

  // 1. Libs (independent per chain - bytecode addresses differ)
  const poseidonT3 = await deployLibFromBuildInfo(
    "npm/poseidon-solidity@0.0.5/PoseidonT3.sol",
    "PoseidonT3",
    deployer,
    publicClient,
  );
  const lazyIMT = await deployLibFromBuildInfo(
    "npm/@zk-kit/lazy-imt.sol@2.0.0-beta.12/LazyIMT.sol",
    "LazyIMT",
    deployer,
    publicClient,
    { PoseidonT3: poseidonT3 },
  );
  const libs: Record<string, Address> = { LazyIMT: lazyIMT, PoseidonT3: poseidonT3 };

  // 2. Native token (USDcoin) — fresh deploy on Scroll, independent of Sepolia.
  const usdcoin = await deployFromArtifact("USDcoin", [], deployer, publicClient);

  // 3. ZKTranscriptLib + verifier
  const zkTranscript = await deployFromArtifact("ZKTranscriptLib", [], deployer, publicClient);
  const verifier = await deployFromArtifact("HonkVerifier", [], deployer, publicClient, {
    ZKTranscriptLib: zkTranscript.address,
  });

  // 4. L2WarpToad (constructor: maxTreeDepth, verifier, nativeToken, name, symbol)
  const l2NameTokenViem: any = getContract({
    address: usdcoin.address,
    abi: usdcoin.abi,
    client: { public: publicClient, wallet: deployer },
  });
  const tokenName = (await l2NameTokenViem.read.name()) as string;
  const tokenSymbol = (await l2NameTokenViem.read.symbol()) as string;
  const l2WarpToad = await deployFromArtifact(
    "L2WarpToad",
    [
      EVM_TREE_DEPTH,
      verifier.address,
      usdcoin.address,
      `wrpToad-${tokenSymbol}`,
      `wrpToad-${tokenName}`,
    ],
    deployer,
    publicClient,
    libs,
  );

  // 5. L2ScrollBridgeAdapter (constructor: l2ScrollMessenger, l1ScrollBridgeAdapter, l2WarpToad)
  const l2ScrollAdapter = await deployFromArtifact(
    "L2ScrollBridgeAdapter",
    [
      L2_SCROLL_MESSENGER_SEPOLIA as Address,
      l1ScrollBridgeAdapterAddress,
      l2WarpToad.address,
    ],
    deployer,
    publicClient,
  );

  const addresses: Record<string, string> = {
    "TestToken#USDcoin": usdcoin.address,
    "L2ScrollModule#WithdrawVerifier": verifier.address,
    "L2ScrollModule#L2WarpToad": l2WarpToad.address,
    "L2ScrollModule#L2ScrollBridgeAdapter": l2ScrollAdapter.address,
  };
  writeJson(scrollSepoliaAddressFile, addresses);
  console.log("Scroll Sepolia addresses written:");
  for (const [k, v] of Object.entries(addresses)) console.log(`  ${k.padEnd(40)} ${v}`);
  return addresses;
}

// =============================================================================
// Phase D: Wire / initialize
// =============================================================================

async function phaseD_wire(
  sepoliaAddrs: Record<string, string>,
  scrollAddrs: Record<string, string>,
  aztecAddrs: Record<string, AztecDeploymentMetadata>,
  aztecNode: any,
) {
  console.log("\n========== Phase D: Wire / initialize ==========");

  const { deployer, publicClient } = await getViemClients("sepolia");

  // Re-build viem handles for the L1 contracts we just deployed.
  // We need ABIs - load from the freshly compiled Hardhat artifacts.
  const loadAbi = (artifactRelPath: string) => {
    const file = path.resolve(__dirname, `../artifacts/contracts/${artifactRelPath}`);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    return json.abi as any[];
  };

  const l1WarpToad: any = getContract({
    address: sepoliaAddrs["L1InfraModule#L1WarpToad"] as Address,
    abi: loadAbi("core/L1WarpToad.sol/L1WarpToad.json"),
    client: { public: publicClient, wallet: deployer },
  });
  const l1AztecAdapter: any = getContract({
    address: sepoliaAddrs["L1InfraModule#L1AztecBridgeAdapter"] as Address,
    abi: loadAbi("bridge/adapters/L1AztecBridgeAdapter.sol/L1AztecBridgeAdapter.json"),
    client: { public: publicClient, wallet: deployer },
  });
  const l1ScrollAdapter: any = getContract({
    address: sepoliaAddrs["L1InfraModule#L1ScrollBridgeAdapter"] as Address,
    abi: loadAbi("bridge/adapters/L1ScrollBridgeAdapter.sol/L1ScrollBridgeAdapter.json"),
    client: { public: publicClient, wallet: deployer },
  });

  const gigaBridgeAddr = sepoliaAddrs["L1InfraModule#GigaBridge"] as Address;
  const aztecWarpToadAddrStr = aztecAddrs.AztecWarpToad.address;
  const l2AztecAdapterAddrStr = aztecAddrs.L2AztecBridgeAdapter.address;
  const l2ScrollAdapterAddr = scrollAddrs["L2ScrollModule#L2ScrollBridgeAdapter"] as Address;

  // ---- L1WarpToad.initialize(gigaBridge, self, aztecWarpToadAddress) ----
  try {
    console.log("Initializing L1WarpToad...");
    const aztecWarpToadAsUint = BigInt(aztecWarpToadAddrStr);
    const hash = await (l1WarpToad.write.initialize as any)([
      gigaBridgeAddr,
      l1WarpToad.address,
      aztecWarpToadAsUint,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ ${hash}`);
  } catch (e: any) {
    if (String(e?.shortMessage || e?.message || "").includes("already")) {
      console.log("  L1WarpToad already initialized, skipping.");
    } else throw e;
  }

  // ---- L1AztecBridgeAdapter.initialize(registry, l2 adapter [bytes32], gigaBridge) ----
  try {
    console.log("Initializing L1AztecBridgeAdapter...");
    const aztecNodeInfo = await aztecNode.getNodeInfo();
    const registryAddr = aztecNodeInfo.l1ContractAddresses.registryAddress.toString() as Address;
    // The L2 adapter param is bytes32 (Aztec address).
    const l2AdapterBytes32 = pad(l2AztecAdapterAddrStr as Hex, { size: 32 });
    const hash = await (l1AztecAdapter.write.initialize as any)([
      registryAddr,
      l2AdapterBytes32,
      gigaBridgeAddr,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ ${hash}`);
  } catch (e: any) {
    if (String(e?.shortMessage || e?.message || "").includes("twice")) {
      console.log("  L1AztecBridgeAdapter already initialized, skipping.");
    } else throw e;
  }

  // ---- L1ScrollBridgeAdapter.initialize(l2 scroll adapter, gigaBridge) ----
  try {
    console.log("Initializing L1ScrollBridgeAdapter...");
    const hash = await (l1ScrollAdapter.write.initialize as any)([
      l2ScrollAdapterAddr,
      gigaBridgeAddr,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ ${hash}`);
  } catch (e: any) {
    if (String(e?.shortMessage || e?.message || "").includes("only once")) {
      console.log("  L1ScrollBridgeAdapter already initialized, skipping.");
    } else throw e;
  }

  console.log("\nAll initialize calls done.");
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Sanity-check env up front so we don't half-deploy then crash on missing
  // Aztec / Scroll config.
  const required = ["DEPLOYER_PRIVATE_KEY", "SEPOLIA_RPC_URL", "SCROLL_SEPOLIA_RPC_URL", "AZTEC_NODE_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env in backend/.env: ${missing.join(", ")}`);
  }

  console.log("warp-toad testnet deploy");
  console.log("========================");
  console.log(`Sepolia RPC:        ${process.env.SEPOLIA_RPC_URL}`);
  console.log(`Scroll Sepolia RPC: ${process.env.SCROLL_SEPOLIA_RPC_URL}`);
  console.log(`Aztec node:         ${process.env.AZTEC_NODE_URL}`);

  // Phase A: Sepolia
  const sepoliaAddrs = await phaseA_sepolia();
  const nativeTokenL1 = sepoliaAddrs["TestToken#USDcoin"] as Address;
  const l1ScrollAdapterAddr = sepoliaAddrs["L1InfraModule#L1ScrollBridgeAdapter"] as Address;

  // Phase B: Aztec testnet (needs L1AztecAdapter from A in constructor)
  const phaseBResult = await phaseB_aztec(sepoliaAddrs, nativeTokenL1);
  // phaseBResult is either the existing-skip object or { aztecAddrs, node }
  let aztecAddrs: Record<string, AztecDeploymentMetadata>;
  let aztecNode: any;
  if ("AztecWarpToad" in phaseBResult) {
    aztecAddrs = phaseBResult as Record<string, AztecDeploymentMetadata>;
    // Need a node connection for Phase D's registry lookup even when skipping.
    aztecNode = createAztecNodeClient(process.env.AZTEC_NODE_URL!);
  } else {
    aztecAddrs = (phaseBResult as any).aztecAddrs;
    aztecNode = (phaseBResult as any).node;
  }

  // Phase C: Scroll Sepolia (needs L1ScrollAdapter from A in constructor)
  const scrollAddrs = await phaseC_scrollSepolia(l1ScrollAdapterAddr);

  // Phase D: Wire all initializers
  await phaseD_wire(sepoliaAddrs, scrollAddrs, aztecAddrs, aztecNode);

  console.log("\n========================");
  console.log("Testnet deploy complete.");
  console.log("========================");
  console.log("Next: pnpm --filter frontend pull:addresses");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDEPLOY FAILED:");
    console.error(err);
    process.exit(1);
  });
