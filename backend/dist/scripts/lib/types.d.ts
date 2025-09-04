import { ethers } from "ethers";
export type AztecMerkleData = {
    leaf_index: ethers.BytesLike;
    hash_path: ethers.BytesLike[];
    leaf_nonce: ethers.BytesLike;
    contract_address: ethers.BytesLike;
};
export type EvmMerkleData = {
    leaf_index: ethers.BytesLike;
    hash_path: ethers.BytesLike[];
};
export type ProofInputs = {
    nullifier: ethers.BytesLike;
    chain_id: ethers.BytesLike;
    amount: ethers.BytesLike;
    giga_root: ethers.BytesLike;
    destination_local_root: ethers.BytesLike;
    fee_factor: ethers.BytesLike;
    priority_fee: ethers.BytesLike;
    max_fee: ethers.BytesLike;
    relayer_address: ethers.BytesLike;
    recipient_address: ethers.BytesLike;
    origin_local_root: ethers.BytesLike;
    is_from_aztec: boolean;
    nullifier_preimage: ethers.BytesLike;
    secret: ethers.BytesLike;
    aztec_merkle_data: AztecMerkleData;
    evm_merkle_data: EvmMerkleData;
    giga_merkle_data: EvmMerkleData;
};
export type gasCosts = {
    [key: number]: bigint;
};
