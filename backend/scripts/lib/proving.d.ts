import { ProofData } from "@aztec/bb.js";
import { GigaBridge, WarpToadCore as WarpToadEvm } from "../../typechain-types";
import { WarpToadCoreContract as WarpToadAztec } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { ethers } from "ethers";
import { PXE } from "@aztec/pxe/server";
import { AztecNode } from "@aztec/aztec.js/node";
import { Wallet as AztecWallet } from "@aztec/aztec.js/wallet";
import { ProofInputs, EvmMerkleData, AztecMerkleData } from "./types";
/**
 * kind of weird number but its the thing that is multiplied with (baseFee+priorityFee) to get the amount of tokens the relayers gets to compensate for gas fees.
 * @param ethPriceInToken       how many tokens need to buy 1 ETH (or other native gas token if the chain is weird)
 * @param gasCost               gas cost of the mint function. Should be a publicly agreed on number so the relayer knows what to expect
 * @param relayerBonusFactor    the factor on top of the fee to pay the relayer. Ex: 1.10 <= 10% earnings
 * @returns feeFactor
 */
export declare function calculateFeeFactor(ethPriceInToken: number, gasCost: number, relayerBonusFactor: number): bigint;
export declare function queryEventInChunks(contract: ethers.Contract | ethers.BaseContract, filter: ethers.ContractEventName, firstBlock: number, lastBlock?: number, reverseOrder?: boolean, maxEvents?: number, chunksize?: number): Promise<ethers.EventLog[]>;
export declare function getWarptoadBurnEvents(warpToadOrigin: WarpToadEvm, localRootBlockNumber: number): Promise<ethers.EventLog[]>;
export declare function getEvmMerkleData(warpToadOrigin: WarpToadEvm, commitment: bigint, treeDepth: number, localRootBlockNumber: number): Promise<EvmMerkleData>;
export declare function getGigaBridgeNewRootEvents(gigaBridge: GigaBridge, allRootIndexes: ethers.BigNumberish[], gigaRootBlockNumber: number): Promise<ethers.EventLog[]>;
export declare function getGigaMerkleData(gigaBridge: GigaBridge, localRoot: bigint, localRootIndex: bigint, treeDepth: number, gigaRootBlockNumber: number): Promise<EvmMerkleData>;
export declare function getAztecNoteHashTreeRoot(blockNumber: number, aztecNode: AztecNode): Promise<bigint>;
export declare function getBlockNumberOfGigaRoot(gigaBridge: GigaBridge, gigaRoot: bigint): Promise<void>;
export declare function getLatestEvent(events: ethers.EventLog[] | any[]): any;
export declare function getGigaRootBlockNumber(gigaBridge: GigaBridge, gigaRoot: bigint): Promise<any>;
export declare function getLocalRootInGigaRoot(gigaBridge: GigaBridge, gigaRoot: bigint, gigaRootBlockNumber: number, warpToadOrigin: WarpToadEvm | WarpToadAztec, aztecWallet: AztecWallet): Promise<{
    localRoot: any;
    localRootL2BlockNumber: any;
    gigaRootBlockNumber: number;
    localRootIndex: bigint;
}>;
export declare function getL1BridgeAdapterAztec(WarpToad: WarpToadAztec, aztecWallet: AztecWallet): Promise<string>;
export declare function getAztecMerkleData(WarpToad: WarpToadAztec, commitment: bigint, destinationLocalRootBlock: number, PXE: PXE, aztecWallet: AztecWallet): Promise<AztecMerkleData>;
export declare function getMerkleData(gigaBridge: GigaBridge, warpToadOrigin: WarpToadEvm | WarpToadAztec, warpToadDestination: WarpToadEvm | WarpToadAztec, commitment: bigint, aztecWallet?: AztecWallet, PXE?: PXE, aztecNode?: AztecNode): Promise<{
    isFromAztec: boolean;
    gigaMerkleData: EvmMerkleData;
    evmMerkleData: EvmMerkleData;
    aztecMerkleData: AztecMerkleData;
    originLocalRoot: any;
    blockNumber: bigint;
}>;
export declare function getProofInputs(gigaBridge: GigaBridge, warpToadDestination: WarpToadEvm, warpToadOrigin: WarpToadEvm | WarpToadAztec, // warptoadEvm = {WarpToadCore} from typechain-types and WarpToadAztec = {WarpToadCoreContract} from `aztec-nargo codegen` 
amount: bigint, feeFactor: bigint, priorityFee: bigint, maxFee: bigint, relayerAddress: ethers.AddressLike, recipientAddress: ethers.AddressLike, nullifierPreImage: bigint, secret: bigint, aztecWallet?: AztecWallet, PXE?: PXE, aztecNode?: AztecNode): Promise<ProofInputs>;
export declare function createProof(proofInputs: ProofInputs, threads: number | undefined): Promise<ProofData>;
//# sourceMappingURL=proving.d.ts.map