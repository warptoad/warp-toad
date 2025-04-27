import { ProofInputs, EvmMerkleData, AztecMerkleData, gasCosts} from "./types";
import { ethers } from "ethers";
export const AZTEC_TREE_DEPTH = 32;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;


// this not a valid proof
export const emptyLocalMerkleData: EvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(EVM_TREE_DEPTH).fill(0n),
} 
Object.freeze(emptyLocalMerkleData)

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
    burn_tx_first_nullifier: ethers.toBeHex(0n),
    note_index_in_tx: ethers.toBeHex(0n)
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
