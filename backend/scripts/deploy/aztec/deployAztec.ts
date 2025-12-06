
import { ethers } from "ethers";
import * as hre from "hardhat";


//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' }
import { checkFileExists, getAztecDeployedAddressesFilePath, getAztecDeployedAddressesFolderPath, getContractAddressesEvm, promptBool } from "../../dev_op/utils";
import fs from "fs/promises";
import { deployAztecWarpToad } from "./aztecToadWarp";
import { deployL2AztecBridgeAdapter } from "./L2AztecBridgeAdapter";
import { getAztecTestAccount, getEnvArgs, initNodeClient, initPXE } from "../utils/aztecUtils";

const { nativeTokenAddress } = getEnvArgs()


async function main() {

    const provider = hre.ethers.provider
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, provider)
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddresses = await getContractAddressesEvm(chainId)
    const L1AztecAdapterAddress = deployedAddresses["L1InfraModule#L1AztecBridgeAdapter"]
    const folderPath = getAztecDeployedAddressesFolderPath(chainId)
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId)

    if (await checkFileExists(deployedAddressesPath)) {
        if (await promptBool(`A deployment already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
            await fs.rm(deployedAddressesPath)
            console.log("overriding old deployment")
        } else {
            console.log("canceling deployment")
            return 0
        }
    }

    const wallet = await getAztecTestAccount(chainId)

    //------deploy-------------
    const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, wallet, undefined)
    console.log({ AztecWarpToad: AztecWarpToad.address })

    const { L2AztecBridgeAdapter } = await deployL2AztecBridgeAdapter(L1AztecAdapterAddress, wallet, undefined)
    console.log({ L2AztecBridgeAdapter: L2AztecBridgeAdapter.address })
    const deployments = { AztecWarpToad: AztecWarpToad.address, L2AztecBridgeAdapter: L2AztecBridgeAdapter.address }

    try { await fs.mkdir(folderPath) } catch { console.warn(`praying the folder already exist ${folderPath}`) }
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecBridgeAdapter:       ${L2AztecBridgeAdapter.address}
    `)


}

main()