
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,Wallet as AztecWallet  } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { USDcoin } from '../../typechain-types';
import { ethers } from "ethers";
import { deployAztecWarpToad } from "./aztecToadWarp";
import er20Abi from "../dev_op/erc20ABI.json"
import { deployL2AztecAdapter } from "./L2AztecAdapter";
const hre = require("hardhat")

const { PXE_URL = 'http://localhost:8080' } = process.env;

function getEnvArgs() {
    if(!Boolean(process.env.NATIVE_TOKEN_ADDRESS) ) { 
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    if(!Boolean(process.env.L1_AZTEC_ADAPTER_ADDRESS) ) { 
        throw new Error("L1_AZTEC_ADAPTER_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.L1_AZTEC_ADAPTER_ADDRESS)) {
        throw new Error(`the value: ${process.env.L1_AZTEC_ADAPTER_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const L1AztecAdapter = ethers.getAddress(process.env.L1_AZTEC_ADAPTER_ADDRESS as string);
    return {nativeTokenAddress,L1AztecAdapter}

}

async function main() {
    const {nativeTokenAddress, L1AztecAdapter} = getEnvArgs()
    console.log({nativeTokenAddress})
    const provider = hre.ethers.provider
    console.log({nativeTokenAddress,er20Abi,provider})
    const nativeToken = new ethers.Contract(nativeTokenAddress,er20Abi,provider)
    //PXE and wallet
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    console.warn("using getInitialTestAccountsWallets. This will break on testnet!!")
    const wallets = await getInitialTestAccountsWallets(PXE);
    const deployWallet = wallets[0]
    const {AztecWarpToad} = await deployAztecWarpToad(nativeToken, deployWallet)
    const { L2AztecRootBridgeAdapter} = await deployL2AztecAdapter(L1AztecAdapter,deployWallet)
    
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecRootBridgeAdapter:   ${L2AztecRootBridgeAdapter.address}
    `)

}

main();