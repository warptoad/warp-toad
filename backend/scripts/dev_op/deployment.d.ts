import { ethers } from 'ethers';
import { L1Adapter } from "../lib/bridging";
import { L2ScrollBridgeAdapter, L2WarpToad as L2EvmWarpToad } from '../../typechain-types';
import { WarpToadCoreContract as L2AztecWarpToad } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { L2AztecBridgeAdapterContract } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { Wallet } from '@aztec/aztec.js/wallet';
import { PXE } from '@aztec/pxe/server';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
interface deployments {
    [chainId: number]: any;
}
export declare const evmDeployments: deployments;
export declare const aztecDeployments: deployments;
export declare const delay: (timeInMs: number) => Promise<unknown>;
export declare function getL1Adapter(l2ChainId: bigint, isAztec: boolean | undefined, signer: ethers.Signer, allL1Contracts: any): L1Adapter;
export declare function getL1Contracts(l1ChainId: bigint, l2ChainId: bigint, signer: ethers.Signer, isAztec?: boolean): Promise<{
    L1Adapter: L1Adapter;
    gigaBridge: import("../../typechain-types").GigaBridge;
    l1Warptoad: import("../../typechain-types").L1WarpToad;
}>;
export declare function getL2EvmContracts(l2ChainId: bigint, signer: ethers.Signer): Promise<{
    L2Adapter: L2ScrollBridgeAdapter;
    L2WarpToad: L2EvmWarpToad;
}>;
export declare function getL2AZTECContracts(l1ChainId: bigint, l2Wallet: Wallet, PXE: PXE, aztecNodeUrl: string): Promise<{
    L2Adapter: L2AztecBridgeAdapterContract;
    L2WarpToad: L2AztecWarpToad;
}>;
export declare function getL2Contracts(l2Wallet: Wallet | ethers.Signer, l1ChainId: bigint, l2ChainId: bigint, isAztec: boolean, PXE: PXE, aztecNodeUrl: string): Promise<{
    L2Adapter: L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract;
    L2WarpToad: L2EvmWarpToad | L2AztecWarpToad;
}>;
export declare function createRandomAztecPrivateKey(): `0x${string}`;
export declare function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress>;
/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE
 * @param chainId
 * @returns
 */
export declare function getAztecTestWallet(PXE: PXE, chainId: bigint, aztecNodeUrl: string): Promise<{
    wallet: import("@aztec/test-wallet/server").TestWallet;
    sponsoredPaymentMethod: SponsoredFeePaymentMethod;
} | {
    wallet: import("@aztec/accounts/testing").InitialAccountData;
    sponsoredPaymentMethod: undefined;
}>;
export {};
//# sourceMappingURL=deployment.d.ts.map