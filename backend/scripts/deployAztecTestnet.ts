/**
 * Deploys the Aztec side of warp-toad to Aztec testnet.
 *
 * Steps:
 *   1. Reads L1AztecBridgeAdapter address from
 *      backend/deploy/ignition/deployments/chain-11155111/deployed_addresses.json
 *      (must exist; run L1Infra ignition deploy first).
 *   2. Reads native token (USDcoin) address from the same file.
 *   3. Spins up an ephemeral sponsored Aztec wallet (no funded creds needed).
 *   4. Deploys WarpToadCore + L2AztecBridgeAdapter.
 *   5. Calls WarpToadCore.initialize(L2AztecAdapter, L1AztecAdapter).
 *   6. Writes backend/deploy/aztec/aztecDeployments/11155111/deployed_addresses.json
 *      in the format the frontend's chains.ts expects.
 *
 * Idempotency: if the output file already contains both AztecWarpToad and
 * L2AztecBridgeAdapter, exits immediately without redeploying.
 *
 * Env required (loaded from backend/.env via dotenv-cli):
 *   AZTEC_NODE_URL  testnet full node, e.g. https://rpc.testnet.aztec-labs.com
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Address } from "viem";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Contract } from "@aztec/aztec.js/contracts";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";

import { initPXE, getAztecWallet } from "../deploy/utils/aztecUtilsNoEnv.js";
import { WarpToadCoreContractArtifact } from "../aztec/WarpToadCore/src/artifacts/WarpToadCore.js";
import { L2AztecBridgeAdapterContractArtifact } from "../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js";
import type { DeploymentArtifact } from "../lib/types.js";
import type { NoirCompiledContract } from "@aztec/aztec.js/abi";
import WarpToadCoreRawArtifact from "../aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json" with { type: "json" };
import L2AztecBridgeAdapterRawArtifact from "../aztec/L2AztecBridgeAdapter/target/L2AztecBridgeAdapter-L2AztecBridgeAdapter.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEPOLIA_CHAIN_ID = 11155111n;

const L1_DEPLOYMENT_FILE = path.resolve(
  __dirname,
  "../deploy/ignition/deployments/chain-11155111/deployed_addresses.json",
);
const AZTEC_OUT_DIR = path.resolve(
  __dirname,
  "../deploy/aztec/aztecDeployments/11155111",
);
const AZTEC_OUT_FILE = path.join(AZTEC_OUT_DIR, "deployed_addresses.json");

interface AztecDeploymentMetadata {
  address: string;
  constructorArgs: string[];
  salt: string;
  deployer: string;
}

function loadJson<T = any>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file: string, data: any) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  const aztecNodeUrl = process.env.AZTEC_NODE_URL;
  if (!aztecNodeUrl) {
    throw new Error("AZTEC_NODE_URL must be set in backend/.env");
  }

  const existing = loadJson<Record<string, AztecDeploymentMetadata>>(AZTEC_OUT_FILE);
  const warpToadArtifactFile = path.join(AZTEC_OUT_DIR, "AztecWarpToad_deploymentArtifact.json");
  const adapterArtifactFile = path.join(AZTEC_OUT_DIR, "L2AztecBridgeAdapter_deploymentArtifact.json");

  if (existing?.AztecWarpToad?.address && existing?.L2AztecBridgeAdapter?.address) {
    // Addresses recorded; backfill artifact files if they were deleted (verifyAztecScan
    // reads these to reconstruct the on-chain contract instance for AztecScan).
    if (!fs.existsSync(warpToadArtifactFile)) {
      const m = existing.AztecWarpToad;
      writeJson(warpToadArtifactFile, {
        ...m,
        rawArtifact: WarpToadCoreRawArtifact as unknown as NoirCompiledContract,
      } satisfies DeploymentArtifact);
      console.log("  Backfilled AztecWarpToad_deploymentArtifact.json");
    }
    if (!fs.existsSync(adapterArtifactFile)) {
      const m = existing.L2AztecBridgeAdapter;
      writeJson(adapterArtifactFile, {
        ...m,
        rawArtifact: L2AztecBridgeAdapterRawArtifact as unknown as NoirCompiledContract,
      } satisfies DeploymentArtifact);
      console.log("  Backfilled L2AztecBridgeAdapter_deploymentArtifact.json");
    }
    console.log("Aztec contracts already deployed; skipping.");
    console.log(`  AztecWarpToad:        ${existing.AztecWarpToad.address}`);
    console.log(`  L2AztecBridgeAdapter: ${existing.L2AztecBridgeAdapter.address}`);
    return;
  }

  const l1Addrs = loadJson<Record<string, string>>(L1_DEPLOYMENT_FILE);
  if (!l1Addrs) {
    throw new Error(
      `Missing ${L1_DEPLOYMENT_FILE}.\n` +
      `Run the L1Infra ignition deploy first (the orchestrator does this).`,
    );
  }

  const l1AztecAdapterAddress = l1Addrs["L1InfraModule#L1AztecBridgeAdapter"] as Address;
  const nativeTokenL1 = l1Addrs["TestToken#USDcoin"] as Address;
  if (!l1AztecAdapterAddress || !nativeTokenL1) {
    throw new Error(
      `chain-11155111/deployed_addresses.json is missing required keys.\n` +
      `Expected: TestToken#USDcoin, L1InfraModule#L1AztecBridgeAdapter`,
    );
  }

  console.log(`Connecting to Aztec node: ${aztecNodeUrl}`);
  const node = createAztecNodeClient(aztecNodeUrl);

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
  await initPXE(node, SEPOLIA_CHAIN_ID);

  const deployerAccounts = await deployerWallet.getAccounts();
  const deployer = deployerAccounts[0].item;
  console.log(`Aztec deployer: ${deployer.toString()}`);

  // ---- WarpToadCore ----
  // Constructor: (nativeToken: EthAddress, name: str<31>, symbol: str<31>, decimals: u8)
  const warpToadConstructorArgs = [
    nativeTokenL1,
    "wrpToad-USD Coin",
    "wrpToad-USDC",
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
  console.log(`  WarpToadCore         ${warpToad.address.toString()}`);

  // ---- L2AztecBridgeAdapter ----
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
  console.log("  WarpToadCore.initialize done");

  const warpToadConstructorArgsStr = warpToadConstructorArgs.map((v) =>
    typeof v === "bigint" ? v.toString() : String(v),
  );
  const adapterConstructorArgsStr = adapterConstructorArgs.map((v) => String(v));

  const aztecAddrs: Record<string, AztecDeploymentMetadata> = {
    AztecWarpToad: {
      address: warpToad.address.toString(),
      constructorArgs: warpToadConstructorArgsStr,
      salt: warpToadInstance.salt.toString(),
      deployer: deployer.toString(),
    },
    L2AztecBridgeAdapter: {
      address: bridgeAdapter.address.toString(),
      constructorArgs: adapterConstructorArgsStr,
      salt: adapterInstance.salt.toString(),
      deployer: deployer.toString(),
    },
  };
  writeJson(AZTEC_OUT_FILE, aztecAddrs);
  console.log(`Wrote ${AZTEC_OUT_FILE}`);

  // Per-contract deployment artifacts (with rawArtifact embedded). verifyAztecScan
  // reads these by globbing *_deploymentArtifact.json in the same directory.
  const warpToadDeploymentArtifact: DeploymentArtifact = {
    address: warpToad.address.toString(),
    salt: warpToadInstance.salt.toString(),
    deployer: deployer.toString(),
    constructorArgs: warpToadConstructorArgsStr,
    rawArtifact: WarpToadCoreRawArtifact as unknown as NoirCompiledContract,
  };
  writeJson(warpToadArtifactFile, warpToadDeploymentArtifact);
  console.log(`Wrote ${warpToadArtifactFile}`);

  const adapterDeploymentArtifact: DeploymentArtifact = {
    address: bridgeAdapter.address.toString(),
    salt: adapterInstance.salt.toString(),
    deployer: deployer.toString(),
    constructorArgs: adapterConstructorArgsStr,
    rawArtifact: L2AztecBridgeAdapterRawArtifact as unknown as NoirCompiledContract,
  };
  writeJson(adapterArtifactFile, adapterDeploymentArtifact);
  console.log(`Wrote ${adapterArtifactFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nAZTEC DEPLOY FAILED:");
    console.error(err);
    process.exit(1);
  });
