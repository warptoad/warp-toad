
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, GrumpkinScalar, Fr, PXE, deriveMasterIncomingViewingSecretKey, AccountManager, AztecAddress, Fq } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, Wallet as AztecWallet } from "@aztec/aztec.js"

//@ts-ignore
import { getDeployedTestAccountsWallets, getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
import fs from "fs/promises";
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { USDcoin } from '../../typechain-types';
import { ethers } from "ethers";
import { deployAztecWarpToad } from "./aztecToadWarp";
import er20Abi from "../dev_op/erc20ABI.json"
import { deployL2AztecAdapter } from "./L2AztecAdapter";

import hre, { network } from "hardhat"
import { getContractAddressesEvm } from "../dev_op/getDeployedAddresses";
//@ts-ignore
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
//@ts-ignore
import { SingleKeyAccountContract } from "@aztec/accounts/single_key";
// const hre = require("hardhat")

import { getObsidionDeployerFPCWallet } from "../dev_op/getObsidionWallet/getObsidionWallet";


const obsidionDeployerFPCAddress = AztecAddress.fromField(Fr.fromHexString("0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5"))


export async function getAztecWallet(pxe: PXE,obsidionDeployerFPCSigningKey:Fq) {
    console.log({obsidionDeployerFPCAddress,obsidionDeployerFPCSigningKey})
    const wallet = await getObsidionDeployerFPCWallet(pxe,obsidionDeployerFPCAddress,obsidionDeployerFPCSigningKey)
    console.log("got obsidion wallet:",{wallet})
    return wallet
}

function getEnvArgs() {
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }

    if (!Boolean(process.env.PRIVATE_KEY)) {
        throw new Error("PRIVATE_KEY not set")
    }


    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL as string
    const obsidionDeployerFPCSigningKey =  GrumpkinScalar.fromHexString(process.env.PRIVATE_KEY as string)
    return { nativeTokenAddress, PXE_URL,obsidionDeployerFPCSigningKey }

}

async function main() {
    //----arguments------
    const { nativeTokenAddress, PXE_URL, obsidionDeployerFPCSigningKey } = getEnvArgs()
    const provider = hre.ethers.provider
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, provider)
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddresses = await getContractAddressesEvm(chainId)
    const L1AztecAdapterAddress = deployedAddresses["L1InfraModule#L1AztecRootBridgeAdapter"]

    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    //const wallets = await getInitialTestAccountsWallets(PXE);
    const deployWallet = (await getAztecWallet(PXE, obsidionDeployerFPCSigningKey))//wallets[0]
    console.log({ deployWalletAddress: deployWallet.getAddress() })

    //------deploy-------------
    const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, deployWallet)
    const { L2AztecRootBridgeAdapter } = await deployL2AztecAdapter(L1AztecAdapterAddress, deployWallet)
    const deployments = { AztecWarpToad: AztecWarpToad.address, L2AztecRootBridgeAdapter: L2AztecRootBridgeAdapter.address }
    const folderPath = `${__dirname}/aztecDeployments/`
    const deployedAddressesPath = `${folderPath}/deployed_addresses.json`
    // try {
    //     await fs.mkdir(folderPath)
    // } catch {}
    try { await fs.rm(deployedAddressesPath) } catch { }
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecRootBridgeAdapter:   ${L2AztecRootBridgeAdapter.address}
    `)
}

main();