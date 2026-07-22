import { ProofInputs, EvmMerkleData, AztecMerkleData, gasCosts } from "./types";
import { toHex } from "viem";
import { AztecScanChainNames } from "./types.js";
// @ts-ignore
export const AZTEC_TREE_DEPTH = 42;
export const EVM_TREE_DEPTH = 32;
export const EVM_TREE_MAX_LEAVES = 2 ** EVM_TREE_DEPTH;
export const GIGA_TREE_DEPTH = 5;
export const WARPTOAD_DEPLOYMENT_BLOCK_L1 = 11130522;    // v5.0.0-rc.1 redeploy (Sepolia); was 9035512 (pre-v5)
export const WARPTOAD_DEPLOYMENT_BLOCK_AZTEC = 43560;   // https://aztecscan.xyz/contracts/instances/0x06216f30183f2ab424eb87b296588e0404ce13b837c09d7e5db94d7a846a260f
export const WARPTOAD_DEPLOYMENT_BLOCK_SCROLL = 11722287;      // https://sepolia.scrollscan.com/tx/0x4a034dfa8546dedbbad281e12f53bea10c5f6efbc8ef7bcbd92ef2ecefe46c35



interface DeploymentBlockData {
    [contractName: string]: { [chainId: string]: number };
}

export const DEPLOYMENT_BLOCK_PER_CHAINID:DeploymentBlockData = {
    WARPTOAD: {
        11155111: 11130522,    // v5.0.0-rc.1 redeploy (Sepolia); was 9035512 (pre-v5)
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

// --- ZK Stack (Elastic Chain) ------------------------------------------------------
// Every ZK Stack chain settling to a given L1 shares ONE Bridgehub, so a single L1
// address covers all of them and only the l2ChainId differs. Verified on-chain
// 2026-07-20: Era Sepolia (300) and Abstract testnet (11124) both register in the
// Sepolia Bridgehub, both run protocol v29, and both report settlementLayer() ==
// 11155111 (direct L1 settlement, no Gateway). Same on mainnet: Era (324) and Abstract
// (2741) both register in the mainnet Bridgehub with settlementLayer() == 1.
export const ZK_STACK_BRIDGEHUB_SEPOLIA = "0x35A54c8C757806eB6820629bc82d90E056394C92"
export const ZK_STACK_BRIDGEHUB_MAINNET = "0x303a465B659cBB0ab36eE643eA362c509EEb5213"

// The L1Messenger system contract, identical on every ZK Stack chain.
export const ZK_STACK_L2_MESSENGER = "0x0000000000000000000000000000000000008008"

// l2GasPerPubdataByteLimit, fixed by the protocol for ETH-based chains.
export const ZK_STACK_GAS_PER_PUBDATA = 800n

export const ZKSYNC_ERA_CHAINID_MAINNET = 324n
export const ZKSYNC_ERA_CHAINID_SEPOLIA = 300n
export const ABSTRACT_CHAINID_MAINNET = 2741n
export const ABSTRACT_CHAINID_TESTNET = 11124n

/**
 * How many L1ZkStackBridgeAdapter instances GigaBridge registers as recipients.
 *
 * This number is PERMANENT for a given deployment. GigaBridge assigns recipient
 * indexes in its constructor and exposes no setter, and its address is baked into the
 * one-shot initialize() of L1WarpToad and every adapter. Adding a recipient afterwards
 * therefore means redeploying GigaBridge, L1WarpToad and all adapters, then re-wiring
 * Aztec and every L2.
 *
 * So we deploy spares. Instances are byte identical until initialized (the constructor
 * takes only the Bridgehub), which means an unclaimed slot can later be pointed at ANY
 * ZK Stack chain on the same Bridgehub with a single initialize() call.
 *
 * The giga tree is depth GIGA_TREE_DEPTH = 5, i.e. 32 leaf slots total, and recipients
 * here are on top of L1WarpToad + L1AztecBridgeAdapter.
 *
 * CAUTION: an unclaimed slot reverts on getLocalRootAndBlock(). Never pass the full
 * recipient list to GigaBridge.updateGigaRoot() blindly; pass claimed slots only.
 */
export const ZK_STACK_ADAPTER_SLOTS = 4

/**
 * Which ZK Stack chain occupies which adapter slot. Slot index is positional and
 * permanent; append to claim a spare, never reorder.
 */
export const ZK_STACK_CHAINS: readonly { slot: number; name: string; chainId: bigint }[] = [
    { slot: 0, name: "zkSyncEraSepolia", chainId: ZKSYNC_ERA_CHAINID_SEPOLIA },
]

export const AZTEC_SCAN_CHAIN_NAMES = ["devnet", "testnet", "mainnet"] as const
export const AZTEC_SCAN_CHAINS: Record<AztecScanChainNames, { l1ChainId: bigint }> = {
    "devnet": { l1ChainId: 11155111n },
    "testnet": { l1ChainId: 11155111n },
    "mainnet": { l1ChainId: 1n }
}