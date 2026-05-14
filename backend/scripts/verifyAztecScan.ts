/**
 * Verify warp-toad's Aztec contracts on AztecScan.
 *
 * Reads `deployed_addresses.json` (the file `deployTestnet.ts` writes),
 * reconstructs the on-chain ContractInstanceWithAddress from the saved
 * (salt, deployer, constructorArgs) + the local artifact, and submits the
 * verification through `aztec-scan-sdk` exactly like the SDK README example
 * (just without the deploy step).
 *
 * Usage:
 *   pnpm verify:aztec-scan
 *   tsx scripts/verifyAztecScan.ts --chainId 11155111 --network testnet
 *
 * Env (optional, overrides network preset):
 *   EXPLORER_API_URL, API_KEY
 *
 * Note: `aztec-scan-sdk` is installed from git and ships no prebuilt dist.
 * `pnpm verify:aztec-scan` runs the SDK build first. If invoking with tsx
 * directly, run `pnpm build:aztec-scan-sdk` once after a fresh install.
 */

import fs from "fs/promises";
import path from "path";

import { ArgumentParser } from "argparse";
import { AztecScanClient, fromContractInstance, type DeployerMetadata, type NetworkName } from "aztec-scan-sdk";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { loadContractArtifact, type NoirCompiledContract } from "@aztec/aztec.js/abi";

import type { DeploymentArtifact } from "../lib/types.js";
import { getAztecDeployedAddressesFolderPath } from "./utils.js";
import { AZTEC_SCAN_CHAINS } from "lib/constants.js";

function metadataFor(contractName: string, chainId: bigint): DeployerMetadata {
    return {
        contractIdentifier: contractName,
        details: `WarpToad ${contractName} deployment on L1 chain ${chainId}`,
        creatorName: "warp-toad",
        creatorContact: "",
        appUrl: "https://warptoad.xyz",
        repoUrl: "https://github.com/warptoad/warp-toad",
        aztecScanNotes: {
            name: contractName,
            origin: "warp-toad",
            comment: `Verified via scripts/verifyAztecScan.ts for L1 chain ${chainId}.`,
        },
    };
}

async function verifyContract(
    client: AztecScanClient,
    deployment: DeploymentArtifact,
    deployerMetadata: DeployerMetadata
): Promise<{ ok: boolean }> {
    // this artifact has bytecode as base64 aztecscan likes that :D
    const rawArtifact = deployment.rawArtifact;

    // ---recreate contract instance ----
    // this artifact has bytecode as buffer, which aztecscan does not like!!
    const artifact = loadContractArtifact(rawArtifact as unknown as NoirCompiledContract);
    const constructorArgs = deployment.constructorArgs.map((v) => v.startsWith("0x") ? new Fr(BigInt(v)) : v);
    const instance = await getContractInstanceFromInstantiationParams(artifact, {
        salt: Fr.fromHexString(deployment.salt),
        deployer: AztecAddress.fromField(Fr.fromHexString(deployment.deployer)),
        constructorArgs,
    });

    // use aztec scan sdk to get inputs for verification
    const { address, contractClassId, verifyInstanceArgs } = fromContractInstance(instance as any, {
        constructorArgs,
    });

    const artifactRes = await client.verifyArtifact(contractClassId, instance.version, rawArtifact as any as Record<string, unknown>);
    const instanceRes = await client.verifyInstance(
        address,
        { ...verifyInstanceArgs, artifactObj: rawArtifact as any as Record<string, unknown> },
        deployerMetadata,
    )


    console.log(`
        Verified: 
            artifactRes:    ${artifactRes.statusText}
            instance:       ${instanceRes.statusText}

        Address:            ${address}
        contractClassId:    ${contractClassId}
        version:            ${instance.version}
        `)


    if (artifactRes.ok === false || instanceRes.ok === false) {
        if (!artifactRes.ok) console.error(`    artifact response:`, artifactRes.data);
        if (!instanceRes.ok) console.error(`    instance response:`, instanceRes.data);
        return { ok: false };
    } else {
        return { ok: true };
    }
}

async function main() {
    const parser = new ArgumentParser({ description: "Verify warp-toad Aztec contracts on AztecScan" });
    parser.add_argument("--network", { choices: ["devnet", "testnet", "mainnet"], help: "aztec-scan network preset" });
    const args = parser.parse_args() as { chainId: number; network?: NetworkName };
    const network = args.network ?? "testnet";
    const l1ChainId = AZTEC_SCAN_CHAINS[network].l1ChainId

    console.log(`Verifying Aztec contracts on aztec-scan ${network}`);
    const client = new AztecScanClient({ network });
    console.log(`  explorerApiUrl: ${client.config.explorerApiUrl}`);

    const folderPath = getAztecDeployedAddressesFolderPath(l1ChainId);
    const files = await fs.readdir(folderPath);
    const artifactFiles = files.filter(f => f.endsWith("_deploymentArtifact.json"));

    for (const fileName of artifactFiles) {
        const contractName = fileName.replace("_deploymentArtifact.json", "");
        const deployment = JSON.parse(await fs.readFile(path.join(folderPath, fileName), "utf8")) as DeploymentArtifact;
        const deploymentMetaData = metadataFor(contractName, l1ChainId);
        console.log(`\n=== ${contractName} ===`);
        await verifyContract(client, deployment, deploymentMetaData);
    }

}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
