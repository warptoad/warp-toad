use dep::std::hash::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};

// trees::merkle::MerkleTree requires a hasher function
fn hasher(leaves: [Field; 2]) -> Field {
    poseidon::bn254::hash_2([leaves[0], leaves[1]])
}

fn main(
    // ----- public inputs -----
    chain_id: pub Field,
    amount: pub Field,
    giga_merkle_tree_root: pub Field,
    local_merkle_tree_root: pub Field,
    // if true, then the caller is withdrawing on the same chain as they deposited on and we only check membership
    // on local_merkle_tree_root.  If False, then the caller with withdrawing on a DIFFERENT chain than where they
    // deposited and we only check membership on giga_merkle_tree_root.
    deposited_here: pub bool,
    // ----- private inputs -----
    // TODO: decide on the merkle tree size for the giga tree
    giga_tree_merkle_proof: [Field; 39],
    local_tree_merkle_proof: [Field; 31],
    secret: Field,
    nonce: Field,
    leaf_index: Field,
) {
    // let hashed_secret = poseidon::bn254::hash_1([secret]);
    let nullifier = poseidon::bn254::hash_1([nonce]);
    let precommit = poseidon::bn254::hash_3([nullifier, secret, chain_id]);
    let leaf = poseidon::bn254::hash_2([precommit, amount]);

    if deposited_here {
        let merkle_tree = MerkleTree::from(local_merkle_tree_root, hasher);

        // TODO: test
        merkle_tree.membership(leaf, leaf_index, local_tree_merkle_proof);
    } else {
        let merkle_tree = MerkleTree::from(giga_merkle_tree_root, hasher);

        // TODO: test
        merkle_tree.membership(leaf, leaf_index, giga_tree_merkle_proof);
    }
}
