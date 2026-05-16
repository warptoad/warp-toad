/**
 * Orchestrator for the warp-toad testnet deploy.
 *
 * Replaces the old hand-rolled viem deploy script with a thin tsx wrapper that
 * drives `hardhat ignition deploy` per phase. Ignition owns the deploy state
 * (futures, addresses, journal) on disk under deploy/ignition/deployments/,
 * which makes every phase idempotent: re-running picks up where it left off,
 * skipping contracts and m.call(initialize)s already recorded.
 *
 * Phase order:
 *   1. Poseidon (Sepolia) via Nick's method
 *   2. L1Infra ignition module on Sepolia
 *   3. deployAztecTestnet.ts (constructor needs L1AztecAdapter from phase 2)
 *   4. Poseidon (Scroll Sepolia)
 *   5. L2Scroll ignition module on Scroll Sepolia
 *   6. L1Wire ignition module (initialize() calls on L1WarpToad + L1 adapters)
 *   7. L2ScrollWire ignition module (initialize() L2WarpToad on Scroll)
 *   8. Etherscan / Blockscout / Sourcify verify via hardhat ignition verify
 *      (skipped if ETHERSCAN_API_KEY missing)
 *   9. AztecScan verify via aztec-scan-sdk (skipped if SKIP_AZTEC_SCAN_VERIFY set)
 *
 * Required env (loaded via `dotenv -e .env --` from package.json):
 *   DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL, SCROLL_SEPOLIA_RPC_URL, AZTEC_NODE_URL
 *
 * Optional:
 *   ETHERSCAN_API_KEY        enables phase 8
 *   SKIP_AZTEC_SCAN_VERIFY   if set (to any value), skips phase 9
 *
 * Usage:
 *   pnpm t:deploy             # runs `dotenv -e .env -- tsx scripts/deployTestnet.ts`
 *   tsx scripts/deployTestnet.ts   # if you've already loaded env
 */

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  pad,
  formatEther,
  parseEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, scrollSepolia } from "viem/chains";
// @ts-ignore — poseidon-solidity ships no types and no exports map; the
// explicit /index.js is required for Node ESM resolution.
import poseidonSolidity from "poseidon-solidity/index.js";
import { poseidon2 } from "poseidon-lite";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

import {
  L1_SCROLL_MESSENGER_SEPOLIA,
  L2_SCROLL_MESSENGER_SEPOLIA,
} from "../lib/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");

const SEPOLIA_DEPLOYMENT_DIR = path.join(BACKEND_DIR, "deploy/ignition/deployments/chain-11155111");
const SCROLL_DEPLOYMENT_DIR = path.join(BACKEND_DIR, "deploy/ignition/deployments/chain-534351");
const AZTEC_DEPLOYMENT_DIR = path.join(BACKEND_DIR, "deploy/aztec/aztecDeployments/11155111");

const SEPOLIA_ADDR_FILE = path.join(SEPOLIA_DEPLOYMENT_DIR, "deployed_addresses.json");
const SCROLL_ADDR_FILE = path.join(SCROLL_DEPLOYMENT_DIR, "deployed_addresses.json");
const AZTEC_ADDR_FILE = path.join(AZTEC_DEPLOYMENT_DIR, "deployed_addresses.json");

const POSEIDON_T3_ABI = [
  {
    type: "function",
    name: "hash",
    stateMutability: "pure",
    inputs: [{ name: "input", type: "uint256[2]" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

function loadAddresses(file: string): Record<string, any> {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function spawnInherit(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? BACKEND_DIR,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: "inherit",
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function deployPoseidon(
  publicClient: PublicClient,
  walletClient: WalletClient,
): Promise<Address> {
  const proxy = (poseidonSolidity as any).proxy;
  const PoseidonT3 = (poseidonSolidity as any).PoseidonT3;
  const account = walletClient.account!;

  // Step 1: deploy the keyless proxy (Nick's method) if not already on chain.
  if ((await publicClient.getCode({ address: proxy.address as Address })) === undefined) {
    console.log(`  funding proxy deployer ${proxy.from} with ${proxy.gas} wei...`);
    const fundHash = await walletClient.sendTransaction({
      account,
      chain: walletClient.chain,
      to: proxy.from as Address,
      value: BigInt(proxy.gas),
    });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });

    console.log(`  broadcasting presigned proxy deploy tx...`);
    const proxyHash = await publicClient.sendRawTransaction({
      serializedTransaction: proxy.tx as Hex,
    });
    await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  } else {
    console.log(`  proxy already at ${proxy.address}`);
  }

  // Step 2: deploy PoseidonT3 via the proxy if not already there.
  if ((await publicClient.getCode({ address: PoseidonT3.address as Address })) === undefined) {
    console.log(`  deploying PoseidonT3 via proxy...`);
    const hash = await walletClient.sendTransaction({
      account,
      chain: walletClient.chain,
      to: proxy.address as Address,
      data: PoseidonT3.data as Hex,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  } else {
    console.log(`  PoseidonT3 already at ${PoseidonT3.address}`);
  }

  // Sanity-check the on-chain hash matches poseidon-lite's pure JS hash. If
  // these diverge, the contract code does not match what the circuit expects
  // and EVERY merkle root will be wrong.
  const preImg: [bigint, bigint] = [1234n, 5678n];
  const expected = BigInt(poseidon2(preImg));
  const got = (await publicClient.readContract({
    address: PoseidonT3.address as Address,
    abi: POSEIDON_T3_ABI,
    functionName: "hash",
    args: [preImg],
  })) as bigint;
  if (BigInt(got) !== expected) {
    throw new Error(
      `PoseidonT3 hash mismatch! contract=${got} expected=${expected}. Bytecode does not match poseidon-lite.`,
    );
  }
  return PoseidonT3.address as Address;
}

// Hardhat Ignition prompts interactively before deploying to any non-31337
// chain ("Confirm deploy to network sepolia (11155111)?"). With no TTY in our
// orchestrator subprocess, that prompt aborts the deploy. Setting these env
// vars (presence is enough; value is ignored) bypasses both confirmation
// gates. Source: @nomicfoundation/hardhat-ignition/dist/src/internal/tasks/deploy.js
const IGNITION_NONINTERACTIVE_ENV = {
  HARDHAT_IGNITION_CONFIRM_DEPLOYMENT: "1",
  HARDHAT_IGNITION_CONFIRM_RESET: "1",
};

async function runIgnitionDeploy(
  moduleRelPath: string,
  network: string,
  parameters: Record<string, Record<string, unknown>>,
) {
  // Write under os.tmpdir() (not BACKEND_DIR) so a hard kill of the
  // orchestrator doesn't leave .ignition-params-*.json files cluttering
  // the repo. Hardhat ignition reads the params file path as-is, so an
  // absolute path under /tmp works fine. PID disambiguates concurrent runs.
  const paramsFile = path.join(
    os.tmpdir(),
    `warptoad-ignition-${network}-${path.basename(moduleRelPath)}-${process.pid}.json`,
  );
  fs.writeFileSync(paramsFile, JSON.stringify(parameters, null, 2));
  try {
    await spawnInherit(
      "pnpm",
      [
        "exec",
        "hardhat",
        "ignition",
        "deploy",
        moduleRelPath,
        "--network",
        network,
        "--parameters",
        paramsFile,
      ],
      { env: IGNITION_NONINTERACTIVE_ENV },
    );
  } finally {
    if (fs.existsSync(paramsFile)) fs.unlinkSync(paramsFile);
  }
}

async function runIgnitionVerify(deploymentId: string, network: string) {
  await spawnInherit(
    "pnpm",
    ["exec", "hardhat", "ignition", "verify", deploymentId, "--network", network],
    { env: IGNITION_NONINTERACTIVE_ENV },
  );
}

async function main() {
  const REQUIRED = [
    "DEPLOYER_PRIVATE_KEY",
    "SEPOLIA_RPC_URL",
    "SCROLL_SEPOLIA_RPC_URL",
    "AZTEC_NODE_URL",
  ];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env in backend/.env: ${missing.join(", ")}`);
  }
  if (!process.env.ETHERSCAN_API_KEY) {
    console.warn("WARN: ETHERSCAN_API_KEY not set; phase 8 (etherscan verify) will be skipped.");
  }

  const pk = process.env.DEPLOYER_PRIVATE_KEY!;
  if (!pk.startsWith("0x")) {
    throw new Error("DEPLOYER_PRIVATE_KEY must start with 0x");
  }
  const account = privateKeyToAccount(pk as Hex);

  console.log("warp-toad testnet deploy");
  console.log("========================");
  console.log(`Deployer:    ${account.address}`);
  console.log(`Sepolia RPC: ${process.env.SEPOLIA_RPC_URL}`);
  console.log(`Scroll RPC:  ${process.env.SCROLL_SEPOLIA_RPC_URL}`);
  console.log(`Aztec node:  ${process.env.AZTEC_NODE_URL}`);

  const sepoliaPublic = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });
  const sepoliaWallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });
  const scrollPublic = createPublicClient({
    chain: scrollSepolia,
    transport: http(process.env.SCROLL_SEPOLIA_RPC_URL),
  });
  const scrollWallet = createWalletClient({
    account,
    chain: scrollSepolia,
    transport: http(process.env.SCROLL_SEPOLIA_RPC_URL),
  });

  // Sanity: chain ids match the URLs the user gave us.
  const [sepoliaChainId, scrollChainId] = await Promise.all([
    sepoliaPublic.getChainId(),
    scrollPublic.getChainId(),
  ]);
  if (sepoliaChainId !== 11155111) {
    throw new Error(`SEPOLIA_RPC_URL is not Sepolia (chainId=${sepoliaChainId}, expected 11155111)`);
  }
  if (scrollChainId !== 534351) {
    throw new Error(`SCROLL_SEPOLIA_RPC_URL is not Scroll Sepolia (chainId=${scrollChainId}, expected 534351)`);
  }

  // Balance check, warning only. Sepolia needs a few hundredths of an ETH for
  // the full L1 stack; Scroll is cheaper.
  const [sepoliaBal, scrollBal] = await Promise.all([
    sepoliaPublic.getBalance({ address: account.address }),
    scrollPublic.getBalance({ address: account.address }),
  ]);
  console.log(`Balances:    sepolia=${formatEther(sepoliaBal)} ETH, scroll=${formatEther(scrollBal)} ETH`);
  if (sepoliaBal < parseEther("0.05")) {
    console.warn(`WARN: low Sepolia balance (${formatEther(sepoliaBal)}); deploy may run out of gas.`);
  }
  if (scrollBal < parseEther("0.01")) {
    console.warn(`WARN: low Scroll Sepolia balance (${formatEther(scrollBal)}); deploy may run out of gas.`);
  }

  // ---------- Phase 1: Poseidon on Sepolia ----------
  console.log("\n=== Phase 1/8: PoseidonT3 on Sepolia ===");
  const sepoliaPoseidon = await deployPoseidon(sepoliaPublic, sepoliaWallet);
  console.log(`PoseidonT3 (Sepolia): ${sepoliaPoseidon}`);

  // ---------- Phase 2: L1Infra ignition deploy ----------
  console.log("\n=== Phase 2/8: hardhat ignition deploy L1Infra (Sepolia) ===");
  await runIgnitionDeploy("deploy/ignition/modules/L1Infra.ts", "sepolia", {
    L1WarpToadModule: { PoseidonT3LibAddress: sepoliaPoseidon },
    L1InfraModule: { L1ScrollMessengerAddress: L1_SCROLL_MESSENGER_SEPOLIA },
  });

  const sepoliaAddrs = loadAddresses(SEPOLIA_ADDR_FILE);
  const l1AztecAdapter = sepoliaAddrs["L1InfraModule#L1AztecBridgeAdapter"] as Address;
  const l1ScrollAdapter = sepoliaAddrs["L1InfraModule#L1ScrollBridgeAdapter"] as Address;
  if (!l1AztecAdapter || !l1ScrollAdapter) {
    throw new Error(`L1Infra deploy did not produce expected addresses. Got: ${JSON.stringify(sepoliaAddrs, null, 2)}`);
  }
  console.log(`L1AztecBridgeAdapter:  ${l1AztecAdapter}`);
  console.log(`L1ScrollBridgeAdapter: ${l1ScrollAdapter}`);

  // ---------- Phase 3: Aztec testnet ----------
  console.log("\n=== Phase 3/8: Aztec testnet (deployAztecTestnet.ts) ===");
  await spawnInherit("pnpm", ["exec", "tsx", "scripts/deployAztecTestnet.ts"]);

  const aztecAddrs = loadAddresses(AZTEC_ADDR_FILE);
  const aztecWarpToad = aztecAddrs.AztecWarpToad?.address as string | undefined;
  const l2AztecAdapter = aztecAddrs.L2AztecBridgeAdapter?.address as string | undefined;
  if (!aztecWarpToad || !l2AztecAdapter) {
    throw new Error(`Aztec deploy did not produce expected addresses. Got: ${JSON.stringify(aztecAddrs, null, 2)}`);
  }
  console.log(`AztecWarpToad:        ${aztecWarpToad}`);
  console.log(`L2AztecBridgeAdapter: ${l2AztecAdapter}`);

  // ---------- Phase 4: Poseidon on Scroll Sepolia ----------
  console.log("\n=== Phase 4/8: PoseidonT3 on Scroll Sepolia ===");
  const scrollPoseidon = await deployPoseidon(scrollPublic, scrollWallet);
  console.log(`PoseidonT3 (Scroll): ${scrollPoseidon}`);

  // ---------- Phase 5: L2Scroll ignition deploy ----------
  console.log("\n=== Phase 5/8: hardhat ignition deploy L2Scroll (Scroll Sepolia) ===");
  await runIgnitionDeploy("deploy/ignition/modules/L2Scroll.ts", "scrollSepolia", {
    L2ScrollModule: {
      PoseidonT3LibAddress: scrollPoseidon,
      L1ScrollBridgeAdapter: l1ScrollAdapter,
      l2ScrollMessengerAddress: L2_SCROLL_MESSENGER_SEPOLIA,
    },
  });

  const scrollAddrs = loadAddresses(SCROLL_ADDR_FILE);
  const l2ScrollAdapter = scrollAddrs["L2ScrollModule#L2ScrollBridgeAdapter"] as Address;
  if (!l2ScrollAdapter) {
    throw new Error(`L2Scroll deploy did not produce expected addresses. Got: ${JSON.stringify(scrollAddrs, null, 2)}`);
  }
  console.log(`L2ScrollBridgeAdapter: ${l2ScrollAdapter}`);

  // ---------- Phase 6: L1 wire (initialize calls) ----------
  console.log("\n=== Phase 6/8: hardhat ignition deploy L1Wire (Sepolia) ===");
  // The Aztec node's reported registry is the L1 contract address Aztec uses
  // as its rollup registry — L1AztecBridgeAdapter routes messages through it.
  const aztecNode = createAztecNodeClient(process.env.AZTEC_NODE_URL!);
  const aztecNodeInfo = await aztecNode.getNodeInfo();
  const aztecRegistry = aztecNodeInfo.l1ContractAddresses.registryAddress.toString() as Address;

  // WarpToadCore.initialize takes the Aztec WarpToad address as uint256 (a
  // 254-bit Aztec field element); the L1 adapter's L2 counterpart is bytes32.
  const aztecWarpToadUint = BigInt(aztecWarpToad).toString();
  const l2AztecAdapterBytes32 = pad(l2AztecAdapter as Hex, { size: 32 });

  await runIgnitionDeploy("deploy/ignition/modules/L1Wire.ts", "sepolia", {
    L1WarpToadModule: { PoseidonT3LibAddress: sepoliaPoseidon },
    L1InfraModule: { L1ScrollMessengerAddress: L1_SCROLL_MESSENGER_SEPOLIA },
    L1WireModule: {
      aztecRegistry,
      aztecWarpToadAddress: aztecWarpToadUint,
      l2AztecAdapterBytes32,
      l2ScrollAdapter,
    },
  });

  // ---------- Phase 7: L2 (Scroll) wire ----------
  console.log("\n=== Phase 7/8: hardhat ignition deploy L2ScrollWire (Scroll Sepolia) ===");
  await runIgnitionDeploy("deploy/ignition/modules/L2ScrollWire.ts", "scrollSepolia", {
    L2ScrollModule: {
      PoseidonT3LibAddress: scrollPoseidon,
      L1ScrollBridgeAdapter: l1ScrollAdapter,
      l2ScrollMessengerAddress: L2_SCROLL_MESSENGER_SEPOLIA,
    },
    L2ScrollWireModule: {
      l1ScrollBridgeAdapter: l1ScrollAdapter,
      aztecWarpToadAddress: aztecWarpToadUint,
    },
  });

  // ---------- Phase 8: Etherscan verify ----------
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\n=== Phase 8/9: Etherscan verify ===");
    // hardhat ignition deploy (Phases 2 / 5) runs hardhat compile internally,
    // which strips the per-contract artifact JSONs and resets the
    // userSourceNameMap patches that emitNpmArtifacts.ts emits for npm
    // sources. Without this, verify fails HHE100 on LazyIMT. Re-emit before
    // verify so the artifact + map are present and current.
    // Memory: hardhat3-npm-verify-user-source-map.
    await spawnInherit("pnpm", ["exec", "tsx", "scripts/emitNpmArtifacts.ts"]);

    try {
      console.log("\n-- verifying chain-11155111 (Sepolia) --");
      await runIgnitionVerify("chain-11155111", "sepolia");
    } catch (e) {
      console.warn(`Sepolia verify failed: ${(e as Error).message}; continuing.`);
    }
    try {
      console.log("\n-- verifying chain-534351 (Scroll Sepolia) --");
      await runIgnitionVerify("chain-534351", "scrollSepolia");
    } catch (e) {
      console.warn(`Scroll verify failed: ${(e as Error).message}; continuing.`);
    }
  } else {
    console.log("\n=== Phase 8/9: Etherscan verify -- SKIPPED (no ETHERSCAN_API_KEY) ===");
  }

  // ---------- Phase 9: AztecScan verify ----------
  // Aztec is not EVM and not handled by hardhat ignition verify; this calls
  // aztec-scan-sdk via scripts/verifyAztecScan.ts. Skip with
  // SKIP_AZTEC_SCAN_VERIFY=1 if AztecScan is down or you're iterating.
  if (process.env.SKIP_AZTEC_SCAN_VERIFY) {
    console.log("\n=== Phase 9/9: AztecScan verify -- SKIPPED (SKIP_AZTEC_SCAN_VERIFY set) ===");
  } else {
    console.log("\n=== Phase 9/9: AztecScan verify ===");
    try {
      await spawnInherit("pnpm", ["exec", "tsx", "scripts/verifyAztecScan.ts"]);
    } catch (e) {
      console.warn(`AztecScan verify failed: ${(e as Error).message}; continuing.`);
    }
  }

  console.log("\n========================================================");
  console.log("Testnet deploy COMPLETE.");
  console.log("========================================================");
  console.log("Sepolia:");
  for (const [k, v] of Object.entries(loadAddresses(SEPOLIA_ADDR_FILE))) {
    console.log(`  ${k.padEnd(45)} ${v}`);
  }
  console.log("Scroll Sepolia:");
  for (const [k, v] of Object.entries(loadAddresses(SCROLL_ADDR_FILE))) {
    console.log(`  ${k.padEnd(45)} ${v}`);
  }
  console.log("Aztec testnet:");
  for (const [k, v] of Object.entries(loadAddresses(AZTEC_ADDR_FILE))) {
    console.log(`  ${k.padEnd(25)} ${(v as any).address}`);
  }
  console.log("\nNext steps (run from repo root):");
  console.log("  pnpm bridge:dev    # bootstrap the giga roots once");
  console.log("  pnpm f:run         # build + preview the frontend (NOT pnpm f:dev)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDEPLOY FAILED:");
    console.error(err);
    process.exit(1);
  });
