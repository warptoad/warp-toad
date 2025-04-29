use dep::std::hash::poseidon2::{Poseidon2};
// ignore the errors around poseidon. 1.0.0-beta.4 doesn't have poseidon in the std but we use 1.0.0-beta.3
// but aztec-nargo IS on 1.0.0-beta.4
// use dep::std::hash::{poseidon};
use dep::poseidon::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};
use aztec::protocol_types::hash::{compute_siloed_note_hash, compute_unique_note_hash};
    use aztec::prelude::{
        AztecAddress};
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
    contract_address: AztecAddress,
}

pub struct Evm_merkle_data<let D: u32> {
    leaf_index: Field,
    hash_path: [Field; D],
}

pub fn aztec_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Aztec_merkle_data<D>,
) {
    let siloed_note_hash = compute_siloed_note_hash(merkle_data.contract_address, leaf);
    let unique_note_hash = compute_unique_note_hash(merkle_data.leaf_nonce, siloed_note_hash);
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon2_hasher);
    merkle_tree.membership(unique_note_hash, merkle_data.leaf_index, merkle_data.hash_path);
}

pub fn evm_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Evm_merkle_data<D>
) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon_hasher);
    merkle_tree.membership(leaf, merkle_data.leaf_index, merkle_data.hash_path);
}

