import { ProofInputs, EvmMerkleData, AztecMerkleData, gasCosts} from "./types";
import { ethers } from "ethers";
// @ts-ignore
import { AztecAddress } from "@aztec/aztec.js";
export const AZTEC_TREE_DEPTH = 40;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;


// this not a valid proof
export const emptyEvmMerkleData: EvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(EVM_TREE_DEPTH).fill(ethers.toBeHex(0n)),
} 
Object.freeze(emptyEvmMerkleData)

// this not a valid proof
export const emptyGigaMerkleData: EvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(GIGA_TREE_DEPTH).fill(ethers.toBeHex(0n)),
} 
Object.freeze(emptyGigaMerkleData)

// this not a valid proof
export const emptyAztecMerkleData: AztecMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(AZTEC_TREE_DEPTH).fill(ethers.toBeHex(0n)),
    leaf_nonce: ethers.toBeHex(0n),
    //contract_address: {inner:ethers.toBeHex(0n)},
    contract_address: ethers.toBeHex(0n),
} 
Object.freeze(emptyAztecMerkleData)

export const gasCostPerChain: gasCosts = {
    // native L1 EVM
    "1":520968n,
    "31337":520968n,
    "11155111":520968n,
    // zk-rollups
    // optimistic-rollups
}
Object.freeze(gasCostPerChain)

// from: https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L526
export const GENERATOR_INDEX__NOTE_HASH_NONCE = 2n;
// https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L527
export const GENERATOR_INDEX__UNIQUE_NOTE_HASH = 3n
//https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L528
export const GENERATOR_INDEX__SILOED_NOTE_HASH = 4n;
