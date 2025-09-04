"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// initializing more than one contract? use try and catch!
const hre = require("hardhat");
// import hre from "hardhat"
const ethers_1 = require("ethers");
const typechain_types_1 = require("../../../typechain-types");
const utils_1 = require("../../dev_op/utils");
const config_js_1 = require("hardhat/config.js");
const SEPOLIA_URL = config_js_1.vars.get("SEPOLIA_URL");
// function getArgs() {
//     // if(!Boolean(process.env.NATIVE_TOKEN_ADDRESS) ) { 
//     //     throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox")
//     // } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
//     //     throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
//     // }
//     if(!Boolean(process.env.PXE_URL) ) { 
//         throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts  --network aztecSandbox")
//     }
//     //const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
//     const PXE_URL = process.env.PXE_URL as string
//     return { PXE_URL}
// }
async function main() {
    // const wallets = await getInitialTestAccountsWallets(PXE);
    // const deployWallet = wallets[0]
    const provider = hre.ethers.provider;
    const signer = (await hre.ethers.getSigners())[0];
    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const l2ChainId = (await provider.getNetwork()).chainId;
    const IS_SCROLL_MAINNET = l2ChainId === 534352n;
    if (IS_SCROLL_MAINNET) {
        throw new Error("l1Provider not setup for mainnet TODO");
    }
    const l1Provider = new ethers_1.ethers.JsonRpcProvider(SEPOLIA_URL);
    const l1ChainId = (await l1Provider.getNetwork()).chainId;
    const L1DeployedAddresses = await (0, utils_1.getContractAddressesEvm)(l1ChainId);
    const L2ScrollDeployedAddresses = await (0, utils_1.getContractAddressesEvm)(l2ChainId);
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"];
    const L2WarpToadAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2WarpToad"];
    const L2ScrollBridgeAdapterAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2ScrollBridgeAdapter"];
    console.log({ L2WarpToadAddress, l2ChainId, L2ScrollDeployedAddresses });
    const L2WarpToad = typechain_types_1.L2WarpToad__factory.connect(L2WarpToadAddress, signer);
    const initializationStatus = {};
    //warptoad
    try {
        await L2WarpToad.initialize(L2ScrollBridgeAdapterAddress, L1ScrollBridgeAdapterAddress); // <- L2WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["L2WarpToad"] = true;
    }
    catch {
        console.warn(`couldn't initialize: L2WarpToad at: ${L2WarpToadAddress}. 
        Was it already initialized?     
        `);
        initializationStatus["L2WarpToad"] = false;
    }
    console.log(`
    initialized: 
        L2WarpToad:                 ${L2WarpToad.target}
        initializationSuccess?:     ${initializationStatus["L2WarpToad"]}
        args:                       ${JSON.stringify({ L2ScrollBridgeAdapter: L2ScrollBridgeAdapterAddress, L1ScrollBridgeAdapterAddress: L1ScrollBridgeAdapterAddress }, null, 2)}
    `);
}
main();
