import { ethers } from "ethers";

export type AztecMerkleData = {
    leaf_index: ethers.BytesLike,
    hash_path: ethers.BytesLike[],
    leaf_nonce: ethers.BytesLike,
}


export type EvmMerkleData = {
    leaf_index: ethers.BytesLike,
    hash_path: ethers.BytesLike[],
}

export type ProofInputs = {
    // ----- public inputs -----
    nullifier: ethers.BytesLike,
    chain_id: ethers.BytesLike,
    amount: ethers.BytesLike,
    giga_root: ethers.BytesLike,
    destination_local_root: ethers.BytesLike,

    fee_factor: ethers.BytesLike, 
    priority_fee: ethers.BytesLike,
    max_fee: ethers.BytesLike,
    relayer_address: ethers.BytesLike,                     // eth address left padded zeros / as bigInt
    recipient_address: ethers.BytesLike,                   // eth address left padded zeros

    // ----- private inputs -----
    origin_local_root: ethers.BytesLike,
    is_from_aztec: boolean,
    nullifier_preimage: ethers.BytesLike,
    secret: ethers.BytesLike,
    aztec_merkle_data: AztecMerkleData,
    local_merkle_data: EvmMerkleData,
    giga_merkle_data: EvmMerkleData,
}

export type gasCosts = {
    [key: number]: bigint;
  };