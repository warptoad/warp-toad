// initializing more than one contract? use try and catch!
import * as hre from "hardhat";

import { L1AztecBridgeAdapter__factory, L1ScrollBridgeAdapter__factory, L1WarpToad__factory } from "../../../typechain-types";

import { getContractAddressesAztec, getContractAddressesEvm } from "../../dev_op/utils";
import { initNodeClient } from "../utils/aztecUtils";


async function main() {
    // const wallets = await getInitialTestAccountsWallets(PXE);
    // const deployWallet = wallets[0]
    const provider = hre.ethers.provider
    const signer = (await hre.ethers.getSigners())[0]

    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const nodeInfo = await (await initNodeClient()).getNodeInfo()
    const aztecNativeBridgeRegistryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();

    const chainId = (await provider.getNetwork()).chainId
    const IS_MAINNET = chainId === 1n
    const scrollChainId = IS_MAINNET ? 534352n : 534351n
    const L1DeployedAddresses = await getContractAddressesEvm(chainId)
    const L2ScrollDeployedAddresses = await getContractAddressesEvm(scrollChainId)
    const aztecDeployedAddresses = await getContractAddressesAztec(chainId)
    const L1WarpToadAddress = L1DeployedAddresses["L1WarpToadModule#L1WarpToad"]
    const gigaBridgeAddress = L1DeployedAddresses["L1InfraModule#GigaBridge"]
    const L1AztecBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1AztecBridgeAdapter"]
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"]

    const L2AztecAdapterAddress = aztecDeployedAddresses["L2AztecBridgeAdapter"]
    const L2ScrollBridgeAdapterAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2ScrollBridgeAdapter"]

    const L1AztecBridgeAdapter = L1AztecBridgeAdapter__factory.connect(L1AztecBridgeAdapterAddress, signer)
    const L1ScrollBridgeAdapter = L1ScrollBridgeAdapter__factory.connect(L1ScrollBridgeAdapterAddress, signer)
    const L1WarpToad = L1WarpToad__factory.connect(L1WarpToadAddress, signer)
    const initializationStatus: any = {}

    //aztec
    try {
        await L1AztecBridgeAdapter.initialize(aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress);
        initializationStatus["L1AztecBridgeAdapter"] = true
    } catch {
        console.warn(`couldn't initialize: L1AztecBridgeAdapter at: ${L1AztecBridgeAdapter.target}. 
        Was it already initialized?     
        `)
        initializationStatus["L1AztecBridgeAdapter"] = false
    }

    // scroll
    try {
        await L1ScrollBridgeAdapter.initialize(L2ScrollBridgeAdapterAddress, gigaBridgeAddress);
        initializationStatus["L1ScrollBridgeAdapter"] = true
    } catch {
        console.warn(`couldn't initialize: L1ScrollBridgeAdapter at: ${L1ScrollBridgeAdapter.target}. 
        Was it already initialized?     
        `)
        initializationStatus["L1ScrollBridgeAdapter"] = false
    }

    //warptoad
    try {
        await L1WarpToad.initialize(gigaBridgeAddress, L1WarpToad.target) // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["L1WarpToad"] = true
    } catch {
        console.warn(`couldn't initialize: L1WarpToad at: ${L1AztecBridgeAdapter.target}. 
        Was it already initialized?     
        `)
        initializationStatus["L1WarpToad"] = false
    }



    console.log(`
    initialized: 
        L1AztecBridgeAdapter:       ${L1AztecBridgeAdapter.target}
        initializationSuccess?:     ${initializationStatus["L1AztecBridgeAdapter"]}
        args:                       ${JSON.stringify({ aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress }, null, 2)}

        L1WarpToad:                 ${L1WarpToad.target}
        initializationSuccess?:     ${initializationStatus["L1WarpToad"]}
        args:                       ${JSON.stringify({ gigaBridgeAddress, L1WarpToad: L1WarpToad.target }, null, 2)}
    `)
    console.log(`
        L1ScrollBridgeAdapter:      ${L1ScrollBridgeAdapter.target}
        initializationSuccess?:     ${initializationStatus["L1ScrollBridgeAdapter"]}
        args:                       ${JSON.stringify({ L2ScrollBridgeAdapterAddress, gigaBridgeAddress }, null, 2)}
    `)

}
main()  