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

    // fee_factor is what the contract multiplies by the (baseFee+priorityFee) and pays that to relayer. 
    // So calculating it would be fee_factor = gasCost * wrptdTOKENPriceWei * relayerBonusFactor
    // relayerBonusFactor eg: 1.10 <= relayer earns 10% on top of the gas fees
    
    fee_factor: pub Field, 
    priority_fee: pub Field,
    max_fee: pub Field,
    relayer_address: pub Field,                     // eth address left padded zeros
    recipient_address: pub Field,                   // eth address left padded zeros

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
    // there is no syntax for amount >= max_fee. Thats why it looks weird
    assert(!amount.lt(max_fee), "max_fee higher than amount");
    
    // idk if we need to do this but its stops the compiler warnings
    assert(fee_factor != 1, "fee factor cant be 1"); // we use 0 to detect if user doesn't want to pay the relayer
    assert(relayer_address != 0, "relayer_address cant be 0");
    assert(recipient_address != 0, "recipient_address cant be 0");
    assert(priority_fee != 0, "priority_fee cant be 0");

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