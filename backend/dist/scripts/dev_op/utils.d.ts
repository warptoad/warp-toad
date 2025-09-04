import { ethers } from 'ethers';
import { type ContractInstanceWithAddress, type PXE, SponsoredFeePaymentMethod, AccountManager, Wallet as aztecWallet } from "@aztec/aztec.js";
import { L1Adapter } from "../lib/bridging";
import { L2ScrollBridgeAdapter, L2WarpToad as L2EvmWarpToad } from '../../typechain-types';
import { WarpToadCoreContract as L2AztecWarpToad } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { L2AztecBridgeAdapterContract } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
export declare const AZTEC_DEPLOYED_FOLDER_PATH: string;
export declare const EVM_DEPLOYMENT_FOLDER_PATH: string;
export declare const delay: (timeInMs: number) => Promise<unknown>;
export declare function getAztecDeployedAddressesFolderPath(chainId: bigint): string;
export declare function getAztecDeployedAddressesFilePath(chainId: bigint): string;
export declare function getEvmDeployedAddressesFolderPath(chainId: bigint): string;
export declare function getEvmDeployedAddressesFilePath(chainId: bigint): string;
export declare function getContractAddressesAztec(chainId: bigint): Promise<any>;
export declare function getContractAddressesEvm(chainId: bigint): Promise<any>;
export declare function getL1Adapter(l2ChainId: bigint, isAztec: boolean, signer: ethers.Signer, allL1Contracts: any): L1Adapter;
export declare function getL1Contracts(l1ChainId: bigint, l2ChainId: bigint, signer: ethers.Signer, isAztec?: boolean): Promise<{
    L1Adapter: L1Adapter;
    gigaBridge: import("../../typechain-types").GigaBridge;
}>;
export declare function getL2EvmContracts(l2ChainId: bigint, signer: ethers.Signer): Promise<{
    L2Adapter: L2ScrollBridgeAdapter;
    L2WarpToad: L2EvmWarpToad;
}>;
export declare function getL2AZTECContracts(l1ChainId: bigint, l2Wallet: aztecWallet, PXE: PXE, aztecNodeUrl: string): Promise<{
    L2Adapter: L2AztecBridgeAdapterContract;
    L2WarpToad: L2AztecWarpToad;
}>;
export declare function getL2Contracts(l2Wallet: aztecWallet | ethers.Signer, l1ChainId: bigint, l2ChainId: bigint, isAztec: boolean, PXE: PXE, aztecNodeUrl: string): Promise<{
    L2Adapter: L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract;
    L2WarpToad: L2EvmWarpToad | L2AztecWarpToad;
}>;
export declare function createRandomAztecPrivateKey(): `0x${string}`;
export declare function deploySchnorrAccount(pxe: PXE, hexSecretKey?: string, saltString?: string): Promise<AccountManager>;
export declare function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress>;
/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE
 * @param chainId
 * @returns
 */
export declare function getAztecTestWallet(PXE: PXE, chainId: bigint): Promise<{
    wallet: import("@aztec/aztec.js", { with: { "resolution-mode": "import" } }).AccountWalletWithSecretKey;
    sponsoredPaymentMethod: SponsoredFeePaymentMethod;
}>;
export declare function checkFileExists(filePath: string): Promise<boolean>;
export declare function promptBool(question: string): Promise<boolean>;
