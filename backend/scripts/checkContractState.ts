import hre from "hardhat";
import { getViemContract } from "./utils";

async function main() {
    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    
    console.log("Chain ID:", chainId.toString());
    
    // Get deployment addresses
    const deployments = require(`../../ignition/deployments/chain-${chainId}/deployed_addresses.json`);
    const l1WarpToadAddress = deployments["L1InfraModule#L1WarpToad"];
    
    console.log("L1WarpToad address:", l1WarpToadAddress);
    
    // Connect to contract
    const [signer] = await connection.viem.getWalletClients();
    const l1WarpToad = await getViemContract("L1WarpToad", l1WarpToadAddress, publicClient, signer);

    // Check contract state
    console.log("\n=== Contract State ===");
    const gigaRoot = await l1WarpToad.read.gigaRoot();
    const cachedLocalRoot = await l1WarpToad.read.cachedLocalRoot();
    const currentLocalRoot = await l1WarpToad.read.localRoot();
    const lastLeafIndex = await l1WarpToad.read.lastLeafIndex();
    const gigaRootProvider = await l1WarpToad.read.gigaRootProvider();
    
    console.log("GigaRoot:", gigaRoot.toString());
    console.log("CachedLocalRoot:", cachedLocalRoot.toString());
    console.log("CurrentLocalRoot:", currentLocalRoot.toString());
    console.log("LastLeafIndex:", lastLeafIndex.toString());
    console.log("GigaRootProvider:", gigaRootProvider);
    
    // Check if gigaRoot is in history
    const isGigaRootValid = await l1WarpToad.read.isValidGigaRoot([gigaRoot]);
    console.log("\nIs current gigaRoot valid?", isGigaRootValid);

    // Check if cachedLocalRoot is in history
    const isLocalRootValid = await l1WarpToad.read.isValidLocalRoot([cachedLocalRoot]);
    console.log("Is cachedLocalRoot valid?", isLocalRootValid);

    // Check if currentLocalRoot is in history
    const isCurrentLocalRootValid = await l1WarpToad.read.isValidLocalRoot([currentLocalRoot]);
    console.log("Is currentLocalRoot valid?", isCurrentLocalRootValid);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
