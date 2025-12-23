
import { ethers } from "ethers";
import * as hre from "hardhat";


//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' }
import { checkFileExists, getAztecDeployedAddressesFilePath, getAztecDeployedAddressesFolderPath, getContractAddressesEvm, promptBool } from "../../dev_op/utils";
import fs from "fs/promises";
import { deployAztecWarpToad } from "./aztecToadWarp";
import { deployL2AztecBridgeAdapter } from "./L2AztecBridgeAdapter";
import { getAztecTestAccount, getEnvArgs, initNodeClient, } from "../utils/aztecUtils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';
import { getAztecWallet } from "../utils/aztecUtilsNoEnv";

const { nativeTokenAddress } = getEnvArgs()


async function main() {

    const provider = hre.ethers.provider
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, provider)
    const chainId = (await provider.getNetwork()).chainId
    const isSanbox = chainId === 31337n

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

    // Create a wallet and import test accounts
    const [alice] = await getInitialTestAccountsData()
    const {wallet, sponsoredPaymentMethod} = await getAztecWallet(process.env.PXE_URL as string, alice, isSanbox)

    //const wallet = await getAztecTestAccount(chainId)
    //------deploy-------------
    const { AztecWarpToad, constructorArgs: WarpToadContructArgs, contractAddressSalt: WarpToadSalt, deployer: warptoadDeployer } = await deployAztecWarpToad(nativeToken, wallet, sponsoredPaymentMethod)
    console.log({ AztecWarpToad: AztecWarpToad.address })

    const { L2AztecBridgeAdapter, constructorArgs: AdpterContructArgs, contractAddressSalt: AdpterSalt , deployer: adapterDeployer} = await deployL2AztecBridgeAdapter(L1AztecAdapterAddress, wallet, sponsoredPaymentMethod)
    console.log({ L2AztecBridgeAdapter: L2AztecBridgeAdapter.address })
    const deployments = {
        AztecWarpToad: {
            address: AztecWarpToad.address,
            constructorArgs: WarpToadContructArgs.map((v)=>v.toString()),
            contractAddressSalt: WarpToadSalt,
            deployer: warptoadDeployer
        },
        L2AztecBridgeAdapter: {
            address: L2AztecBridgeAdapter.address,
            constructorArgs: AdpterContructArgs.map((v)=>v.toString()),
            contractAddressSalt: AdpterSalt,
            deployer: adapterDeployer
        }
    }

    try { await fs.mkdir(folderPath) } catch { console.warn(`praying the folder already exist ${folderPath}`) }
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecBridgeAdapter:       ${L2AztecBridgeAdapter.address}
    `)


}

main()