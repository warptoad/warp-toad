import * as hre from "hardhat";
import { L1WarpToad__factory } from "../../typechain-types";

async function main() {
    const provider = hre.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    
    console.log("Chain ID:", chainId.toString());
    
    // Get deployment addresses
    const deployments = require(`../../ignition/deployments/chain-${chainId}/deployed_addresses.json`);
    const l1WarpToadAddress = deployments["L1InfraModule#L1WarpToad"];
    
    console.log("L1WarpToad address:", l1WarpToadAddress);
    
    // Connect to contract
    const [signer] = await hre.ethers.getSigners();
    const l1WarpToad = L1WarpToad__factory.connect(l1WarpToadAddress, signer);
    
    // Check contract state
    console.log("\n=== Contract State ===");
    const gigaRoot = await l1WarpToad.gigaRoot();
    const cachedLocalRoot = await l1WarpToad.cachedLocalRoot();
    const currentLocalRoot = await l1WarpToad.localRoot();
    const lastLeafIndex = await l1WarpToad.lastLeafIndex();
    const gigaRootProvider = await l1WarpToad.gigaRootProvider();
    
    console.log("GigaRoot:", gigaRoot.toString());
    console.log("CachedLocalRoot:", cachedLocalRoot.toString());
    console.log("CurrentLocalRoot:", currentLocalRoot.toString());
    console.log("LastLeafIndex:", lastLeafIndex.toString());
    console.log("GigaRootProvider:", gigaRootProvider);
    
    // Check if gigaRoot is in history
    const isGigaRootValid = await l1WarpToad.isValidGigaRoot(gigaRoot);
    console.log("\nIs current gigaRoot valid?", isGigaRootValid);
    
    // Check if cachedLocalRoot is in history
    const isLocalRootValid = await l1WarpToad.isValidLocalRoot(cachedLocalRoot);
    console.log("Is cachedLocalRoot valid?", isLocalRootValid);
    
    // Check if currentLocalRoot is in history
    const isCurrentLocalRootValid = await l1WarpToad.isValidLocalRoot(currentLocalRoot);
    console.log("Is currentLocalRoot valid?", isCurrentLocalRootValid);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
