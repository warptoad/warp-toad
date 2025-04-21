use dep::std::hash::poseidon2::{Poseidon2};
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};
use constants::{AZTEC_TREE_DEPTH};

// trees::merkle::MerkleTree requires a hasher function
fn hasher(leaves: [Field; 2]) -> Field {
    Poseidon2::hash(leaves,leaves.len())
}

// TODO this is likely not the way to do it
// TODO add hashing of unique_note_hash
fn main(
    root: pub Field,
    commitment: pub Field,
    index: pub Field,
    merkle_proof: pub [Field; AZTEC_TREE_DEPTH],
) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, hasher);
    merkle_tree.membership(commitment, index, merkle_proof);
}

