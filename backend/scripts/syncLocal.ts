/**
 * Trigger an L1 -> Aztec gigaRoot bridge sync against the local sandbox.
 *
 * After a user burns on L1 with target=Aztec, the gigaRoot needs to:
 *   1. Be updated on L1 (gigaBridge.updateGigaRoot)
 *   2. Be sent via L1 -> L2 message (gigaBridge.sendGigaRoot)
 *   3. Be consumed on Aztec (L2AztecBridgeAdapter.receive_root)
 * Only THEN can the user mint on Aztec via mint_giga_root_evm.
 *
 * In production a relayer/keeper service runs continuously to do this. For the
 * sandbox, just run this script once after each L1 burn:
 *
 *   pnpm l:sync
 *
 * Re-uses the same `bridgeBetweenL1AndL2` orchestrator the passing
 * testL1ToAztec test uses, so the bridging shape is identical to what passes
 * tests. Reads addresses from the freshly-written deployment files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import {
    updateGigaRoot,
    sendGigaRoot,
    receiveGigaRootOnAztec,
    getPayableGigaRootRecipients,
} from "../lib/bridging";
import { initPXE, getAztecTestAccounts } from "../deploy/utils/aztecUtilsNoEnv";
import { WarpToadCoreContractArtifact, WarpToadCoreContract } from "../aztec/WarpToadCore/src/artifacts/WarpToadCore.js";
import { L2AztecBridgeAdapterContractArtifact, L2AztecBridgeAdapterContract } from "../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js";
import { getViemContract } from "./utils";
import { AZTEC_NODE_URL } from "../test/helpers/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Anvil dev account #1 (account #0 is reserved for the Aztec sandbox sequencer
// to publish L1 txs - using it here would race against sandbox publishing).
const ANVIL_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

async function main() {
    // ========================================================================
    // Step 1: Load deployed addresses
    // ========================================================================
    const l1AddressesPath = path.resolve(__dirname, "../deploy/ignition/deployments/chain-31337/deployed_addresses.json");
    const aztecAddressesPath = path.resolve(__dirname, "../deploy/aztec/aztecDeployments/31337/deployed_addresses.json");

    if (!fs.existsSync(l1AddressesPath) || !fs.existsSync(aztecAddressesPath)) {
        throw new Error(
            `Missing deployment files. Run \`pnpm l:deploy\` first.\n` +
            `  Expected: ${l1AddressesPath}\n` +
            `  Expected: ${aztecAddressesPath}`,
        );
    }

    const l1Addrs = JSON.parse(fs.readFileSync(l1AddressesPath, "utf8")) as Record<string, string>;
    const aztecAddrs = JSON.parse(fs.readFileSync(aztecAddressesPath, "utf8")) as {
        AztecWarpToad: { address: string; constructorArgs: any[]; salt: string; deployer: string };
        L2AztecBridgeAdapter: { address: string; constructorArgs: any[]; salt: string; deployer: string };
    };

    const l1WarpToadAddress = l1Addrs["L1InfraModule#L1WarpToad"] || l1Addrs["L1WarpToadModule#L1WarpToad"];
    const gigaBridgeAddress = l1Addrs["L1InfraModule#GigaBridge"];
    const l1AztecBridgeAdapterAddress = l1Addrs["L1InfraModule#L1AztecBridgeAdapter"];
    if (!l1WarpToadAddress || !gigaBridgeAddress || !l1AztecBridgeAdapterAddress) {
        throw new Error(`Missing L1 addresses in ${l1AddressesPath}`);
    }

    console.log("Loaded addresses:");
    console.log(`  L1WarpToad             ${l1WarpToadAddress}`);
    console.log(`  GigaBridge             ${gigaBridgeAddress}`);
    console.log(`  L1AztecBridgeAdapter   ${l1AztecBridgeAdapterAddress}`);
    console.log(`  Aztec WarpToadCore     ${aztecAddrs.AztecWarpToad.address}`);
    console.log(`  L2AztecBridgeAdapter   ${aztecAddrs.L2AztecBridgeAdapter.address}`);

    // ========================================================================
    // Step 2: Build L1 viem clients + contract handles
    // ========================================================================
    const l1PublicClient = createPublicClient({ transport: http("http://localhost:8545") });
    const l1Wallet = createWalletClient({
        account: privateKeyToAccount(ANVIL_KEY),
        transport: http("http://localhost:8545"),
    });

    const l1WarpToad = await getViemContract("L1WarpToad", l1WarpToadAddress, l1PublicClient as any, l1Wallet as any);
    const gigaBridge = await getViemContract("GigaBridge", gigaBridgeAddress, l1PublicClient as any, l1Wallet as any);
    const l1AztecBridgeAdapter = await getViemContract("L1AztecBridgeAdapter", l1AztecBridgeAdapterAddress, l1PublicClient as any, l1Wallet as any);

    // ========================================================================
    // Step 3: Build Aztec wallet + reconstruct Aztec contract handles from
    // the saved deploy metadata. Mirrors how the frontend's getWarpToadContract
    // does it: getContractInstanceFromInstantiationParams + registerContract.
    // ========================================================================
    console.log("\nConnecting to Aztec sandbox...");
    const node = createAztecNodeClient(AZTEC_NODE_URL);
    const l1ChainId = BigInt(await l1PublicClient.getChainId());
    await initPXE(node, l1ChainId);
    const aztecWallets = await getAztecTestAccounts(node);
    const aztecDeployer = aztecWallets[0];

    // Reconstruct Aztec WarpToadCore from saved metadata
    const warpToadConstructorArgs = aztecAddrs.AztecWarpToad.constructorArgs.map((v: any, i: number) => {
        // Decimals (last arg) needs to be a bigint; the rest are strings as-is.
        if (i === aztecAddrs.AztecWarpToad.constructorArgs.length - 1) return BigInt(v);
        return v;
    });
    const warpToadInstance = await getContractInstanceFromInstantiationParams(WarpToadCoreContractArtifact, {
        constructorArgs: warpToadConstructorArgs,
        deployer: AztecAddress.fromString(aztecAddrs.AztecWarpToad.deployer),
        salt: Fr.fromHexString(aztecAddrs.AztecWarpToad.salt),
    });
    await aztecDeployer.registerContract(warpToadInstance, WarpToadCoreContractArtifact);
    const aztecWarpToad = await WarpToadCoreContract.at(warpToadInstance.address, aztecDeployer);

    // Reconstruct L2AztecBridgeAdapter
    const adapterInstance = await getContractInstanceFromInstantiationParams(L2AztecBridgeAdapterContractArtifact, {
        constructorArgs: aztecAddrs.L2AztecBridgeAdapter.constructorArgs,
        deployer: AztecAddress.fromString(aztecAddrs.L2AztecBridgeAdapter.deployer),
        salt: Fr.fromHexString(aztecAddrs.L2AztecBridgeAdapter.salt),
    });
    await aztecDeployer.registerContract(adapterInstance, L2AztecBridgeAdapterContractArtifact);
    const aztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(adapterInstance.address, aztecDeployer);

    // ========================================================================
    // Step 4: L1->Aztec sync (only). We deliberately SKIP the L2->L1 root
    // bridging step (`bridgeLocalRootToL1`) that `bridgeBetweenL1AndL2` does:
    //
    //   - That step sends the current Aztec note-hash-tree root to L1 so the
    //     L1AztecBridgeAdapter has a fresh local root. It's ONLY needed for the
    //     Aztec->L1 direction (where the user proves their burn-on-Aztec note
    //     against the gigaRoot).
    //   - The Aztec->L1 step also waits for an Aztec L2->L1 message to be
    //     proven, which can hang for many minutes on a long-running sandbox
    //     because the prover falls behind.
    //   - For L1->Aztec, the proof goes through L1WarpToad's local root, not
    //     the L1AztecBridgeAdapter's. So skipping the L2->L1 step is fine; the
    //     gigaRoot just uses whatever the adapter's old local root happens to be.
    //
    // If you need a full bidirectional sync, restart the sandbox first
    // (`aztec start --local-network`) and re-run `pnpm l:deploy`, then use the
    // test suite (`pnpm b:test`) which does the full thing inline.
    // ========================================================================
    const localRootProviders = [l1WarpToadAddress, l1AztecBridgeAdapterAddress] as `0x${string}`[];
    const payableLocalRootProviders = await getPayableGigaRootRecipients(l1ChainId);
    const isSandbox = l1ChainId === 31337n;
    const confirmations = isSandbox ? 1 : 3;

    console.log("\n--- updating gigaRoot on L1 ---");
    const { gigaRootUpdateTxHash } = await updateGigaRoot(
        l1PublicClient as any,
        l1Wallet as any,
        gigaBridge,
        localRootProviders,
        confirmations,
    );
    console.log(`  ✓ updateGigaRoot ${gigaRootUpdateTxHash}`);

    console.log("\n--- sending gigaRoot to Aztec via L1->L2 message ---");
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

    console.log("\n--- consuming the L1->L2 message on Aztec ---");
    // Param order from lib/bridging.ts:286 (NOT the same as receiveGigaRootOnL2!):
    //   L2AztecBridgeAdapter (Aztec contract),
    //   L1AztecBridgeAdapter (viem contract),
    //   AztecWarpToad,
    //   publicClient,
    //   sendGigaRootTx,
    //   aztecNode,
    //   isSandBox?,
    //   sponsoredPaymentMethod?,
    //   aztecWallet?,
    await receiveGigaRootOnAztec(
        aztecBridgeAdapter,
        l1AztecBridgeAdapter,
        aztecWarpToad,
        l1PublicClient as any,
        sendGigaRootTx,
        node,
        isSandbox,
        undefined, // sponsoredPaymentMethod
        aztecDeployer,
    );
    console.log(`  ✓ receiveGigaRootOnAztec`);

    // Cross-check that the gigaRoot landed on Aztec
    const aztecDeployerAddr = (await aztecDeployer.getAccounts())[0].item;
    const { result: aztecGigaRootRaw } = await aztecWarpToad.methods.get_giga_root().simulate({ from: aztecDeployerAddr }) as any;
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
        console.error(err);
        process.exit(1);
    });
