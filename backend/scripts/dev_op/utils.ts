
import { ethers } from 'ethers';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";
//@ts-ignore
import { Fr, type ContractInstanceWithAddress, type PXE, getContractInstanceFromDeployParams, PXE, SponsoredFeePaymentMethod, AccountManager, GrumpkinScalar, Wallet as aztecWallet, createAztecNodeClient } from "@aztec/aztec.js";
//@ts-ignore
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
//@ts-ignore
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
//@ts-ignore
import { deriveSigningKey } from "@aztec/stdlib/keys";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
//@ts-ignore
import { SPONSORED_FPC_SALT } from '@aztec/constants';

// local imports
import { L1Adapter } from "../lib/bridging";
import { SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA } from '../lib/constants';

// evm 
import { L2ScrollBridgeAdapter, GigaBridge__factory, L1AztecBridgeAdapter__factory, L1ScrollBridgeAdapter__factory, L2ScrollBridgeAdapter__factory, L2WarpToad as L2EvmWarpToad, L2WarpToad__factory, L1WarpToad__factory } from '../../typechain-types';

// aztec
import { WarpToadCoreContract as L2AztecWarpToad, WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';

// constants
const projectRoot = `${__dirname}/../../`
export const AZTEC_DEPLOYED_FOLDER_PATH = `${projectRoot}/scripts/deploy/aztec/aztecDeployments/`
export const EVM_DEPLOYMENT_FOLDER_PATH = `${projectRoot}/ignition/deployments`

export const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))

export function getAztecDeployedAddressesFolderPath(chainId: bigint) {
    return `${AZTEC_DEPLOYED_FOLDER_PATH}/${Number(chainId)}`
}

export function getAztecDeployedAddressesFilePath(chainId: bigint) {
    return `${getAztecDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`
}

export function getEvmDeployedAddressesFolderPath(chainId: bigint) {
    return `${EVM_DEPLOYMENT_FOLDER_PATH}/chain-${Number(chainId)}`
}

export function getEvmDeployedAddressesFilePath(chainId: bigint) {
    return `${getEvmDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`
}

export async function getContractAddressesAztec(chainId: bigint) {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId)
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
}

export async function getContractAddressesEvm(chainId: bigint) {
    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId)
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
}


export function getL1Adapter(l2ChainId: bigint, isAztec = false, signer: ethers.Signer, allL1Contracts: any): L1Adapter {
    if ((!l2ChainId) && (!isAztec)) { throw new Error("either set isAztec to true, or provide a l2ChainId both cannot be falsy") }
    if (isAztec) {
        return L1AztecBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1AztecBridgeAdapter"], signer)
    }
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            return L1ScrollBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1ScrollBridgeAdapter"], signer)
        default:
            throw new Error("unknown chainId :/")
    }
}

export async function getL1Contracts(l1ChainId: bigint, l2ChainId: bigint, signer: ethers.Signer, isAztec = false,) {
    const l1Contracts = await getContractAddressesEvm(l1ChainId)
    const L1Adapter = getL1Adapter(l2ChainId, isAztec, signer, l1Contracts)
    const gigaBridge = GigaBridge__factory.connect(l1Contracts["L1InfraModule#GigaBridge"], signer)
    const l1Warptoad = L1WarpToad__factory.connect(l1Contracts["L1InfraModule#L1WarpToad"], signer)
    return { L1Adapter, gigaBridge, l1Warptoad }
}

export async function getL2EvmContracts(l2ChainId: bigint, signer: ethers.Signer): Promise<{ L2Adapter: L2ScrollBridgeAdapter, L2WarpToad: L2EvmWarpToad }> {
    const l2Contracts = await getContractAddressesEvm(l2ChainId)
    let L2Adapter;
    let L2WarpToad;
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            L2Adapter = L2ScrollBridgeAdapter__factory.connect(l2Contracts["L2ScrollModule#L2ScrollBridgeAdapter"], signer)
            L2WarpToad = L2WarpToad__factory.connect(l2Contracts["L2ScrollModule#L2WarpToad"], signer)
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
    return { L2Adapter: L2Adapter as L2ScrollBridgeAdapter, L2WarpToad: L2WarpToad as L2EvmWarpToad }
}

export async function getL2AZTECContracts(
    l1ChainId: bigint,
    l2Wallet: aztecWallet,
    PXE: PXE,
    aztecNodeUrl: string
): Promise<{ L2Adapter: L2AztecBridgeAdapterContract, L2WarpToad: L2AztecWarpToad }> {
    console.log({l1ChainId})
    const isSandBox = BigInt(l1ChainId) === 31337n
    const contracts = await getContractAddressesAztec(l1ChainId)

    const L2AztecAdapterAddress = contracts["L2AztecBridgeAdapter"]
    const AztecWarpToadAddress = contracts["AztecWarpToad"]

    if (!isSandBox) {
        const node = createAztecNodeClient(aztecNodeUrl)
        const AztecWarpToadContract = await node.getContract(AztecWarpToadAddress as any)
        await PXE.registerContract({
            instance: AztecWarpToadContract as any,
            artifact: WarpToadCoreContractArtifact,
        })
        await delay(10000)
        const L2AztecAdapterContract = await node.getContract(L2AztecAdapterAddress as any)
        await PXE.registerContract({
            instance: L2AztecAdapterContract as any,
            artifact: L2AztecBridgeAdapterContractArtifact,
        })
        await delay(10000)
    }

    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(L2AztecAdapterAddress, l2Wallet as aztecWallet)
    const AztecWarpToad = await WarpToadCoreContract.at(AztecWarpToadAddress, l2Wallet as aztecWallet)
    return { L2Adapter: L2AztecBridgeAdapter, L2WarpToad: AztecWarpToad }
}

export async function getL2Contracts(
    l2Wallet: aztecWallet | ethers.Signer,
    l1ChainId: bigint,
    l2ChainId: bigint,
    isAztec: boolean,
    PXE: PXE,
    aztecNodeUrl: string
): Promise<{
    L2Adapter: L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract,
    L2WarpToad: L2EvmWarpToad | L2AztecWarpToad
}> {
    if (isAztec) {
        return await getL2AZTECContracts(l1ChainId, l2Wallet as aztecWallet, PXE, aztecNodeUrl)

    } else {
        return await getL2EvmContracts(l2ChainId, l2Wallet as ethers.Signer)
    }

}

export function createRandomAztecPrivateKey(): `0x${string}` {
    const privKey = GrumpkinScalar.random();
    const scalar = privKey.toBigInt(); // bigint
    const hex = '0x' + scalar.toString(16).padStart(64, '0');
    return hex as `0x${string}`
}

// from https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/src/utils/deploy_account.ts#L9
export async function deploySchnorrAccount(pxe: PXE, hexSecretKey?: string, saltString?: string): Promise<AccountManager> {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    let secretKey = Fr.fromHexString(hexSecretKey ? hexSecretKey : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122")//0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121
    let salt = Fr.fromHexString(saltString ? saltString : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122")//Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt.toBigInt());
    try {
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });
    } catch (error) {
        const exceptedError = "Invalid tx: Existing nullifier"
        //@ts-ignore
        if (error.message.startsWith(exceptedError)) {
            //@ts-ignore
            console.log(`Ran into a error: ${error.message} deploying account: ${schnorrAccount.getAddress()}.\n Assuming that means the account already exist!`)
        } else {
            console.error(`Couldn't deploy schnorr account and it is also likely not already deployed since this isn't caused by the error: ${exceptedError}`, { cause: error })

        }

    }
    let wallet = await schnorrAccount.getWallet();

    return schnorrAccount;
}


export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    //@ts-ignore
    return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
        salt: new Fr(SPONSORED_FPC_SALT),
    });
}


// based of https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/scripts/deploy_contract.ts#L22
async function getTestnetWallet(pxe: PXE) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    let accountManager = await deploySchnorrAccount(pxe);
    const wallet = await accountManager.getWallet();
    return { wallet, sponsoredPaymentMethod }
}

/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE 
 * @param chainId 
 * @returns 
 */
export async function getAztecTestWallet(PXE: PXE, chainId: bigint) {
    if (chainId == 31337n) {
        console.warn("assuming ur on sandbox since chainId is 31337")
        return { wallet: (await getInitialTestAccountsWallets(PXE))[0], sponsoredPaymentMethod: undefined }
    } else {
        console.warn("assuming ur on testnet since chainId is NOT 31337")
        return await getTestnetWallet(PXE)
    }
}


export async function checkFileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

export async function promptBool(question: string): Promise<boolean> {
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}