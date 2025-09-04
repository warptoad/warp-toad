// initializing more than one contract? use try and catch!
const hre = require("hardhat");
import { L1AztecBridgeAdapter__factory, L1ScrollBridgeAdapter__factory, L1WarpToad__factory } from "../../../typechain-types";
//@ts-ignore
import { createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { getContractAddressesAztec, getContractAddressesEvm } from "../../dev_op/utils";
function getArgs() {
    // if(!Boolean(process.env.NATIVE_TOKEN_ADDRESS) ) { 
    //     throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox")
    // } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
    //     throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    // }
    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts  --network aztecSandbox");
    }
    //const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL;
    return { PXE_URL };
}
async function main() {
    //----PXE and wallet-----
    const { PXE_URL } = getArgs();
    console.log("creating PXE client");
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL);
    await waitForPXE(PXE);
    // const wallets = await getInitialTestAccountsWallets(PXE);
    // const deployWallet = wallets[0]
    const provider = hre.ethers.provider;
    const signer = (await hre.ethers.getSigners())[0];
    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const aztecNativeBridgeRegistryAddress = (await PXE.getNodeInfo()).l1ContractAddresses.registryAddress.toString();
    const chainId = (await provider.getNetwork()).chainId;
    const IS_MAINNET = chainId === 1n;
    const scrollChainId = IS_MAINNET ? 534352n : 534351n;
    const L1DeployedAddresses = await getContractAddressesEvm(chainId);
    const L2ScrollDeployedAddresses = await getContractAddressesEvm(scrollChainId);
    const aztecDeployedAddresses = await getContractAddressesAztec(chainId);
    const L1WarpToadAddress = L1DeployedAddresses["L1WarpToadModule#L1WarpToad"];
    const gigaBridgeAddress = L1DeployedAddresses["L1InfraModule#GigaBridge"];
    const L1AztecBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1AztecBridgeAdapter"];
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"];
    const L2AztecAdapterAddress = aztecDeployedAddresses["L2AztecBridgeAdapter"];
    const L2ScrollBridgeAdapterAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2ScrollBridgeAdapter"];
    const L1AztecBridgeAdapter = L1AztecBridgeAdapter__factory.connect(L1AztecBridgeAdapterAddress, signer);
    const L1ScrollBridgeAdapter = L1ScrollBridgeAdapter__factory.connect(L1ScrollBridgeAdapterAddress, signer);
    const L1WarpToad = L1WarpToad__factory.connect(L1WarpToadAddress, signer);
    const initializationStatus = {};
    //aztec
    try {
        await L1AztecBridgeAdapter.initialize(aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress);
        initializationStatus["L1AztecBridgeAdapter"] = true;
    }
    catch {
        console.warn(`couldn't initialize: L1AztecBridgeAdapter at: ${L1AztecBridgeAdapter.target}. 
        Was it already initialized?     
        `);
        initializationStatus["L1AztecBridgeAdapter"] = false;
    }
    // scroll
    try {
        await L1ScrollBridgeAdapter.initialize(L2ScrollBridgeAdapterAddress, gigaBridgeAddress);
        initializationStatus["L1ScrollBridgeAdapter"] = true;
    }
    catch {
        console.warn(`couldn't initialize: L1ScrollBridgeAdapter at: ${L1ScrollBridgeAdapter.target}. 
        Was it already initialized?     
        `);
        initializationStatus["L1ScrollBridgeAdapter"] = false;
    }
    //warptoad
    try {
        await L1WarpToad.initialize(gigaBridgeAddress, L1WarpToad.target); // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["L1WarpToad"] = true;
    }
    catch {
        console.warn(`couldn't initialize: L1WarpToad at: ${L1AztecBridgeAdapter.target}. 
        Was it already initialized?     
        `);
        initializationStatus["L1WarpToad"] = false;
    }
    console.log(`
    initialized: 
        L1AztecBridgeAdapter:       ${L1AztecBridgeAdapter.target}
        initializationSuccess?:     ${initializationStatus["L1AztecBridgeAdapter"]}
        args:                       ${JSON.stringify({ aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress }, null, 2)}

        L1WarpToad:                 ${L1WarpToad.target}
        initializationSuccess?:     ${initializationStatus["L1WarpToad"]}
        args:                       ${JSON.stringify({ gigaBridgeAddress, L1WarpToad: L1WarpToad.target }, null, 2)}
    `);
    console.log(`
        L1ScrollBridgeAdapter:      ${L1ScrollBridgeAdapter.target}
        initializationSuccess?:     ${initializationStatus["L1ScrollBridgeAdapter"]}
        args:                       ${JSON.stringify({ L2ScrollBridgeAdapterAddress, gigaBridgeAddress }, null, 2)}
    `);
}
main();
