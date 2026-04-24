/**
 * Aztec -> L1 sync. Run after burning on Aztec, before withdrawing on L1.
 *
 * Steps:
 *   1. Send Aztec note hash tree root to L1 via L2AztecBridgeAdapter.send_root_to_l1
 *   2. Wait for the resulting L2->L1 message to be in a proven epoch
 *   3. Read the message's membership witness (root, leafIndex, siblingPath)
 *   4. Wait for the L1 outbox to expose the proven root for that epoch
 *   5. Call L1AztecBridgeAdapter.getNewRootFromL2 to register the new local root
 *   6. updateGigaRoot + sendGigaRoot + receiveGigaRootOnAztec (so the gigaRoot
 *      tree includes the fresh L1AztecBridgeAdapter local root)
 *
 * Differences from `lib/bridging.ts:bridgeAZTECLocalRootToL1`:
 *   - Uses the canonical `computeL2ToL1MembershipWitness(node, msg, txHash)` API
 *     instead of manually computing the epoch from `messageSlot / epochDuration`.
 *     The canonical API reads the epoch from `getTxReceipt(txHash).epochNumber`,
 *     which is always correct, and returns `undefined` (not null/throws) when
 *     the tx isn't yet in a proven epoch - making polling much cleaner.
 *   - Verbose diagnostic logging on every poll. Prints the tx's current
 *     epoch and block number, and the proven head, so we SEE what's actually
 *     happening instead of guessing.
 *
 * Usage: `pnpm l:sync:from-aztec`
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, parseEventLogs, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { computeL2ToL1MembershipWitness } from "@aztec/stdlib/messaging";
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

const ANVIL_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

const OUTBOX_ABI = [
    { type: "function", name: "getRootData", stateMutability: "view", inputs: [{ name: "_epoch", type: "uint256" }], outputs: [{ name: "root", type: "bytes32" }] },
] as const;

function sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
}

async function main() {
    // ========================================================================
    // Step 1: Load deployed addresses
    // ========================================================================
    const l1AddressesPath = path.resolve(__dirname, "../deploy/ignition/deployments/chain-31337/deployed_addresses.json");
    const aztecAddressesPath = path.resolve(__dirname, "../deploy/aztec/aztecDeployments/31337/deployed_addresses.json");
    const l1Addrs = JSON.parse(fs.readFileSync(l1AddressesPath, "utf8")) as Record<string, string>;
    const aztecAddrs = JSON.parse(fs.readFileSync(aztecAddressesPath, "utf8")) as any;

    const l1WarpToadAddress = (l1Addrs["L1InfraModule#L1WarpToad"] || l1Addrs["L1WarpToadModule#L1WarpToad"]) as Address;
    const gigaBridgeAddress = l1Addrs["L1InfraModule#GigaBridge"] as Address;
    const l1AztecBridgeAdapterAddress = l1Addrs["L1InfraModule#L1AztecBridgeAdapter"] as Address;

    // ========================================================================
    // Step 2: Build L1 viem clients + contract handles
    // ========================================================================
    const l1PublicClient = createPublicClient({ transport: http("http://localhost:8545") });
    const l1Wallet = createWalletClient({
        account: privateKeyToAccount(ANVIL_KEY),
        transport: http("http://localhost:8545"),
    });
    const gigaBridge = await getViemContract("GigaBridge", gigaBridgeAddress, l1PublicClient as any, l1Wallet as any);
    const l1AztecBridgeAdapter = await getViemContract("L1AztecBridgeAdapter", l1AztecBridgeAdapterAddress, l1PublicClient as any, l1Wallet as any);

    // ========================================================================
    // Step 3: Aztec wallet + reconstruct contracts
    // ========================================================================
    console.log("Connecting to Aztec sandbox...");
    const node = createAztecNodeClient(AZTEC_NODE_URL);
    const l1ChainId = BigInt(await l1PublicClient.getChainId());
    await initPXE(node, l1ChainId);
    const aztecWallets = await getAztecTestAccounts(node);
    const aztecDeployer = aztecWallets[0];

    const warpToadCtorArgs = aztecAddrs.AztecWarpToad.constructorArgs.map((v: any, i: number) =>
        i === aztecAddrs.AztecWarpToad.constructorArgs.length - 1 ? BigInt(v) : v,
    );
    const warpToadInstance = await getContractInstanceFromInstantiationParams(WarpToadCoreContractArtifact, {
        constructorArgs: warpToadCtorArgs,
        deployer: AztecAddress.fromString(aztecAddrs.AztecWarpToad.deployer),
        salt: Fr.fromHexString(aztecAddrs.AztecWarpToad.salt),
    });
    await aztecDeployer.registerContract(warpToadInstance, WarpToadCoreContractArtifact);
    const aztecWarpToad = await WarpToadCoreContract.at(warpToadInstance.address, aztecDeployer);

    const adapterInstance = await getContractInstanceFromInstantiationParams(L2AztecBridgeAdapterContractArtifact, {
        constructorArgs: aztecAddrs.L2AztecBridgeAdapter.constructorArgs,
        deployer: AztecAddress.fromString(aztecAddrs.L2AztecBridgeAdapter.deployer),
        salt: Fr.fromHexString(aztecAddrs.L2AztecBridgeAdapter.salt),
    });
    await aztecDeployer.registerContract(adapterInstance, L2AztecBridgeAdapterContractArtifact);
    const aztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(adapterInstance.address, aztecDeployer);

    const aztecDeployerAddr = (await aztecDeployer.getAccounts())[0].item;

    // ========================================================================
    // Step 4: Send the Aztec note hash tree root via L2->L1 message
    // ========================================================================
    console.log("\n--- step 1/6: send_root_to_l1 (Aztec L2 -> L1 message) ---");
    const blockNumberOfRoot = await node.getBlockNumber();
    const blockOfRoot = await node.getBlock(blockNumberOfRoot);
    const PXE_L2Root = blockOfRoot?.header.state.partial.noteHashTree.root as Fr;
    console.log(`  PXE L2 root: ${PXE_L2Root.toString()} (block ${blockNumberOfRoot})`);

    const sendRootTx = await aztecBridgeAdapter.methods
        .send_root_to_l1(blockNumberOfRoot)
        .send({ from: aztecDeployerAddr });
    console.log(`  ✓ tx sent: ${sendRootTx.receipt.txHash.toString()}`);

    // ========================================================================
    // Step 5: Wait for the L2->L1 message to be in a proven epoch.
    // Uses the canonical computeL2ToL1MembershipWitness which reads epoch
    // from the tx receipt, NOT from manual messageSlot/epochDuration math.
    // ========================================================================
    console.log("\n--- step 2/6: wait for L2->L1 message to land in proven epoch ---");
    const sendRootTxHash = sendRootTx.receipt.txHash;
    const sendRootEffect = await node.getTxEffect(sendRootTxHash);
    const messageHash = sendRootEffect?.data.l2ToL1Msgs[0] as Fr;
    if (!messageHash) throw new Error("No L2->L1 message found in send_root_to_l1 tx effect");
    console.log(`  message hash: ${messageHash.toString()}`);

    const startWait = Date.now();
    const maxWaitMs = 5 * 60_000; // 5 minutes
    let witness: Awaited<ReturnType<typeof computeL2ToL1MembershipWitness>> | undefined;
    let pollCount = 0;
    while (!witness) {
        try {
            witness = await computeL2ToL1MembershipWitness(node, messageHash, sendRootTxHash);
        } catch (e: any) {
            // Surface the error instead of silently swallowing it
            console.warn(`  computeL2ToL1MembershipWitness threw: ${e?.message ?? e}`);
        }
        if (witness) break;

        // Diagnostic every 10s
        if (pollCount % 5 === 0) {
            const receipt = await node.getTxReceipt(sendRootTxHash);
            const provenBlock = await (node as any).getProvenBlockNumber?.() ?? "?";
            const headBlock = await node.getBlockNumber();
            console.log(`  waiting (${Math.round((Date.now() - startWait) / 1000)}s)... tx={epoch=${receipt.epochNumber}, block=${receipt.blockNumber}}, head=${headBlock}, proven=${provenBlock}`);
        }
        pollCount++;

        if (Date.now() - startWait > maxWaitMs) {
            const receipt = await node.getTxReceipt(sendRootTxHash);
            throw new Error(
                `Timed out waiting for L2->L1 membership witness after ${Math.round((Date.now() - startWait) / 1000)}s.\n` +
                `  tx hash: ${sendRootTxHash.toString()}\n` +
                `  tx epoch: ${receipt.epochNumber}\n` +
                `  tx block: ${receipt.blockNumber}\n` +
                `  message hash: ${messageHash.toString()}\n` +
                `Check if the sandbox prover is advancing.`,
            );
        }
        await sleep(2000);
    }

    console.log(`  ✓ witness found in epoch ${witness.epochNumber}, leafIndex=${witness.leafIndex}`);

    // ========================================================================
    // Step 6: Wait for the L1 outbox to expose the proven epoch's root
    // ========================================================================
    console.log("\n--- step 3/6: wait for L1 outbox to expose epoch root ---");
    const outboxAddress = (await l1AztecBridgeAdapter.read.outbox()) as Address;
    console.log(`  outbox: ${outboxAddress}`);
    const outboxStart = Date.now();
    const outboxTimeoutMs = 2 * 60_000;
    while (true) {
        const rootHex = await l1PublicClient.readContract({
            address: outboxAddress,
            abi: OUTBOX_ABI,
            functionName: "getRootData",
            args: [BigInt(witness.epochNumber)],
        }) as Hex;
        if (rootHex && rootHex !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            console.log(`  ✓ outbox root for epoch ${witness.epochNumber}: ${rootHex}`);
            break;
        }
        if (Date.now() - outboxStart > outboxTimeoutMs) {
            throw new Error(`L1 outbox never exposed root for epoch ${witness.epochNumber}`);
        }
        if (Math.round((Date.now() - outboxStart) / 1000) % 10 === 0) {
            console.log(`  waiting for L1 outbox to settle epoch ${witness.epochNumber} (${Math.round((Date.now() - outboxStart) / 1000)}s)`);
        }
        await sleep(3_000);
    }

    // ========================================================================
    // Step 7: Call L1AztecBridgeAdapter.getNewRootFromL2 to register the new
    // local root on L1 (this is the value the L1 GigaBridge will read for the
    // adapter when computing the next gigaRoot).
    // ========================================================================
    console.log("\n--- step 4/6: register new Aztec local root on L1 ---");
    const siblingPathArray = witness.siblingPath.toFields().map((f: any) => f.toString());
    const args = [
        PXE_L2Root.toString() as Hex,
        BigInt(blockNumberOfRoot),
        BigInt(witness.epochNumber),
        BigInt(witness.leafIndex),
        siblingPathArray.map((s: string) => s as Hex),
    ] as const;
    const refreshHash = await (l1AztecBridgeAdapter.write as any).getNewRootFromL2(args);
    await l1PublicClient.waitForTransactionReceipt({ hash: refreshHash });
    console.log(`  ✓ getNewRootFromL2 ${refreshHash}`);

    // ========================================================================
    // Step 8: Update + send + receive gigaRoot, same as the L1->Aztec sync
    // ========================================================================
    const localRootProviders = [l1WarpToadAddress, l1AztecBridgeAdapterAddress] as Address[];
    const payableLocalRootProviders = await getPayableGigaRootRecipients(l1ChainId);
    const isSandbox = l1ChainId === 31337n;
    const confirmations = isSandbox ? 1 : 3;

    console.log("\n--- step 5/6: updateGigaRoot + sendGigaRoot ---");
    const { gigaRootUpdateTxHash } = await updateGigaRoot(
        l1PublicClient as any,
        l1Wallet as any,
        gigaBridge,
        localRootProviders,
        confirmations,
    );
    console.log(`  ✓ updateGigaRoot ${gigaRootUpdateTxHash}`);

    const { sendGigaRootTx, sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
        l1PublicClient as any,
        l1Wallet as any,
        gigaBridge,
        localRootProviders,
        payableLocalRootProviders,
        confirmations,
    );
    console.log(`  ✓ sendGigaRoot ${sendGigaRootTxHash}`);

    console.log("\n--- step 6/6: receiveGigaRootOnAztec ---");
    await receiveGigaRootOnAztec(
        aztecBridgeAdapter,
        l1AztecBridgeAdapter,
        aztecWarpToad,
        l1PublicClient as any,
        sendGigaRootTx,
        node,
        isSandbox,
        undefined,
        aztecDeployer,
    );

    const { result: aztecGigaRootRaw } = await aztecWarpToad.methods.get_giga_root().simulate({ from: aztecDeployerAddr }) as any;
    const aztecGigaRoot = BigInt(aztecGigaRootRaw.toString());
    const l1GigaRoot = BigInt(await gigaBridge.read.gigaRoot());

    console.log("\n--- gigaRoot status ---");
    console.log(`  L1 GigaBridge.gigaRoot:   ${l1GigaRoot}`);
    console.log(`  Aztec WarpToad.gigaRoot:  ${aztecGigaRoot}`);
    if (l1GigaRoot === aztecGigaRoot) {
        console.log(`  ✓ MATCH - Aztec->L1 withdraw is now possible`);
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
