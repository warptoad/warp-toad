import { EvmMerkleData, AztecMerkleData, gasCosts } from "./types";
export declare const AZTEC_TREE_DEPTH = 40;
export declare const EVM_TREE_DEPTH = 32;
export declare const EVM_TREE_MAX_LEAVES: number;
export declare const GIGA_TREE_DEPTH = 5;
export declare const WARPTOAD_DEPLOYMENT_BLOCK_L1 = 9035512;
export declare const WARPTOAD_DEPLOYMENT_BLOCK_AZTEC = 43560;
export declare const WARPTOAD_DEPLOYMENT_BLOCK_SCROLL = 11722287;
interface DeploymentBlockData {
    [contractName: string]: {
        [chainId: string]: number;
    };
}
export declare const DEPLOYMENT_BLOCK_PER_CHAINID: DeploymentBlockData;
export declare const emptyEvmMerkleData: EvmMerkleData;
export declare const emptyGigaMerkleData: EvmMerkleData;
export declare const emptyAztecMerkleData: AztecMerkleData;
export declare const gasCostPerChain: gasCosts;
export declare const GENERATOR_INDEX__NOTE_HASH_NONCE = 2n;
export declare const GENERATOR_INDEX__UNIQUE_NOTE_HASH = 3n;
export declare const GENERATOR_INDEX__SILOED_NOTE_HASH = 4n;
export declare const L2_SCROLL_MESSENGER_MAINNET = "0x781e90f1c8Fc4611c9b7497C3B47F99Ef6969CbC";
export declare const L2_SCROLL_MESSENGER_SEPOLIA = "0xBa50f5340FB9F3Bd074bD638c9BE13eCB36E603d";
export declare const L1_SCROLL_MESSENGER_MAINNET = "0x6774Bcbd5ceCeF1336b5300fb5186a12DDD8b367";
export declare const L1_SCROLL_MESSENGER_SEPOLIA = "0x50c7d3e7f7c656493D1D76aaa1a836CedfCBB16A";
export declare const SCROLL_CHAINID_MAINNET = 534352n;
export declare const SCROLL_CHAINID_SEPOLIA = 534351n;
export declare const SEPOLIA_CHAINID = 11155111n;
export {};
