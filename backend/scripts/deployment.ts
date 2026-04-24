
import { type WalletClient, type PublicClient } from 'viem';
import { getViemContract } from './utils';

import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

//@ts-ignore
import { deriveSigningKey } from "@aztec/stdlib/keys";

import { generateSchnorrAccounts, getInitialTestAccountsData } from "@aztec/accounts/testing";
//@ts-ignore
import { SPONSORED_FPC_SALT } from '@aztec/constants';

// local imports
import { L1Adapter } from "../lib/bridging";
import { SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA } from '../lib/constants';

import { initNodeClientNoEnv, getAztecTestAccountNoEnv, getContractInstanceFromAddressNoEnv, initPXE, DeploymentArtifact, DeploymentStringyfiedArtifact } from '../deploy/utils/aztecUtilsNoEnv';

// EVM contract handles are built at runtime via getViemContract (reads ABIs from Hardhat artifacts).
// Aztec codegen still pending:
// import { WarpToadCoreContract as L2AztecWarpToad, WarpToadCoreContract, WarpToadCoreContractArtifact } from '../aztec/WarpToadCore/src/artifacts/WarpToadCore';
// import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from '../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
// Loose types until typechain replacement is finalized:
type L2ScrollBridgeAdapter = any;
type L2EvmWarpToad = any;

//@ts-ignore
import aztecDeploymentsSepolia from "../deploy/aztec/aztecDeployments/11155111/deployed_addresses.json" with { type: 'json' };
//@ts-ignore
import aztecDeploymentsSandbox from "../deploy/aztec/aztecDeployments/31337/deployed_addresses.json" with { type: 'json' };

import { AccountManager, Wallet } from '@aztec/aztec.js/wallet';
import { PXE } from '@aztec/pxe/server';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { ContractInstanceWithAddress, getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';

import { AztecAddress } from '@aztec/aztec.js/addresses';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { getDeploymentArtifactAztec } from './utils';

interface deployments {
    [chainId: number]: any
}

// Function to load deployments safely
function loadDeployments(): deployments {
    const deployments: deployments = {};
    const deploymentsDir = path.join(__dirname, '../deploy/ignition/deployments');
    
    // Try to load chain-31337 (local)
    try {
        const localPath = path.join(deploymentsDir, 'chain-31337/deployed_addresses.json');
        if (fs.existsSync(localPath)) {
            deployments[31337] = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
    } catch (e) {
        console.warn("Local deployments not found (chain-31337)");
    }
    
    // Try to load chain-11155111 (Sepolia)
    try {
        const sepoliaPath = path.join(deploymentsDir, 'chain-11155111/deployed_addresses.json');
        if (fs.existsSync(sepoliaPath)) {
            deployments[11155111] = JSON.parse(fs.readFileSync(sepoliaPath, 'utf-8'));
        }
    } catch (e) {
        console.warn("Sepolia deployments not found (chain-11155111)");
    }
    
    // Try to load chain-534351 (Scroll Sepolia)
    try {
        const scrollPath = path.join(deploymentsDir, 'chain-534351/deployed_addresses.json');
        if (fs.existsSync(scrollPath)) {
            deployments[534351] = JSON.parse(fs.readFileSync(scrollPath, 'utf-8'));
        }
    } catch (e) {
        console.warn("Scroll Sepolia deployments not found (chain-534351)");
    }
    
    return deployments;
}

export const evmDeployments: deployments = loadDeployments();

export const aztecDeployments: deployments = {
    11155111: aztecDeploymentsSepolia,
    31337: aztecDeploymentsSandbox
}


export const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))

export async function getL1Adapter(l2ChainId: bigint, isAztec = false, publicClient: PublicClient, signer: WalletClient, allL1Contracts: any): Promise<L1Adapter> {
    if ((!l2ChainId) && (!isAztec)) { throw new Error("either set isAztec to true, or provide a l2ChainId both cannot be falsy") }
    if (isAztec) {
        return await getViemContract("L1AztecBridgeAdapter", allL1Contracts["L1InfraModule#L1AztecBridgeAdapter"], publicClient, signer)
    }
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            return await getViemContract("L1ScrollBridgeAdapter", allL1Contracts["L1InfraModule#L1ScrollBridgeAdapter"], publicClient, signer)
        default:
            throw new Error("unknown chainId :/")
    }
}

export async function getL1Contracts(l1ChainId: bigint, l2ChainId: bigint, publicClient: PublicClient, signer: WalletClient, isAztec = false,) {
    const l1Contracts = evmDeployments[Number(l1ChainId)]
    const L1Adapter = await getL1Adapter(l2ChainId, isAztec, publicClient, signer, l1Contracts)
    const gigaBridge = await getViemContract("GigaBridge", l1Contracts["L1InfraModule#GigaBridge"], publicClient, signer)
    const l1Warptoad = await getViemContract("L1WarpToad", l1Contracts["L1InfraModule#L1WarpToad"], publicClient, signer)
    return { L1Adapter, gigaBridge, l1Warptoad }
}

export async function getL2EvmContracts(l2ChainId: bigint, publicClient: PublicClient, signer: WalletClient): Promise<{ L2Adapter: L2ScrollBridgeAdapter, L2WarpToad: L2EvmWarpToad }> {
    const l2Contracts = evmDeployments[Number(l2ChainId)]
    let L2Adapter: any;
    let L2WarpToad: any;
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            L2Adapter = await getViemContract("L2ScrollBridgeAdapter", l2Contracts["L2ScrollModule#L2ScrollBridgeAdapter"], publicClient, signer)
            L2WarpToad = await getViemContract("L2WarpToad", l2Contracts["L2ScrollModule#L2WarpToad"], publicClient, signer)
            break;
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
    return { L2Adapter: L2Adapter as L2ScrollBridgeAdapter, L2WarpToad: L2WarpToad as L2EvmWarpToad }
}

export async function getL2AZTECContracts(
    l1ChainId: bigint,
    l2Wallet: Wallet,
    PXE: PXE,
    aztecNodeUrl: string
): Promise<{ L2Adapter: L2AztecBridgeAdapterContract, L2WarpToad: L2AztecWarpToad }> {
    const isSandBox = BigInt(l1ChainId) === 31337n
    const contracts = aztecDeployments[Number(l1ChainId)]

    const { address: AztecWarpToadAddress,}:{address:AztecAddress} = contracts["AztecWarpToad"]
    const { address: L2AztecAdapterAddress }:{address:AztecAddress} = contracts["L2AztecBridgeAdapter"]
    const warptoadDeployArtifact = await getDeploymentArtifactAztec(l1ChainId, "AztecWarpToad")
    const adapterDeployArtifact = await getDeploymentArtifactAztec(l1ChainId, "L2AztecBridgeAdapter")
    console.log("IS SANDBOX?:", isSandBox)
    const aztecWarpToadContractInstance = await getContractInstanceFromInstantiationParams(
        WarpToadCoreContractArtifact,
        {
            salt: Fr.fromHexString(warptoadDeployArtifact.salt),
            constructorArgs: warptoadDeployArtifact.constructorArgs.map((v: string) => v.startsWith("0x") ? new Fr(BigInt(v)) : v),
            deployer:AztecAddress.fromField(Fr.fromHexString(warptoadDeployArtifact.deployer))
        }
    )
    const l2AztecAdapterContractInstance = await getContractInstanceFromInstantiationParams(
        L2AztecBridgeAdapterContractArtifact,
        {
            salt: Fr.fromHexString(adapterDeployArtifact.salt),
            constructorArgs: adapterDeployArtifact.constructorArgs.map((v: string) => v.startsWith("0x") ? new Fr(BigInt(v)) : v),
            deployer:AztecAddress.fromField(Fr.fromHexString(adapterDeployArtifact.deployer))
        }
    )

    await PXE.registerContract({
        instance: aztecWarpToadContractInstance,
        artifact: WarpToadCoreContractArtifact
    })

    await PXE.registerContract({
        instance: l2AztecAdapterContractInstance,
        artifact: L2AztecBridgeAdapterContractArtifact
    })
    console.log("cant register contract on wallet object but can on PXE obj?? TODO report bug.")
    await l2Wallet.registerContract(
        aztecWarpToadContractInstance,
        WarpToadCoreContractArtifact
    )
    await l2Wallet.registerContract(
        l2AztecAdapterContractInstance,
        L2AztecBridgeAdapterContractArtifact
    )
    await delay(10000)
    const aztecWarpToad = await WarpToadCoreContract.at(aztecWarpToadContractInstance.address, l2Wallet);
    const l2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(l2AztecAdapterContractInstance.address, l2Wallet)


    return { L2Adapter: l2AztecBridgeAdapter, L2WarpToad: aztecWarpToad }
}

export async function getL2Contracts(
    l2Wallet: Wallet | WalletClient,
    l1ChainId: bigint,
    l2ChainId: bigint,
    isAztec: boolean,
    PXE: PXE,
    aztecNodeUrl: string,
    l2PublicClient?: PublicClient,
): Promise<{
    L2Adapter: L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract,
    L2WarpToad: L2EvmWarpToad | L2AztecWarpToad
}> {
    if (isAztec) {
        return await getL2AZTECContracts(l1ChainId, l2Wallet as Wallet, PXE, aztecNodeUrl)

    } else {
        if (!l2PublicClient) throw new Error("l2PublicClient is required for EVM L2")
        return await getL2EvmContracts(l2ChainId, l2PublicClient, l2Wallet as WalletClient)
    }

}

export function createRandomAztecPrivateKey(): `0x${string}` {
    const privKey = GrumpkinScalar.random();
    const scalar = privKey.toBigInt(); // bigint
    const hex = '0x' + scalar.toString(16).padStart(64, '0');
    return hex as `0x${string}`
}

// from https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/src/utils/deploy_account.ts#L9
/*export async function deploySchnorrAccount(pxe: PXE, hexSecretKey?: string, saltString?: string): Promise<AccountManager> {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    let secretKey = Fr.fromHexString(hexSecretKey ? hexSecretKey : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122")//0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121
    let salt = Fr.fromHexString(saltString ? saltString : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122")//Fr.random();

    let schnorrAccount = await generateSchnorrAccounts(pxe, secretKey, deriveSigningKey(secretKey), salt.toBigInt());
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

    return schnorrAccount;
}*/


export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    //@ts-ignore
    return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
        salt: new Fr(SPONSORED_FPC_SALT),
    });
}


// based of https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/scripts/deploy_contract.ts#L22
async function getTestnetWallet(pxe: PXE, aztecNodeUrl: string) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    //let accountManager = await deploySchnorrAccount(pxe);
    //const wallet = await accountManager.getWallet();
    const wallet = await getAztecTestAccountNoEnv(2n, aztecNodeUrl)
    return { wallet, sponsoredPaymentMethod }
}

/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE 
 * @param chainId 
 * @returns 
 */
export async function getAztecTestWallet(PXE: PXE, chainId: bigint, aztecNodeUrl: string) {
    if (chainId == 31337n) {
        console.warn("assuming ur on sandbox since chainId is 31337")
        return { wallet: (await getInitialTestAccountsData())[0], sponsoredPaymentMethod: undefined }
    } else {
        console.warn("assuming ur on testnet since chainId is NOT 31337")
        return await getTestnetWallet(PXE, aztecNodeUrl)
    }
}