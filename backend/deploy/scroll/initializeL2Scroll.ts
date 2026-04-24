// initializing more than one contract? use try and catch!
import hre from "hardhat";
import { createPublicClient, http } from "viem";
import { deployPoseidon } from "../poseidon";

import L2WarpToadModule from "../../../ignition/modules/L2WarpToad"
import L1InfraModule from "../../../ignition/modules/L1Infra"

import { getViemContract } from "../../scripts/utils";
//@ts-ignore
import er20Abi from "../../scripts/erc20ABI.json"  with { type: 'json' }
//@ts-ignore
import { createPXEClient, waitForPXE } from "@aztec/aztec.js";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

import fs from "fs/promises";

import { vars } from "hardhat/config.js";
import { evmDeployments } from "../../scripts/deployment";
import { getContractAddressesAztec } from "../../scripts/utils";
const SEPOLIA_URL = vars.get("SEPOLIA_URL")

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
    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const [signer] = await connection.viem.getWalletClients();

    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead

    const l2ChainId = BigInt(await publicClient.getChainId())
    const IS_SCROLL_MAINNET = l2ChainId === 534352n
    if (IS_SCROLL_MAINNET) {throw new Error("l1Provider not setup for mainnet TODO")}


    const l1Provider = createPublicClient({ transport: http(SEPOLIA_URL) })
    const l1ChainId = BigInt(await l1Provider.getChainId())


    const L1DeployedAddresses = evmDeployments[Number(l1ChainId)]
    const L2ScrollDeployedAddresses = evmDeployments[Number(l2ChainId)]

    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"]
    const L2WarpToadAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2WarpToad"]
    const L2ScrollBridgeAdapterAddress = L2ScrollDeployedAddresses["L2ScrollModule#L2ScrollBridgeAdapter"]
    const aztecDeployedAddresses = await getContractAddressesAztec(l1ChainId)
    const {address:AztecWarpToadAddress} = aztecDeployedAddresses["AztecWarpToad"]
    console.log({L2WarpToadAddress, l2ChainId,L2ScrollDeployedAddresses })
    const L2WarpToad = await getViemContract("L2WarpToad", L2WarpToadAddress, publicClient, signer)
    const initializationStatus:any = {}


    //warptoad
    try{
        const hash = await L2WarpToad.write.initialize([L2ScrollBridgeAdapterAddress, L1ScrollBridgeAdapterAddress, BigInt(AztecWarpToadAddress as string)]) // <- L2WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        await publicClient.waitForTransactionReceipt({ hash });
        initializationStatus["L2WarpToad"] = true
    } catch {
        console.warn(`couldn't initialize: L2WarpToad at: ${L2WarpToadAddress}.
        Was it already initialized?
        `)
        initializationStatus["L2WarpToad"] = false
    }



    console.log(`
    initialized:
        L2WarpToad:                 ${L2WarpToad.address}
        initializationSuccess?:     ${initializationStatus["L2WarpToad"] }
        args:                       ${JSON.stringify({L2ScrollBridgeAdapter: L2ScrollBridgeAdapterAddress,L1ScrollBridgeAdapterAddress: L1ScrollBridgeAdapterAddress},null,2)}
    `)

}
main()  