import { Fr, PXE, SponsoredFeePaymentMethod, FieldsOf, TxReceipt } from "@aztec/aztec.js";
import { ethers } from "ethers";
import { L1AztecBridgeAdapter, GigaBridge, L2ScrollBridgeAdapter, L1ScrollBridgeAdapter, L2WarpToad as L2WarpToadEVM } from "../../typechain-types";
import { L2AztecBridgeAdapterContract } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { WarpToadCoreContract as L2WarpToadAZTEC } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
export declare const sleep: (ms: number) => Promise<unknown>;
export type L1Adapter = L1AztecBridgeAdapter | L1ScrollBridgeAdapter;
export type L2Adapter = L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract;
export type L2WarpToad = L2WarpToadAZTEC | L2WarpToadEVM;
export declare function getLocalRootProviders(chainId: bigint): Promise<any[]>;
export declare function getPayableGigaRootRecipients(chainId: bigint): Promise<any[]>;
export declare function getL1ClaimDataScrollBridgeApi(l2BridgeInitiationContract: ethers.AddressLike, txHash?: ethers.BytesLike, pageSize?: number): Promise<any>;
export declare function getClaimDataScroll(adapterContract: ethers.AddressLike, txHash?: ethers.BytesLike): Promise<any>;
export declare function claimL1WithdrawScroll(claimInfo: any, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse>;
export declare function bridgeEVMLocalRootToL1(L2Adapter: L2ScrollBridgeAdapter, signer: ethers.Signer): Promise<ethers.TransactionReceipt>;
/**
 * continues in updateGigaRoot
 *
 * bridges noteHashTreeRoot from aztec L2 to L1
 * L2aztecAdapter -> L1AztecAdapter
 * after this gigaBridge can call L1AztecAdapter.getLocalRootAndBlock() and use that to make a new gigaRoot
 * @param PXE
 * @param L2AztecBridgeAdapter
 * @param L1AztecBridgeAdapter
 * @param provider
 * @returns
 */
export declare function bridgeAZTECLocalRootToL1(PXE: PXE, L2AztecBridgeAdapter: L2AztecBridgeAdapterContract, L1AztecBridgeAdapter: L1AztecBridgeAdapter, provider: ethers.Provider, sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined): Promise<{
    refreshRootTx: ethers.ContractTransactionReceipt;
    sendRootToL1Tx: FieldsOf<TxReceipt>;
    PXE_L2Root: Fr;
}>;
export declare function bridgeLocalRootToL1(l1Wallet: ethers.Signer, gigaBridge: GigaBridge, L1Adapter: L1Adapter, L2Adapter: L2Adapter, isAztec?: boolean, PXE?: PXE, sponsoredPaymentMethodAZTEC?: SponsoredFeePaymentMethod): Promise<{
    sendRootToL1Tx: FieldsOf<TxReceipt>;
    sendRootToL1TxHash: import("@aztec/aztec.js", { with: { "resolution-mode": "import" } }).TxHash;
} | {
    sendRootToL1Tx: ethers.TransactionReceipt;
    sendRootToL1TxHash: string;
}>;
/**
 * happens after bridgeNoteHashTreeRoot()
 * continues in sendGigaRoot()
 *
 * calls the gigaBridge contract to collect all bridged localRoot from the L1Adapters (and L1warpToad) and use it to create a new gigaRoot
 * after this function gigaBridge.sendGigaRoot can be called to send the gigaRoot to all L2s (and L1warpToad)
 * @param gigaBridge
 * @param localRootProviders everyone who has a localRoot: L1warpToad + all L1<L2Name>Adapters
 * @returns
 */
export declare function updateGigaRoot(gigaBridge: GigaBridge, localRootProviders: ethers.AddressLike[]): Promise<{
    gigaRootUpdateTx: ethers.ContractTransactionReceipt;
    gigaRootUpdateTxHash: string;
}>;
/**
 * happens after updateGigaRoot()
 * continues in: [receiveGigaRootOnAztec, etc]
 *
 * sends the gigaRoot to all L1 adapter (and L1Warptoad) so it can be bridged.
 * Depending on the native bridge of the L2, the message either automatically arrives or needs to be initiated by a EOA (like with receiveGigaRootOnAztec)
 * @param gigaBridge
 * @param gigaRootRecipients same as localRootProviders but here they receive a gigaRoot!
 * @param isSandBox
 * @returns
 */
export declare function sendGigaRoot(gigaBridge: GigaBridge, gigaRootRecipients: ethers.AddressLike[], allPayableGigaRootRecipients: ethers.AddressLike[]): Promise<{
    sendGigaRootTx: ethers.ContractTransactionReceipt;
    sendGigaRootTxHash: string;
    gigaRootSent: any;
}>;
/**
 * happens after sendGigaRoot
 * makes the L2AztecBridgeAdapter retrieve the gigaRoot from the native aztec bridge on L2
 * @param params
 * @returns
 */
export declare function receiveGigaRootOnAztec(L2AztecBridgeAdapter: L2AztecBridgeAdapterContract, L1AztecBridgeAdapter: L1AztecBridgeAdapter, AztecWarpToad: L2WarpToadAZTEC, sendGigaRootTx: ethers.TransactionReceipt, // either get it from sendGigaRoot. or event scan for a specific gigaRoot with "NewGigaRootSentToAztec"
PXE: PXE, isSandBox?: boolean, sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined): Promise<{
    receiveGigaRootTx: FieldsOf<TxReceipt>;
}>;
export declare function waitForBlocksAztec(blocksToWait: number, PXE: PXE): Promise<void>;
export declare function tryUntilItWorks(contract: ethers.Contract | any, funcName: string, funcArgs: any[], waitFunc: any): Promise<ethers.ContractTransactionResponse>;
export declare function parseEventFromTx(tx: ethers.TransactionReceipt, contract: ethers.Contract | any, eventName: string): any;
export declare function receiveGigaRootOnEvmL2(L2Adapter: L2ScrollBridgeAdapter, gigaRootSent: bigint): Promise<ethers.TransactionResponse>;
export declare function receiveGigaRootOnL2(L1Adapter: L1Adapter, L2Adapter: L2Adapter, L2WarpToad: L2WarpToad, sendGigaRootTx: ethers.TransactionReceipt, gigaRootSent?: bigint, isAztec?: boolean, isSandBox?: boolean, PXE?: PXE, sponsoredPaymentMethod?: SponsoredFeePaymentMethod): Promise<{
    receiveGigaRootTx: FieldsOf<TxReceipt>;
    receiveGigaRootTxHash: Fr;
    gigaRootOnL2: any;
} | {
    receiveGigaRootTx: ethers.TransactionResponse;
    receiveGigaRootTxHash: string;
    gigaRootOnL2: bigint;
}>;
export declare function parseMultipleEventsFromTx(tx: ethers.TransactionReceipt, contract: ethers.Contract | any, eventName: string): any[];
/**
 * Bridges L1 <-> L2
 * Bridges the localRoot from L2 to L1, then sends the new gigaRoot from L1 back to the L2 (or multiple localRootProviders if provided)
 * @param l1Wallet
 * @param L1Adapter
 * @param gigaBridge
 * @param L2Adapter
 * @param L2WarpToad
 * @param localRootProviders the addresses of the L2Adapters who will receive the new gigaRoot
 * @param payableLocalRootProviders the addresses of the L2Adapters that need eth to bridge the gigaRoot, current only scroll
 * @param aztecInputs things specific to aztec, like the PXE, feePaymentMethod. Can be left out if ur not using aztec
 */
export declare function bridgeBetweenL1AndL2(l1Wallet: ethers.Signer, L1Adapter: L1Adapter, gigaBridge: GigaBridge, L2Adapter: L2Adapter, L2WarpToad: L2WarpToad, localRootProviders: ethers.AddressLike[], payableLocalRootProviders: ethers.AddressLike[], aztecInputs?: {
    isAztec?: boolean;
    PXE?: PXE;
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod;
}): Promise<{
    txObjects: {
        sendRootToL1Tx: FieldsOf<TxReceipt> | ethers.TransactionReceipt;
        gigaRootUpdateTx: ethers.ContractTransactionReceipt;
        sendGigaRootTx: ethers.ContractTransactionReceipt;
        receiveGigaRootTx: ethers.TransactionResponse | FieldsOf<TxReceipt>;
    };
    txHashes: {
        sendRootToL1TxHash: string | import("@aztec/aztec.js", { with: { "resolution-mode": "import" } }).TxHash;
        gigaRootUpdateTxHash: string;
        sendGigaRootTxHash: string;
        receiveGigaRootTxHash: string | Fr;
    };
    roots: {
        gigaRootSent: any;
    };
}>;
