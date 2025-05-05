// initializing more than one contract? use try and catch!
const hre = require("hardhat");
// import hre from "hardhat"
import { ethers } from "ethers";
import { deployPoseidon } from "./poseidon";

import L1WarpToadModule from "../../ignition/modules/L1WarpToad"
import L1InfraModule from "../../ignition/modules/L1Infra"

import { ERC20__factory, L1AztecRootBridgeAdapter__factory, L1WarpToad__factory, USDcoin__factory } from "../../typechain-types";

import er20Abi from "../dev_op/erc20ABI.json"
//@ts-ignore
import { createPXEClient, waitForPXE } from "@aztec/aztec.js";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

import fs from "fs/promises";
import { getContractAddressesAztec, getContractAddressesEvm } from "../dev_op/getDeployedAddresses";

const { PXE_URL = 'http://localhost:8080' } = process.env;

function getArgs() {
    if(!Boolean(process.env.NATIVE_TOKEN_ADDRESS) ) { 
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }
}

async function main() {
    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    console.warn("using getInitialTestAccountsWallets. This will break on testnet!!")
    // const wallets = await getInitialTestAccountsWallets(PXE);
    // const deployWallet = wallets[0]
    const provider = hre.ethers.provider
    const signer = (await hre.ethers.getSigners())[0]

    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const aztecNativeBridgeRegistryAddress = (await PXE.getNodeInfo()).l1ContractAddresses.registryAddress.toString();

    const chainId = (await provider.getNetwork()).chainId
    const evmDeployedAddresses = await getContractAddressesEvm(chainId)
    const aztecDeployedAddresses =await getContractAddressesAztec()
    const L1WarpToadAddress = evmDeployedAddresses["L1WarpToadModule#L1WarpToad"]
    const gigaBridgeAddress = evmDeployedAddresses["L1InfraModule#GigaRootBridge"]
    const L1AztecRootBridgeAdapterAddress = evmDeployedAddresses["L1InfraModule#L1AztecRootBridgeAdapter"]

    const L2AztecAdapterAddress = aztecDeployedAddresses["L2AztecRootBridgeAdapter"]

    const L1AztecRootBridgeAdapter = L1AztecRootBridgeAdapter__factory.connect(L1AztecRootBridgeAdapterAddress, signer)
    const L1WarpToad = L1WarpToad__factory.connect(L1WarpToadAddress, signer)
    const initializationStatus:any = {}

    try{
        await L1AztecRootBridgeAdapter.initialize(aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress);
        initializationStatus["L1AztecRootBridgeAdapter"] = true
    } catch {
        console.warn(`couldn't initialize: L1AztecRootBridgeAdapter at: ${L1AztecRootBridgeAdapter.target}. 
        Was it already initialized?     
        `)
        initializationStatus["L1AztecRootBridgeAdapter"] = false
    }
    
    try{
        await L1WarpToad.initialize(gigaBridgeAddress, L1WarpToad.target) // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["L1WarpToad"] = true
    } catch {
        console.warn(`couldn't initialize: L1WarpToad at: ${L1AztecRootBridgeAdapter.target}. 
        Was it already initialized?     
        `)
        initializationStatus["L1WarpToad"] = false
    }
    


    console.log(`
    initialized: 
        L1AztecRootBridgeAdapter:   ${L1AztecRootBridgeAdapter.target}
        initializationSuccess?:     ${initializationStatus["L1AztecRootBridgeAdapter"] }
        args:                       ${JSON.stringify({aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress},null,2)}

        L1WarpToad:                 ${L1WarpToad.target}
        initializationSuccess?:     ${initializationStatus["L1WarpToad"] }
        args:                       ${JSON.stringify({gigaBridgeAddress, L1WarpToad:L1WarpToad.target},null,2)}
    `)

}
main()  