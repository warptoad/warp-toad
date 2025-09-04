
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, GrumpkinScalar, Fr, PXE, deriveMasterIncomingViewingSecretKey, AccountManager, AztecAddress, Fq, Salt } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, Wallet as AztecWallet } from "@aztec/aztec.js"

//@ts-ignore
import { getDeployedTestAccountsWallets, getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
import fs from "fs/promises";
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { USDcoin } from '../../../typechain-types';
import { ethers } from "ethers";
import { deployAztecWarpToad } from "./aztecToadWarp";
//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' } 
import { deployL2AztecBridgeAdapter } from "./L2AztecBridgeAdapter";

import hre, { network } from "hardhat"
import { checkFileExists, getAztecDeployedAddressesFilePath, getAztecDeployedAddressesFolderPath, getContractAddressesEvm, promptBool } from "../../dev_op/utils";
//@ts-ignore
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
//@ts-ignore
import { SingleKeyAccountContract } from "@aztec/accounts/single_key";
// const hre = require("hardhat")

//import { getObsidionDeployerFPC, getObsidionDeployerFPCWallet, ObsidionDeployerFPCContractClass } from "../dev_op/getObsidionWallet/getObsidionWallet";
//@ts-ignore
import { createAztecNodeClient } from "@aztec/stdlib/interfaces/client";
//@ts-ignore
import { computePartialAddress } from "@aztec/stdlib/contract";
import { getAztecTestWallet } from "../../dev_op/utils";
//import { ObsidionDeployerFPCContractArtifact } from "../dev_op/getObsidionWallet/ObsidionDeployerFPC"




const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))

function getEnvArgs() {
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }

    // if (!Boolean(process.env.PRIVATE_KEY)) {
    //     throw new Error("PRIVATE_KEY not set")
    // }


    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL as string
    return { nativeTokenAddress, PXE_URL, privateKey:process.env.PRIVATE_KEY }

}

async function main() {
    //----arguments------
    const { nativeTokenAddress, PXE_URL, privateKey } = getEnvArgs()
    //@ts-ignore
    const provider = hre.ethers.provider
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, provider)
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddresses = await getContractAddressesEvm(chainId)
    const L1AztecAdapterAddress = deployedAddresses["L1InfraModule#L1AztecBridgeAdapter"]
    const folderPath = getAztecDeployedAddressesFolderPath(chainId)
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId)
    if(await checkFileExists(deployedAddressesPath)) {
        if(await promptBool(`A deployment already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
            await fs.rm(deployedAddressesPath)
            console.log("overriding old deployment")
        } else {
            console.log("canceling deployment")
            return 0
        }
    }

    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    //const wallets = await getInitialTestAccountsWallets(PXE);

    const {wallet,sponsoredPaymentMethod } = await getAztecTestWallet(PXE,chainId)//(await getAztecWallet(PXE, privateKey as string, "https://aztec-alpha-testnet-fullnode.zkv.xyz", chainId))//wallets[0]
    // get PXE to know about fee contract
    // https://github.com/obsidionlabs/obsidion-wallet/blob/e514a5cea462b66704fa3fd94f14e198dc14a614/packages/backend/index.ts#L320
    console.log({ deployWalletAddress: wallet.getAddress() })

    //------deploy-------------
    const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, wallet,sponsoredPaymentMethod )
    console.log({ AztecWarpToad: AztecWarpToad.address })
    const { L2AztecBridgeAdapter } = await deployL2AztecBridgeAdapter(L1AztecAdapterAddress, wallet,sponsoredPaymentMethod)
    console.log({ L2AztecBridgeAdapter: L2AztecBridgeAdapter.address })
    const deployments = { AztecWarpToad: AztecWarpToad.address, L2AztecBridgeAdapter: L2AztecBridgeAdapter.address }

    try{await fs.mkdir(folderPath)} catch{console.warn(`praying the folder already exist ${folderPath}`)}
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecBridgeAdapter:       ${L2AztecBridgeAdapter.address}
    `)
}

main();