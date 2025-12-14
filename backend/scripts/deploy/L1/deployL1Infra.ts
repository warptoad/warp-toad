const hre = require("hardhat");
import { ethers } from "ethers";
import L1InfraModule from "../../../ignition/modules/L1Infra"
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA } from "../../lib/constants";

async function main() {
    const provider = hre.ethers.provider as ethers.Provider
    const chainId = (await provider.getNetwork()).chainId

    // Read deployed addresses from L1WarpToadModule
    const deployedAddresses = require("../../../ignition/deployments/chain-" + chainId + "/deployed_addresses.json");
    
    const LazyIMTLibAddress = deployedAddresses["L1WarpToadModule#LazyIMT"];
    const L1WarpToadAddress = deployedAddresses["L1WarpToadModule#L1WarpToad"];
    
    console.log("Using existing contracts:");
    console.log("  LazyIMT:", LazyIMTLibAddress);
    console.log("  L1WarpToad:", L1WarpToadAddress);

    const IS_MAINNET = chainId === 1n
    const L1ScrollMessengerAddress = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    
    console.log("  L1ScrollMessenger:", L1ScrollMessengerAddress);
    console.log("\nDeploying L1InfraModule...");

    const { gigaBridge, L1AztecBridgeAdapter, L1ScrollBridgeAdapter } = await hre.ignition.deploy(L1InfraModule, {
        parameters: {
            L1InfraModule: {
                LazyIMTLibAddress: LazyIMTLibAddress,
                L1WarpToadAddress: L1WarpToadAddress,
                L1ScrollMessengerAddress: L1ScrollMessengerAddress
            }
        },
    });

    console.log(`
    L1Infra deployed:
        gigaBridge:             ${gigaBridge.target}
        L1AztecBridgeAdapter:   ${L1AztecBridgeAdapter.target}
        L1ScrollBridgeAdapter:  ${L1ScrollBridgeAdapter.target}
    `);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
