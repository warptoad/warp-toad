import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";
//@ts-ignore
import { Fr, getContractInstanceFromDeployParams, SponsoredFeePaymentMethod, GrumpkinScalar, createAztecNodeClient } from "@aztec/aztec.js";
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
import { SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA } from '../lib/constants';
// evm 
import { GigaBridge__factory, L1AztecBridgeAdapter__factory, L1ScrollBridgeAdapter__factory, L2ScrollBridgeAdapter__factory, L2WarpToad__factory } from '../../typechain-types';
// aztec
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
// constants
const projectRoot = `${__dirname}/../../`;
export const AZTEC_DEPLOYED_FOLDER_PATH = `${projectRoot}/scripts/deploy/aztec/aztecDeployments/`;
export const EVM_DEPLOYMENT_FOLDER_PATH = `${projectRoot}/ignition/deployments`;
export const delay = async (timeInMs) => await new Promise((resolve) => setTimeout(resolve, timeInMs));
export function getAztecDeployedAddressesFolderPath(chainId) {
    return `${AZTEC_DEPLOYED_FOLDER_PATH}/${Number(chainId)}`;
}
export function getAztecDeployedAddressesFilePath(chainId) {
    return `${getAztecDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
export function getEvmDeployedAddressesFolderPath(chainId) {
    return `${EVM_DEPLOYMENT_FOLDER_PATH}/chain-${Number(chainId)}`;
}
export function getEvmDeployedAddressesFilePath(chainId) {
    return `${getEvmDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
export async function getContractAddressesAztec(chainId) {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId);
    const json = (await fs.readFile(deployedAddressesPath)).toString();
    return JSON.parse(json);
}
export async function getContractAddressesEvm(chainId) {
    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId);
    const json = (await fs.readFile(deployedAddressesPath)).toString();
    return JSON.parse(json);
}
export function getL1Adapter(l2ChainId, isAztec = false, signer, allL1Contracts) {
    if ((!l2ChainId) && (!isAztec)) {
        throw new Error("either set isAztec to true, or provide a l2ChainId both cannot be falsy");
    }
    if (isAztec) {
        return L1AztecBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1AztecBridgeAdapter"], signer);
    }
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            return L1ScrollBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1ScrollBridgeAdapter"], signer);
        default:
            throw new Error("unknown chainId :/");
    }
}
export async function getL1Contracts(l1ChainId, l2ChainId, signer, isAztec = false) {
    const l1Contracts = await getContractAddressesEvm(l1ChainId);
    const L1Adapter = getL1Adapter(l2ChainId, isAztec, signer, l1Contracts);
    const gigaBridge = GigaBridge__factory.connect(l1Contracts["L1InfraModule#GigaBridge"], signer);
    return { L1Adapter, gigaBridge };
}
export async function getL2EvmContracts(l2ChainId, signer) {
    const l2Contracts = await getContractAddressesEvm(l2ChainId);
    let L2Adapter;
    let L2WarpToad;
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            L2Adapter = L2ScrollBridgeAdapter__factory.connect(l2Contracts["L2ScrollModule#L2ScrollBridgeAdapter"], signer);
            L2WarpToad = L2WarpToad__factory.connect(l2Contracts["L2ScrollModule#L2WarpToad"], signer);
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
    return { L2Adapter: L2Adapter, L2WarpToad: L2WarpToad };
}
export async function getL2AZTECContracts(l1ChainId, l2Wallet, PXE, aztecNodeUrl) {
    console.log({ l1ChainId });
    const isSandBox = BigInt(l1ChainId) === 31337n;
    const contracts = await getContractAddressesAztec(l1ChainId);
    const L2AztecAdapterAddress = contracts["L2AztecBridgeAdapter"];
    const AztecWarpToadAddress = contracts["AztecWarpToad"];
    if (!isSandBox) {
        const node = createAztecNodeClient(aztecNodeUrl);
        const AztecWarpToadContract = await node.getContract(AztecWarpToadAddress);
        await PXE.registerContract({
            instance: AztecWarpToadContract,
            artifact: WarpToadCoreContractArtifact,
        });
        await delay(10000);
        const L2AztecAdapterContract = await node.getContract(L2AztecAdapterAddress);
        await PXE.registerContract({
            instance: L2AztecAdapterContract,
            artifact: L2AztecBridgeAdapterContractArtifact,
        });
        await delay(10000);
    }
    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(L2AztecAdapterAddress, l2Wallet);
    const AztecWarpToad = await WarpToadCoreContract.at(AztecWarpToadAddress, l2Wallet);
    return { L2Adapter: L2AztecBridgeAdapter, L2WarpToad: AztecWarpToad };
}
export async function getL2Contracts(l2Wallet, l1ChainId, l2ChainId, isAztec, PXE, aztecNodeUrl) {
    if (isAztec) {
        return await getL2AZTECContracts(l1ChainId, l2Wallet, PXE, aztecNodeUrl);
    }
    else {
        return await getL2EvmContracts(l2ChainId, l2Wallet);
    }
}
export function createRandomAztecPrivateKey() {
    const privKey = GrumpkinScalar.random();
    const scalar = privKey.toBigInt(); // bigint
    const hex = '0x' + scalar.toString(16).padStart(64, '0');
    return hex;
}
// from https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/src/utils/deploy_account.ts#L9
export async function deploySchnorrAccount(pxe, hexSecretKey, saltString) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    let secretKey = Fr.fromHexString(hexSecretKey ? hexSecretKey : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122"); //0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121
    let salt = Fr.fromHexString(saltString ? saltString : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122"); //Fr.random();
    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt.toBigInt());
    try {
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });
    }
    catch (error) {
        const exceptedError = "Invalid tx: Existing nullifier";
        //@ts-ignore
        if (error.message.startsWith(exceptedError)) {
            //@ts-ignore
            console.log(`Ran into a error: ${error.message} deploying account: ${schnorrAccount.getAddress()}.\n Assuming that means the account already exist!`);
        }
        else {
            console.error(`Couldn't deploy schnorr account and it is also likely not already deployed since this isn't caused by the error: ${exceptedError}`, { cause: error });
        }
    }
    let wallet = await schnorrAccount.getWallet();
    return schnorrAccount;
}
export async function getSponsoredFPCInstance() {
    //@ts-ignore
    return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
        salt: new Fr(SPONSORED_FPC_SALT),
    });
}
// based of https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/scripts/deploy_contract.ts#L22
async function getTestnetWallet(pxe) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);
    let accountManager = await deploySchnorrAccount(pxe);
    const wallet = await accountManager.getWallet();
    return { wallet, sponsoredPaymentMethod };
}
/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE
 * @param chainId
 * @returns
 */
export async function getAztecTestWallet(PXE, chainId) {
    if (chainId == 31337n) {
        console.warn("assuming ur on sandbox since chainId is 31337");
        return { wallet: (await getInitialTestAccountsWallets(PXE))[0], sponsoredPaymentMethod: undefined };
    }
    else {
        console.warn("assuming ur on testnet since chainId is NOT 31337");
        return await getTestnetWallet(PXE);
    }
}
export async function checkFileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}
export async function promptBool(question) {
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}
