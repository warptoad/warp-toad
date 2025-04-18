use dep::std::hash::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};
use constants::{GIGA_TREE_DEPTH};

// trees::merkle::MerkleTree requires a hasher function
fn hasher(leaves: [Field; 2]) -> Field {
    poseidon::bn254::hash_2([leaves[0], leaves[1]])
}

fn main(
    root: pub Field,
    commitment: pub Field,
    index: pub Field,
    merkle_proof: pub [Field; GIGA_TREE_DEPTH],
) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, hasher);
    merkle_tree.membership(commitment, index, merkle_proof);
}

