use dep::std::hash::poseidon2::{Poseidon2};
use dep::std::hash::{poseidon};
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};

// trees::merkle::MerkleTree requires a hasher function
fn poseidon2_hasher(leaves: [Field; 2]) -> Field {
    Poseidon2::hash(leaves,leaves.len())
}

fn poseidon_hasher(leaves: [Field; 2]) -> Field {
    poseidon::bn254::hash_2([leaves[0], leaves[1]])
}

pub struct Aztec_merkle_data<let D: u32> {
    leaf_index: Field,
    hash_path: [Field; D],
    leaf_nonce: Field,
    burn_tx_first_nullifier: Field,
    note_index_in_tx: u32
}

pub struct Evm_merkle_data<let D: u32> {
    leaf_index: Field,
    hash_path: [Field; D],
}

// TODO this is likely not the way to do it
// TODO add hashing of unique_note_hash
pub fn aztec_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Aztec_merkle_data<D>,
) {
    // TODO unique note hash 
    // merkle_data.burn_tx_first_nullifier
    // merkle_data.note_index_in_tx
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon2_hasher);
    merkle_tree.membership(leaf, merkle_data.leaf_index, merkle_data.hash_path);
}

pub fn evm_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Evm_merkle_data<D>
) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon_hasher);
    merkle_tree.membership(leaf, merkle_data.leaf_index, merkle_data.hash_path);
}

