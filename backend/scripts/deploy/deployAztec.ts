
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, GrumpkinScalar, Fr, PXE, deriveMasterIncomingViewingSecretKey, AccountManager, AztecAddress, Fq, Salt } from "@aztec/aztec.js"
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

import { getObsidionDeployerFPC, getObsidionDeployerFPCWallet, ObsidionDeployerFPCContractClass } from "../dev_op/getObsidionWallet/getObsidionWallet";
//@ts-ignore
import { createAztecNodeClient } from "@aztec/stdlib/interfaces/client";
//@ts-ignore
import { computePartialAddress } from "@aztec/stdlib/contract";
import { ObsidionDeployerFPCContractArtifact } from "../dev_op/getObsidionWallet/ObsidionDeployerFPC"

const obsidionDeployerFPCAddress = AztecAddress.fromField(Fr.fromHexString("0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5")) //0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5
//lian told me it was 0>
const OBSIDION_DEPLOYER_SECRET_KEY = "0x00"

const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))
export async function getAztecWallet(pxe: PXE, privateKey: string, nodeUrl: string, chainId: bigint) {
    if (chainId == 31337n) { 
        console.warn("assuming ur on sanbox since chainId is 31337")
        return (await getInitialTestAccountsWallets(pxe))[0]

    }else {
        const obsidionDeployerFPCSigningKey = GrumpkinScalar.fromHexString(privateKey as string)
        console.warn("assuming ur on testnet/mainnet since chainId is NOT 31337")
        //await getObsidionDeployerFPC(pxe, nodeUrl,obsidionDeployerFPCAddress,obsidionDeployerFPCSigningKey.toField().toString(),OBSIDION_DEPLOYER_SECRET_KEY)
        const node = createAztecNodeClient(nodeUrl)
        const contract = await node.getContract(obsidionDeployerFPCAddress as any)
        if (!contract) {
            throw new Error("Contract not found")
        }
        //await delay(30000)
        // const obsidionDeployerFPC = await (
        //     await AccountManager.create(
        //         pxe,
        //         Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY),
        //         new ObsidionDeployerFPCContractClass(obsidionDeployerFPCSigningKey),
        //         contract.salt as unknown as Salt,
        //     )
        // ).getWallet()

        await pxe.registerAccount(
            Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY),
            await computePartialAddress(contract as any) as any as Fr,
        )
        //await delay(30000)
        await pxe.registerContract({
            instance: contract as any,
            artifact: ObsidionDeployerFPCContractArtifact,
        })
        //await delay(30000)
        const wallet = await getObsidionDeployerFPCWallet(pxe, obsidionDeployerFPCAddress, obsidionDeployerFPCSigningKey)
        return wallet

    }
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
    return { nativeTokenAddress, PXE_URL, privateKey:process.env.PRIVATE_KEY }

}

async function main() {
    //----arguments------
    const { nativeTokenAddress, PXE_URL, privateKey } = getEnvArgs()
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

    const deployWallet = (await getAztecWallet(PXE, privateKey as string, "https://full-node.alpha-testnet.aztec.network", chainId))//wallets[0]
    // get PXE to know about fee contract
    // https://github.com/obsidionlabs/obsidion-wallet/blob/e514a5cea462b66704fa3fd94f14e198dc14a614/packages/backend/index.ts#L320
    console.log({ deployWalletAddress: deployWallet.getAddress() })

    //------deploy-------------
    const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, deployWallet)
    //await delay(30000)
    console.log({ AztecWarpToad: AztecWarpToad.address })
    const { L2AztecRootBridgeAdapter } = await deployL2AztecAdapter(L1AztecAdapterAddress, deployWallet)
    console.log({ L2AztecRootBridgeAdapter: L2AztecRootBridgeAdapter.address })
    const deployments = { AztecWarpToad: AztecWarpToad.address, L2AztecRootBridgeAdapter: L2AztecRootBridgeAdapter.address }
    const folderPath = `${__dirname}/aztecDeployments/${Number(chainId)}/`

    try{await fs.mkdir(folderPath)} catch{console.warn(`praying the folder already exist ${folderPath}`)}
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