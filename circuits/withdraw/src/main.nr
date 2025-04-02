use dep::std::hash::poseidon;

fn compute_merkle_root() -> Field {
    //TODO:
    0
}

pub fn withdraw(
    chain_id: pub Field,
    amount: pub Field,
    giga_merkle_tree_root: pub Field,
    local_merkle_tree_root: pub Field,
    // if true, then the caller is withdrawing on the same chain as they deposited on and we only check membership
    // on local_merkle_tree_root.  If False, then the caller with withdrawing on a DIFFERENT chain than where they
    // deposited and we only check membership on giga_merkle_tree_root.
    deposited_here: pub bool,
    merkle_proof: [Field; 31],
    // Poseidon(Nullifier, secret, withdraw_chain_id)
    precommit_hash: Field,
    withdraw_amount: Field,
    secret: Field,
    nonce: Field,
    leaf_index: Field,
) {
    // let hashed_secret = poseidon::bn254::hash_1([secret]);
    let nullifier = poseidon::bn254::hash_1([nonce]);
    let precommit = poseidon::bn254::hash_3([nullifier, secret, chain_id]);
    let leaf = poseidon::bn254::hash_2([precommit, amount]);

    if deposited_here {
        // check membership on local_merkle_tree_root
        let computed_merkle_root = compute_merkle_root(
            // leaf, leaf_index, merkle_proof
        );
        assert(
            computed_merkle_root == local_merkle_tree_root,
            "computed local_merkle_tree_root doesn't match local_merkle_tree_root passed in as parameter",
        );
    } else {
        // check membership on giga_merkle_tree_root
        let computed_merkle_root = compute_merkle_root(
            // leaf, leaf_index, merkle_proof
        );
        assert(
            computed_merkle_root == giga_merkle_tree_root,
            "computed giga_merkle_tree_root doesn't match giga_merkle_tree_root passed in as parameter",
        );
    }
}
