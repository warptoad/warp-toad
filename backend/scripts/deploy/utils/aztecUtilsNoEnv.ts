import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { createStore } from "@aztec/kv-store/lmdb";
import { createPXE, getPXEConfig, PXE } from "@aztec/pxe/server";
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";

export async function initPXE(node: AztecNode, chainId: bigint): Promise<PXE> {
    const isSandbox = chainId === 31337n
    if (isSandbox) {
        console.log("enabeling prover since chainId is not 31337")
    } else {
        console.log("WARNING DISABLING prover since chainId is 31337")
    }
    const proverEnabled = isSandbox
    try {
        const l1Contracts = await node.getL1ContractAddresses();
        console.log("creating PXE client");
        const config = getPXEConfig();
        const fullConfig = { ...config, l1Contracts };
        fullConfig.proverEnabled = proverEnabled

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

export async function setupWallet(node: AztecNode): Promise<TestWallet> {
    const wallet = await TestWallet.create(node);
    return wallet;
}

export async function getAztecTestAccounts(aztecNode: AztecNode) {

    const testAccountsData = (await getInitialTestAccountsData());
    const wallets = []
    for (const accountData of testAccountsData) {
        const wallet = await setupWallet(aztecNode);
        await wallet.createSchnorrAccount(accountData.secret, accountData.salt);
        wallets.push(wallet)
    }
    return wallets
}

// danish made everything use process.env but sometime you need to pass it as parameter!
export async function initNodeClientNoEnv(nodeUrl:string): Promise<AztecNode> {
    try {
        console.log("creating Aztec Node Client...");
        const node = createAztecNodeClient(nodeUrl);
        const nodeInfo = await node.getNodeInfo();
        console.log("Connected to sandbox version:", nodeInfo.nodeVersion);
        console.log("Chain ID:", nodeInfo.l1ChainId);
        return node;

    } catch (error) {
        console.log("failed to create Aztec Node Client: ", error);
        throw error;
    }
}

export async function getAztecTestAccountNoEnv(chainId: bigint, nodeUrl:string) {
    const wallet = await setupWallet(await initNodeClientNoEnv(nodeUrl));
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

export async function getContractInstanceFromAddressNoEnv(address: AztecAddress, nodeUrl:string): Promise<ContractInstanceWithAddress> {
    const nodeClient = await initNodeClientNoEnv(nodeUrl)
    const contractInstance = await nodeClient.getContract(address)
    if (contractInstance == undefined) {
        throw new Error("seems like the address is not in the node") //todo create better error message :D
    }
    return contractInstance
}