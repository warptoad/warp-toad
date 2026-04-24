import { ProofInputs, EvmMerkleData, AztecMerkleData, gasCosts} from "./types";
import { toHex } from "viem";
// @ts-ignore
export const AZTEC_TREE_DEPTH = 42;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;
export const WARPTOAD_DEPLOYMENT_BLOCK_L1 = 9035512;    // https://sepolia.etherscan.io/tx/0x477bfa00a1ee1bf6fac7ed70c9c9069fef4448e377cc43b3391e509d007b817f
export const WARPTOAD_DEPLOYMENT_BLOCK_AZTEC = 43560;   // https://aztecscan.xyz/contracts/instances/0x06216f30183f2ab424eb87b296588e0404ce13b837c09d7e5db94d7a846a260f
export const WARPTOAD_DEPLOYMENT_BLOCK_SCROLL = 11722287;      // https://sepolia.scrollscan.com/tx/0x4a034dfa8546dedbbad281e12f53bea10c5f6efbc8ef7bcbd92ef2ecefe46c35



interface DeploymentBlockData {
    [contractName: string]: { [chainId: string]: number };
}

export const DEPLOYMENT_BLOCK_PER_CHAINID:DeploymentBlockData = {
    WARPTOAD: {
        11155111: 9035512,    // https://sepolia.etherscan.io/tx/0x477bfa00a1ee1bf6fac7ed70c9c9069fef4448e377cc43b3391e509d007b817f
        AZTEC: 43560,         // https://aztecscan.xyz/contracts/instances/0x06216f30183f2ab424eb87b296588e0404ce13b837c09d7e5db94d7a846a260f
        534351: 11722287,     // https://sepolia.scrollscan.com/tx/0x4a034dfa8546dedbbad281e12f53bea10c5f6efbc8ef7bcbd92ef2ecefe46c35,
        undefined: 0,
        31337: 0,
    }
}

// is fine for us to use static salt, Normally randomness good for privacy. But our contract is public!!
// export const DEPLOYMENT_SALT = new Fr(0x465245455F414C4558595F414E445F524F4D414En)

// this not a valid proof
export const emptyEvmMerkleData: EvmMerkleData = {
    leaf_index: toHex(0n),
    hash_path: new Array(EVM_TREE_DEPTH).fill(toHex(0n)),
} 
Object.freeze(emptyEvmMerkleData)

// this not a valid proof
export const emptyGigaMerkleData: EvmMerkleData = {
    leaf_index: toHex(0n),
    hash_path: new Array(GIGA_TREE_DEPTH).fill(toHex(0n)),
} 
Object.freeze(emptyGigaMerkleData)

// this not a valid proof
export const emptyAztecMerkleData: AztecMerkleData = {
    leaf_index: toHex(0n),
    hash_path: new Array(AZTEC_TREE_DEPTH).fill(toHex(0n)),
    leaf_nonce: toHex(0n),
    //contract_address: {inner:toHex(0n)},
    contract_address: toHex(0n),
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

// Aztec 4.2.0+ replaced sequential generator indices with derived domain separators.
// Source: aztec-packages/noir-projects/noir-protocol-circuits/crates/types/src/constants.nr
//   pub global DOM_SEP__NOTE_HASH_NONCE: u32 = 1721808740;
//   pub global DOM_SEP__UNIQUE_NOTE_HASH: u32 = 226850429;
//   pub global DOM_SEP__SILOED_NOTE_HASH: u32 = 3361878420;
export const GENERATOR_INDEX__NOTE_HASH_NONCE = 1721808740n;
export const GENERATOR_INDEX__UNIQUE_NOTE_HASH = 226850429n
export const GENERATOR_INDEX__SILOED_NOTE_HASH = 3361878420n;

export const L2_SCROLL_MESSENGER_MAINNET = "0x781e90f1c8Fc4611c9b7497C3B47F99Ef6969CbC"
export const L2_SCROLL_MESSENGER_SEPOLIA = "0xBa50f5340FB9F3Bd074bD638c9BE13eCB36E603d"
export const L1_SCROLL_MESSENGER_MAINNET = "0x6774Bcbd5ceCeF1336b5300fb5186a12DDD8b367"
export const L1_SCROLL_MESSENGER_SEPOLIA = "0x50c7d3e7f7c656493D1D76aaa1a836CedfCBB16A"
export const SCROLL_CHAINID_MAINNET = 534352n
export const SCROLL_CHAINID_SEPOLIA = 534351n

export const SEPOLIA_CHAINID = 11155111n