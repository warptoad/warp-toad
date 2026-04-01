import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { createStore } from "@aztec/kv-store/lmdb";
import { createPXE, getPXEConfig, PXE } from "@aztec/pxe/server";
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ContractInstanceWithAddress, getContractInstanceFromInstantiationParams} from "@aztec/aztec.js/contracts";

import { getFeeJuiceBalance } from '@aztec/aztec.js/utils';

import { InitialAccountData } from "@aztec/accounts/testing";
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';

import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';

import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { PublicKeys } from "@aztec/aztec.js/keys";
import { ContractArtifact } from "@aztec/aztec.js/abi";
import { Wallet } from "@aztec/aztec.js/wallet";
import { ethers } from "hardhat";
import { BytesLike, toBeHex } from "ethers";
export interface DeploymentArtifact {
  // these are things you need to store at deployment
  address: BytesLike,
  deployer: BytesLike,
  constructorArgs: any[],
  salt: BytesLike,
  publicKeys: BytesLike[],

  // these can technically be recovered from contractArtifact
  version: string,
  classId: BytesLike,

  // the contract artifact it self, just so you never lose it and can always verify it!
  contractArtifact?: ContractArtifact,
}

export interface DeploymentStringyfiedArtifact {
  // these are things you need to store at deployment
  address: string,
  deployer: string,
  constructorArgs: string[],
  salt: string,
  publicKeys: string[]

  // these can technically be recovered from contractArtifact
  version: string,
  classId: string,

  // the contract artifact it self, just so you never lose it and can always verify it!
  contractArtifact: ContractArtifact,
}

export async function initPXE(node: AztecNode, chainId: bigint): Promise<PXE> {
    const isSandbox = chainId === 31337n
    if (isSandbox) {
        console.log("WARNING DISABLING prover since chainId is 31337")
    } else {
        console.log("enabeling prover since chainId is not 31337")
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
export async function initNodeClientNoEnv(nodeUrl: string): Promise<AztecNode> {
    try {
        console.log("creating Aztec Node Client...");
        const node = createAztecNodeClient(nodeUrl);
        const nodeInfo = await node.getNodeInfo();
        console.log("Connected to aztecNode versionon:", nodeInfo.nodeVersion);
        console.log("Chain ID:", nodeInfo.l1ChainId);
        return node;

    } catch (error) {
        console.log("failed to create Aztec Node Client: ", error);
        throw error;
    }
}

export async function getAztecTestAccountNoEnv(chainId: bigint, nodeUrl: string) {
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

export async function getContractInstanceFromAddressNoEnv(address: AztecAddress, nodeUrl: string): Promise<ContractInstanceWithAddress> {
    const nodeClient = await initNodeClientNoEnv(nodeUrl)
    const contractInstance = await nodeClient.getContract(address)
    if (contractInstance == undefined) {
        throw new Error("seems like the address is not in the node") //todo create better error message :D
    }
    return contractInstance
}


export async function getAztecWallet(nodeUrl: string, secrets: { secret: Fr, salt: Fr, signingKey: GrumpkinScalar }, isSanbox: boolean) {
    // setup node
    const node = createAztecNodeClient(nodeUrl);
    console.log({ nodeVersion: (await node.getNodeInfo()).nodeVersion })

    // setup wallet
    const wallet = await TestWallet.create(node, { proverEnabled: !isSanbox });
    const accountManager = await wallet.createSchnorrAccount(secrets.secret, secrets.salt, secrets.signingKey);

    // setup payment method
    const sponsoredPFCContract = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, { salt: new Fr(SPONSORED_FPC_SALT), });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
    await wallet.registerContract(sponsoredPFCContract, SponsoredFPCContractArtifact)

    // debug
    console.log({ FPC: sponsoredPFCContract.address })
    const feeJuice = await getFeeJuiceBalance(accountManager.address, node)
    console.log({ feeJuice })

    //deploy account
    const deployMethod = await accountManager.getDeployMethod();
    try {
        console.log("deploying account")
        const accountTx = await deployMethod.send({ from: AztecAddress.ZERO, fee:{paymentMethod:sponsoredPaymentMethod} }).wait();
        console.log({ accountTx: accountTx.txHash })
    } catch (error: any) {
        if (error.message.startsWith("Invalid tx: Existing nullifier")) {
            console.log(` \n got error ${error.message}. The account: ${accountManager.address} is already deployed! \n\n IGNNORE THE ERROR FROM PXE BELOW \n\n`)
        } else {
            throw new Error(`got error ${error.message}. when deploying account: ${accountManager.address}`, { cause: error })
        }
    }

    return {wallet, sponsoredPaymentMethod}
}

export async function deployAndCreateDeploymentArtifact(wallet: Wallet, account: AztecAddress, artifact: ContractArtifact, constructorArgs: any[], salt?: Fr, constructorName = "constructor",optionalInstantiontionOpts?:{publicKeys?:PublicKeys, skipArgsDecoding?:boolean}) {
    salt ??= Fr.random()
    const deployer = new ContractDeployer(artifact, wallet, undefined, constructorName);
    const deployedContract = await deployer.deploy(...constructorArgs).send({ contractAddressSalt: salt, from: account}).deployed();
    const instantiationData = {
        constructorArtifact: constructorName,
        constructorArgs: constructorArgs.map((v)=>typeof v === "bigint" ? toBeHex(v) : v),
        skipArgsDecoding: optionalInstantiontionOpts ? optionalInstantiontionOpts.skipArgsDecoding : undefined,
        salt: salt,
        publicKeys:  optionalInstantiontionOpts ? optionalInstantiontionOpts.publicKeys : undefined,
        deployer: account
    }
    const contractInstance = await getContractInstanceFromInstantiationParams(artifact,instantiationData)
    const deploymentArtifact: DeploymentArtifact = {
        address: deployedContract.address.toString(),
        deployer: account.toString(),
        constructorArgs: constructorArgs.map((v)=> typeof v === "bigint" ? ethers.toBeHex(v) : v ),
        salt: salt.toString(),
        publicKeys: contractInstance.publicKeys.toFields().map((v)=>v.toString()),

        // these can technically be recovered from contractArtifact
        version: contractInstance.version.toString(),
        classId: contractInstance.currentContractClassId.toString(),

        // the contract artifact it self, just so you never lose it and can always verify it!
        contractArtifact: deployedContract.artifact,
    }
    return {deployedContract,deploymentArtifact}
}
