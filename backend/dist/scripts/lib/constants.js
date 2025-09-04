import { ethers } from "ethers";
export const AZTEC_TREE_DEPTH = 40;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;
export const WARPTOAD_DEPLOYMENT_BLOCK_L1 = 9035512; // https://sepolia.etherscan.io/tx/0x477bfa00a1ee1bf6fac7ed70c9c9069fef4448e377cc43b3391e509d007b817f
export const WARPTOAD_DEPLOYMENT_BLOCK_AZTEC = 43560; // https://aztecscan.xyz/contracts/instances/0x06216f30183f2ab424eb87b296588e0404ce13b837c09d7e5db94d7a846a260f
export const WARPTOAD_DEPLOYMENT_BLOCK_SCROLL = 11722287; // https://sepolia.scrollscan.com/tx/0x4a034dfa8546dedbbad281e12f53bea10c5f6efbc8ef7bcbd92ef2ecefe46c35
export const DEPLOYMENT_BLOCK_PER_CHAINID = {
    WARPTOAD: {
        11155111: 9035512, // https://sepolia.etherscan.io/tx/0x477bfa00a1ee1bf6fac7ed70c9c9069fef4448e377cc43b3391e509d007b817f
        AZTEC: 43560, // https://aztecscan.xyz/contracts/instances/0x06216f30183f2ab424eb87b296588e0404ce13b837c09d7e5db94d7a846a260f
        534351: 11722287, // https://sepolia.scrollscan.com/tx/0x4a034dfa8546dedbbad281e12f53bea10c5f6efbc8ef7bcbd92ef2ecefe46c35,
        undefined: 0,
        31337: 0,
    }
};
// this not a valid proof
export const emptyEvmMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(EVM_TREE_DEPTH).fill(ethers.toBeHex(0n)),
};
Object.freeze(emptyEvmMerkleData);
// this not a valid proof
export const emptyGigaMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(GIGA_TREE_DEPTH).fill(ethers.toBeHex(0n)),
};
Object.freeze(emptyGigaMerkleData);
// this not a valid proof
export const emptyAztecMerkleData = {
    leaf_index: ethers.toBeHex(0n),
    hash_path: new Array(AZTEC_TREE_DEPTH).fill(ethers.toBeHex(0n)),
    leaf_nonce: ethers.toBeHex(0n),
    //contract_address: {inner:ethers.toBeHex(0n)},
    contract_address: ethers.toBeHex(0n),
};
Object.freeze(emptyAztecMerkleData);
export const gasCostPerChain = {
    // native L1 EVM
    "1": 520968n,
    "31337": 520968n,
    "11155111": 520968n,
    // zk-rollups
    // optimistic-rollups
};
Object.freeze(gasCostPerChain);
// from: https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L526
export const GENERATOR_INDEX__NOTE_HASH_NONCE = 2n;
// https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L527
export const GENERATOR_INDEX__UNIQUE_NOTE_HASH = 3n;
//https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr#L528
export const GENERATOR_INDEX__SILOED_NOTE_HASH = 4n;
export const L2_SCROLL_MESSENGER_MAINNET = "0x781e90f1c8Fc4611c9b7497C3B47F99Ef6969CbC";
export const L2_SCROLL_MESSENGER_SEPOLIA = "0xBa50f5340FB9F3Bd074bD638c9BE13eCB36E603d";
export const L1_SCROLL_MESSENGER_MAINNET = "0x6774Bcbd5ceCeF1336b5300fb5186a12DDD8b367";
export const L1_SCROLL_MESSENGER_SEPOLIA = "0x50c7d3e7f7c656493D1D76aaa1a836CedfCBB16A";
export const SCROLL_CHAINID_MAINNET = 534352n;
export const SCROLL_CHAINID_SEPOLIA = 534351n;
export const SEPOLIA_CHAINID = 11155111n;
