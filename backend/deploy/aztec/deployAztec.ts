
import hre from "hardhat";
import { getContract, type Address } from "viem";

const ERC20_NAME_SYMBOL_ABI = [
    { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;


//@ts-ignore
import er20Abi from "../../scripts/erc20ABI.json" with { type: 'json' }
import { checkFileExists, getAztecDeployedAddressesFilePath, getAztecDeployedAddressesFolderPath, getContractAddressesEvm, promptBool } from "../../scripts/utils";
import fs from "fs/promises";
import { deployAztecWarpToad } from "./aztecToadWarp";
import { deployL2AztecBridgeAdapter } from "./L2AztecBridgeAdapter";
import { getAztecTestAccount, getEnvArgs, initNodeClient, } from "../utils/aztecUtils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
// TODO: TestWallet was removed in v4, use @aztec/wallets equivalent
// import { TestWallet } from "@aztec/wallets";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';
import { getAztecWallet } from "../utils/aztecUtilsNoEnv";

const { nativeTokenAddress } = getEnvArgs()


async function main() {

    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const nativeToken = getContract({ address: nativeTokenAddress as Address, abi: ERC20_NAME_SYMBOL_ABI, client: publicClient })
    const chainId = BigInt(await publicClient.getChainId())
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
    const { AztecWarpToad, deploymentArtifact: AztecWarpToadDeployArtifact } = await deployAztecWarpToad(nativeToken, wallet, sponsoredPaymentMethod)
    console.log({ AztecWarpToad: AztecWarpToad.address })

    const { L2AztecBridgeAdapter, deploymentArtifact: L2AztecBridgeAdapterDeployArtifact} = await deployL2AztecBridgeAdapter(L1AztecAdapterAddress, wallet, sponsoredPaymentMethod)
    console.log({ L2AztecBridgeAdapter: L2AztecBridgeAdapter.address })
    
    // contractArtifact is too big too be in one file
    const L2AztecBridgeAdapterDeployArgs = structuredClone(L2AztecBridgeAdapterDeployArtifact)
    const AztecWarpToadDeployDeployArgs = structuredClone(AztecWarpToadDeployArtifact)
    delete L2AztecBridgeAdapterDeployArgs.contractArtifact
    delete AztecWarpToadDeployDeployArgs.contractArtifact
    const deployments = {
        AztecWarpToad: {
            ...AztecWarpToadDeployDeployArgs
        },
        L2AztecBridgeAdapter: {
            ...L2AztecBridgeAdapterDeployArgs
        }
    }

    try { await fs.mkdir(folderPath) } catch { console.warn(`praying the folder already exist ${folderPath}`) }
    await fs.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    await fs.writeFile(`${folderPath}/AztecWarpToadDeployArtifact.json`, JSON.stringify(AztecWarpToadDeployArtifact))
    await fs.writeFile(`${folderPath}/L2AztecBridgeAdapterDeployArtifact.json`, JSON.stringify(L2AztecBridgeAdapterDeployArtifact))
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecBridgeAdapter:       ${L2AztecBridgeAdapter.address}
    `)


}

main()