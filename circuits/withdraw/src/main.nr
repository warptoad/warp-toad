use dep::std::hash::poseidon;

use constants::{
    AZTEC_TREE_DEPTH,
    EVM_TREE_DEPTH,
    GIGA_TREE_DEPTH

};

use merkle_verify::{aztec_merkle_verify, evm_merkle_verify,Aztec_merkle_data,Evm_merkle_data};


//     commitmentHash (hashed onchain on deposit)
//              /                       \
//     pre_commitment_hash          amount (public)
//  (hashed by user, private)
//          |
//     nullifierPreimg, secret, chain_id
fn hash_commitment(nullifier_preimage: Field, secret: Field, chain_id: Field, amount: Field) -> (Field,Field) {
    let computed_nullifier_hash: Field = poseidon::bn254::hash_1([nullifier_preimage]);
    let pre_commitment_hash: Field =  poseidon::bn254::hash_3([nullifier_preimage,secret, chain_id]);
    let commitment: Field = poseidon::bn254::hash_2([pre_commitment_hash,amount]);
    (commitment,computed_nullifier_hash)
}

fn main(
    // ----- public inputs -----
    nullifier: pub Field,
    chain_id: pub Field,
    amount: pub Field,
    giga_root: pub Field,
    destination_local_root: pub Field,

    // ----- private inputs -----
    origin_local_root: Field,
    is_from_aztec: bool,
    nullifier_preimage: Field,
    secret: Field,
    aztec_merkle_data: Aztec_merkle_data<AZTEC_TREE_DEPTH>,
    local_merkle_data: Evm_merkle_data<EVM_TREE_DEPTH>,
    giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
)
{   
    // verify origin_local_root is valid
    if (destination_local_root == origin_local_root) {
        // Is the same as origin_local_root? cool we shouldn't do anything. destination_local_root is a public input so its safe  :)
        // Besides, by not checking, it allows us to use a local_root that has never been used to make a giga_root yet!
    } else {
        // origin_local_root should be in the giga_root!
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
    }

    // verify commitment is part of destination_local_root
    let (commitment, _nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, amount);
    assert(_nullifier == nullifier, "nullifier doesn't match inputs");
    
    // aztecs tree is different from ours because we haven't come around to making a poseidon2 merkle tree in solidity yet.
    // besides poseidon2 might cost more gas? 
    if (is_from_aztec) {
        aztec_merkle_verify(origin_local_root, commitment, aztec_merkle_data)
    } else {
        evm_merkle_verify(origin_local_root, commitment, local_merkle_data);
    }
}