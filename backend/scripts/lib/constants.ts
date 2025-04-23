import { ProofInputs, EvmMerkleData, AztecMerkleData, } from "./interfaces";
import { ethers } from "ethers";
export const AZTEC_TREE_DEPTH = 32;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;


// this wont prove
export const emptyLocalMerkleData: EvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(EVM_TREE_DEPTH).fill(0n),
} 

// this wont prove
export const emptyGigaMerkleData: EvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(GIGA_TREE_DEPTH).fill(ethers.toBeHex(0n)),
} 

// this wont prove
export const emptyAztecMerkleData: AztecMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(AZTEC_TREE_DEPTH).fill(ethers.toBeHex(0n)),
    leaf_nonce: ethers.toBeHex(0n),
    burn_tx_first_nullifier: ethers.toBeHex(0n),
    note_index_in_tx: ethers.toBeHex(0n)
} 
