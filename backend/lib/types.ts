import type { Hex } from "viem";
//@ts-ignore
import { AztecAddress } from "@aztec/aztec.js";


export type AztecMerkleData = {
    leaf_index: Hex,
    hash_path: Hex[],
    leaf_nonce: Hex,
}


export type EvmMerkleData = {
    leaf_index: Hex,
    hash_path: Hex[],
}

export type ProofInputs = {
    // ----- public inputs -----
    nullifier: Hex,
    chain_id: Hex,
    amount: Hex,
    giga_root: Hex,
    destination_local_root: Hex,
    aztec_warptoad_address: Hex,

    fee_factor: Hex,
    priority_fee: Hex,
    max_fee: Hex,
    relayer_address: Hex,                     // eth address left padded zeros / as bigInt
    recipient_address: Hex,                   // eth address left padded zeros

    // ----- private inputs -----
    origin_local_root: Hex,
    is_from_aztec: boolean,
    nullifier_preimage: Hex,
    secret: Hex,
    aztec_merkle_data: AztecMerkleData,
    evm_merkle_data: EvmMerkleData,
    giga_merkle_data: EvmMerkleData,
}

export type gasCosts = {
    [key: number]: bigint;
  };
