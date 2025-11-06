
import { ethers } from "ethers";
import * as hre from "hardhat";
import { Wallet as AztecWallet, BaseWallet } from "@aztec/aztec.js/wallet"
import { createStore } from "@aztec/kv-store/lmdb";
import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { createPXE, getPXEConfig, PXE } from "@aztec/pxe/server";
import { getInitialTestAccountsData, InitialAccountData } from '@aztec/accounts/testing';
import { TestWallet } from "@aztec/test-wallet/server";


//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' }
import { checkFileExists, getAztecDeployedAddressesFilePath, getAztecDeployedAddressesFolderPath, getContractAddressesEvm, promptBool } from "../../dev_op/utils";
import fs from "fs/promises";
import { deployAztecWarpToad } from "./aztecToadWarp";
import { deployL2AztecBridgeAdapter } from "./L2AztecBridgeAdapter";

const { nativeTokenAddress, PXE_URL, privateKey } = getEnvArgs()

function getEnvArgs() {
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }


    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL as string
    return { nativeTokenAddress, PXE_URL, privateKey: process.env.PRIVATE_KEY }
}

async function initNodeClient(): Promise<AztecNode> {
    try {
        console.log("creating Aztec Node Client...");
        const node = createAztecNodeClient(PXE_URL);
        const nodeInfo = await node.getNodeInfo();
        console.log("Connected to sandbox version:", nodeInfo.nodeVersion);
        console.log("Chain ID:", nodeInfo.l1ChainId);
        return node;

    } catch (error) {
        console.log("failed to create Aztec Node Client: ", error);
        throw error;
    }
}

async function initPXE(node: AztecNode): Promise<PXE> {
    try {
        const l1Contracts = await node.getL1ContractAddresses();
        console.log("creating PXE client");
        const config = getPXEConfig();
        const fullConfig = { ...config, l1Contracts };
        fullConfig.proverEnabled = false; // you'll want to set this to "true" once you're ready to connect to the testnet

        const store = await createStore("pxe", {
            dataDirectory: "store",
            dataStoreMapSizeKb: 1e6,
        });
        const pxe = await createPXE(node, fullConfig, { store });
        return pxe

    } catch (error) {
        console.log("failed to create Aztec PXE: ", error);
        throw error;
    }
}

async function setupWallet(node: AztecNode): Promise<TestWallet> {
    const wallet = await TestWallet.create(node);
    return wallet;
}

async function getAztecTestAccounts(chainId: bigint) {
    const wallet = await setupWallet(await initNodeClient());
    const testAccountData = (await getInitialTestAccountsData())[0];

    if (chainId == 31337n) {
        console.warn("assuming ur on sandbox since chainId is 31337")
        await wallet.createSchnorrAccount(testAccountData.secret, testAccountData.salt);
        return wallet
    } else {
        console.warn("assuming ur on testnet since chainId is NOT 31337")
        await wallet.createSchnorrAccount(testAccountData.secret, testAccountData.salt);
        return wallet
    }
}

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
    
    const pxe = await initPXE((await initNodeClient()));

    const wallet = await getAztecTestAccounts(chainId) //(await getAztecWallet(PXE, privateKey as string, "https://aztec-alpha-testnet-fullnode.zkv.xyz", chainId))//wallets[0]

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