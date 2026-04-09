/**
 * Deploy the full warp-toad stack (L1 + Aztec) to a local sandbox: anvil L1 at
 * localhost:8545 and Aztec node at localhost:8080. Both are bundled by
 * `aztec start --local-network`.
 *
 * Writes the resulting addresses to two files:
 *   - `backend/deploy/ignition/deployments/chain-31337/deployed_addresses.json`
 *     (frontend `pull:addresses` reads this for L1 contracts)
 *   - `backend/deploy/aztec/aztecDeployments/31337/deployed_addresses.json`
 *     (frontend `chains.ts` imports this directly for Aztec contracts)
 *
 * Usage:
 *   pnpm hardhat run scripts/deployLocal.ts --network local
 *
 * Or via the workspace shortcut:
 *   pnpm l:deploy
 *
 * Run this once after every sandbox restart - the Aztec sandbox restarts
 * BOTH anvil and the Aztec node each time you `aztec start --local-network`,
 * wiping all deployed state on both sides.
 *
 * Re-uses the test helpers (`deployEvmContracts`, `deployAztecContracts`)
 * the test suite uses, so the deployment shape is identical to what passes
 * tests. The only extra work is capturing the Aztec contract metadata
 * (constructorArgs, salt, deployer) that the frontend's chains.ts reads.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deployEvmContracts } from "../test/helpers/deploy-evm";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Contract } from "@aztec/aztec.js/contracts";
import type { EthAddressLike } from "@aztec/aztec.js/abi";
import { initPXE, getAztecTestAccounts } from "../deploy/utils/aztecUtilsNoEnv";
import { WarpToadCoreContractArtifact } from "../aztec/WarpToadCore/src/artifacts/WarpToadCore.js";
import { L2AztecBridgeAdapterContractArtifact } from "../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js";
import { AZTEC_NODE_URL } from "../test/helpers/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AztecDeploymentMetadata {
    address: string;
    constructorArgs: string[];
    salt: string;
    deployer: string;
}

async function main() {
    // ========================================================================
    // Step 1: Deploy L1 EVM stack (USDcoin, L1WarpToad, GigaBridge,
    // L1AztecBridgeAdapter, withdraw verifier, all libraries).
    // ========================================================================
    console.log("Deploying L1 stack to localhost anvil...");
    const evm = await deployEvmContracts({ withAztecAdapter: true });

    if (!evm.l1AztecBridgeAdapter) {
        throw new Error("L1AztecBridgeAdapter was not deployed - check deployEvmContracts");
    }

    const l1ChainId = BigInt(await evm.publicClient.getChainId());
    console.log("\nL1 deployed:");
    console.log(`  USDcoin                ${evm.nativeToken.address}`);
    console.log(`  L1WarpToad             ${evm.l1WarpToad.address}`);
    console.log(`  GigaBridge             ${evm.gigaBridge.address}`);
    console.log(`  L1AztecBridgeAdapter   ${evm.l1AztecBridgeAdapter.address}`);

    // ========================================================================
    // Step 2: Deploy Aztec stack (WarpToadCore, L2AztecBridgeAdapter).
    // Mirrors test/helpers/deploy-aztec.ts but captures the metadata
    // (constructorArgs, salt, deployer) the frontend needs to reconstruct
    // contract instances at runtime.
    // ========================================================================
    console.log("\nDeploying Aztec stack to sandbox...");
    const node = createAztecNodeClient(AZTEC_NODE_URL);
    const pxe = await initPXE(node, l1ChainId);
    const wallets = await getAztecTestAccounts(node);
    const deployerWallet = wallets[0];
    const deployerAccounts = await deployerWallet.getAccounts();
    const deployer = deployerAccounts[0].item;

    // Deploy WarpToadCore. Constructor args: (nativeToken, name, symbol, decimals)
    const warpToadConstructorArgs = [
        evm.nativeToken.address,
        "wrpToad-TestUSD",
        "wrpToad-TUSD",
        6n,
    ];
    console.log("  Deploying WarpToadCore...");
    const warpToadDeploy = Contract.deploy(
        deployerWallet,
        WarpToadCoreContractArtifact,
        warpToadConstructorArgs,
    );
    const { contract: warpToad } = await warpToadDeploy.send({ from: deployer });
    const warpToadInstance = await warpToadDeploy.getInstance();
    console.log(`  WarpToadCore           ${warpToad.address.toString()}`);

    // Deploy L2AztecBridgeAdapter. Constructor args: (l1BridgeAdapterAddress)
    const adapterConstructorArgs = [evm.l1AztecBridgeAdapter.address];
    console.log("  Deploying L2AztecBridgeAdapter...");
    const adapterDeploy = Contract.deploy(
        deployerWallet,
        L2AztecBridgeAdapterContractArtifact,
        adapterConstructorArgs,
    );
    const { contract: bridgeAdapter } = await adapterDeploy.send({ from: deployer });
    const adapterInstance = await adapterDeploy.getInstance();
    console.log(`  L2AztecBridgeAdapter   ${bridgeAdapter.address.toString()}`);

    // ========================================================================
    // Step 3: Wire the contracts together.
    //   - Aztec WarpToadCore.initialize(bridgeAdapter, l1AztecBridgeAdapter)
    //   - L1 WarpToad.initialize(gigaBridge, self, aztecWarpToadAddress)
    //   - L1 L1AztecBridgeAdapter.initialize(registry, l2BridgeAdapter, gigaBridge)
    // ========================================================================
    console.log("\nWiring contracts...");

    console.log("  Initializing WarpToadCore on Aztec...");
    await (warpToad as any).methods
        .initialize(bridgeAdapter.address, evm.l1AztecBridgeAdapter.address as any as EthAddressLike)
        .send({ from: deployer });

    console.log("  Initializing L1WarpToad with Aztec WarpToad address...");
    const aztecWarpToadAddressBigInt = BigInt(warpToad.address.toString());
    const initL1Hash = await (evm.l1WarpToad.write.initialize as any)([
        evm.gigaBridge.address,
        evm.l1WarpToad.address,
        aztecWarpToadAddressBigInt,
    ]);
    await evm.publicClient.waitForTransactionReceipt({ hash: initL1Hash });

    console.log("  Initializing L1AztecBridgeAdapter (registry + L2 adapter + gigaBridge)...");
    const aztecNodeInfo = await node.getNodeInfo();
    const registryAddress = aztecNodeInfo.l1ContractAddresses.registryAddress.toString();
    const l2BridgeAdapterAddressBytes32 = bridgeAdapter.address.toString();
    const initAdapterHash = await (evm.l1AztecBridgeAdapter.write.initialize as any)([
        registryAddress,
        l2BridgeAdapterAddressBytes32,
        evm.gigaBridge.address,
    ]);
    await evm.publicClient.waitForTransactionReceipt({ hash: initAdapterHash });

    // ========================================================================
    // Step 4: Write address files.
    // ========================================================================
    console.log("\nWriting address files...");

    // L1 EVM addresses (frontend pull-addresses script reads this)
    const l1Addresses: Record<string, string> = {
        "TestToken#USDcoin": evm.nativeToken.address,
        "L1WarpToadModule#L1WarpToad": evm.l1WarpToad.address,
        "L1WarpToadModule#WithdrawVerifier": evm.withdrawVerifier.address,
        "L1InfraModule#GigaBridge": evm.gigaBridge.address,
        "L1InfraModule#L1WarpToad": evm.l1WarpToad.address,
        "L1InfraModule#L1AztecBridgeAdapter": evm.l1AztecBridgeAdapter.address,
    };
    const l1OutDir = path.resolve(__dirname, "../deploy/ignition/deployments/chain-31337");
    fs.mkdirSync(l1OutDir, { recursive: true });
    fs.writeFileSync(
        path.join(l1OutDir, "deployed_addresses.json"),
        JSON.stringify(l1Addresses, null, 2) + "\n",
    );

    // Aztec addresses (frontend chains.ts imports this directly)
    const aztecAddresses: Record<string, AztecDeploymentMetadata> = {
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
    const aztecOutDir = path.resolve(__dirname, "../deploy/aztec/aztecDeployments/31337");
    fs.mkdirSync(aztecOutDir, { recursive: true });
    fs.writeFileSync(
        path.join(aztecOutDir, "deployed_addresses.json"),
        JSON.stringify(aztecAddresses, null, 2) + "\n",
    );

    console.log(`  L1: ${path.join(l1OutDir, "deployed_addresses.json")}`);
    console.log(`  Aztec: ${path.join(aztecOutDir, "deployed_addresses.json")}`);
    console.log("\nNext: pnpm --filter frontend pull:addresses (or `pnpm l:deploy` does both)");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
