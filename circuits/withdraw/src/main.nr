use dep::std::hash::poseidon;

global HONK_VK_SIZE: u32 = 128;
global HONK_PROOF_SIZE: u32 = 456;
global HONK_IDENTIFIER: u32 = 1;


//vk;
use constants::{
    EVMMERKLEVERIFY_VK,EVMMERKLEVERIFY_VK_HASH,EVMMERKLEVERIFY_PROOF_LEN,
    GIGATREEMERKLEVERIFY_VK,GIGATREEMERKLEVERIFY_VK_HASH, GIGATREEMERKLEVERIFY_PROOF_LEN,
    AZTECMERKLEVERIFY_VK,AZTECMERKLEVERIFY_VK_HASH,AZTECMERKLEVERIFY_PROOF_LEN
};


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

// unconstrained fn calc_giga_leaf_index(deposit_chain_root_index:Field, local_leaf_index: Field) -> Field {
//     EVM_TREE_MAX_LEAVES * deposit_chain_root_index + local_leaf_index
// }


// unconstrained fn slice_array<let N: u32,let L: u32>(array:[Field;N]) -> [Field;L] {
//     let mut new_array:[Field;L]= [0;L];
//     for index in 0 .. L {
//         new_array[index] = array[index];
//     }
//     new_array
// }

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
    giga_proof: [Field; HONK_PROOF_SIZE],
    local_proof: [Field; HONK_PROOF_SIZE],
    aztec_proof: [Field; HONK_PROOF_SIZE],
    evm_merkle_vk: [Field; HONK_VK_SIZE],
    giga_merkle_vk: [Field; HONK_VK_SIZE],
    aztec_merkle_vk: [Field; HONK_VK_SIZE],
)
{   
    // verify origin_local_root is valid
    if (destination_local_root == origin_local_root) {
        // Is the same as origin_local_root? cool no need to do anything :)
        // destination_local_root <= what contracts gives us. So we can trust everything is fine
    } else {
        let giga_tree_pub_inputs = [giga_root, origin_local_root, 0 ,0,0,0,0,0];
        std::verify_proof_with_type(
            giga_merkle_vk, 
            giga_proof, 
            giga_tree_pub_inputs, 
            GIGATREEMERKLEVERIFY_VK_HASH,
            HONK_IDENTIFIER
        );
    }

    // verify commitment is part of destination_local_root
    let (commitment, _nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, amount);
    assert(_nullifier == nullifier, "nullifier doesn't match inputs");
    
    if (is_from_aztec) {
        let aztec_tree_pub_inputs = [origin_local_root, commitment, 0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ];
        std::verify_proof_with_type(
            aztec_merkle_vk, 
            aztec_proof, 
            aztec_tree_pub_inputs, 
            AZTECMERKLEVERIFY_VK_HASH,
            HONK_IDENTIFIER
        );
    } else {
        let local_tree_pub_inputs = [origin_local_root, commitment, 0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ];
        std::verify_proof_with_type(
            evm_merkle_vk, 
            local_proof, 
            local_tree_pub_inputs, 
            EVMMERKLEVERIFY_VK_HASH,
            HONK_IDENTIFIER
        );
    }
}