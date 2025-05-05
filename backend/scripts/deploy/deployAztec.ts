
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,Wallet as AztecWallet  } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
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
// const hre = require("hardhat")

const { PXE_URL = 'http://localhost:8080' } = process.env;

function getEnvArgs() {
    if(!Boolean(process.env.NATIVE_TOKEN_ADDRESS) ) { 
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }
    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    return {nativeTokenAddress}

}

async function main() {
    //----arguments------
    const {nativeTokenAddress} = getEnvArgs()
    const provider = hre.ethers.provider
    const nativeToken = new ethers.Contract(nativeTokenAddress,er20Abi,provider)
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddresses = await getContractAddressesEvm(chainId)
    const L1AztecAdapterAddress = deployedAddresses["L1InfraModule#L1AztecRootBridgeAdapter"]
    
    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    console.warn("using getInitialTestAccountsWallets. This will break on testnet!!")
    const wallets = await getInitialTestAccountsWallets(PXE);
    const deployWallet = wallets[0]

    //------deploy-------------
    const {AztecWarpToad} = await deployAztecWarpToad(nativeToken, deployWallet)
    const { L2AztecRootBridgeAdapter} = await deployL2AztecAdapter(L1AztecAdapterAddress,deployWallet)
    const deployments = {AztecWarpToad: AztecWarpToad.address, L2AztecRootBridgeAdapter:L2AztecRootBridgeAdapter.address}
    const folderPath = `${__dirname}/aztecDeployments/`
    const deployedAddressesPath = `${folderPath}/deployed_addresses.json`
    // try {
    //     await fs.mkdir(folderPath)
    // } catch {}
    try {await fs.rm(deployedAddressesPath)}catch{}
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments,null,2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecRootBridgeAdapter:   ${L2AztecRootBridgeAdapter.address}
    `)
}

main();