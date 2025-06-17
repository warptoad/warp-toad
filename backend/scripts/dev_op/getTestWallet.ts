//@ts-ignore
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
//@ts-ignore
import { Fr, type ContractInstanceWithAddress, type PXE, getContractInstanceFromDeployParams, PXE, SponsoredFeePaymentMethod, AccountManager, GrumpkinScalar } from "@aztec/aztec.js";
//@ts-ignore
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
//@ts-ignore
import { deriveSigningKey } from "@aztec/stdlib/keys";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
//@ts-ignore
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { waitForBlocksAztec } from "../lib/bridging";

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

    let secretKey = Fr.fromHexString(hexSecretKey?hexSecretKey:"0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121")//0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121
    let salt = Fr.fromHexString(saltString?saltString:"0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121")//Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt.toBigInt());
    try {
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });
    } catch {
        console.log(`Ran into a error deploying account: ${schnorrAccount.getAddress()}. It likely already exists?`)
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
