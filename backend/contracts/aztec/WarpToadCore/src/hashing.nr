use dep::std::hash::poseidon2::{Poseidon2};
use dep::poseidon::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};

use aztec::{
    prelude::{AztecAddress},
    protocol_types::hash::{compute_siloed_note_hash, compute_unique_note_hash},
    protocol_types::traits::{FromField, Serialize}
};

// same as the one from circuit/hashing but with serialize implemented
// couldn't do it in the same file. I think because circuit is compiled in a older nargo version :/
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
    contract_address: Field,
}

impl<let D: u32> Serialize<D + 3> for Aztec_merkle_data<D> {
    fn serialize(self) -> [Field; D + 3] {
        let mut out: [Field; D + 3] = [0; D + 3];
        out[0] = self.leaf_index;
        for i in 0..D {
            out[1 + i] = self.hash_path[i];
        }
        out[D + 1] = self.leaf_nonce;
        out[D + 2] = self.contract_address;
        out
    }
}

pub struct Evm_merkle_data<let D: u32> {
    leaf_index: Field,
    hash_path: [Field; D],
}
impl<let D: u32> Serialize<D + 1> for Evm_merkle_data<D> {
    fn serialize(self) -> [Field; D + 1] {
        let mut out: [Field; D + 1] = [0; D + 1];
        out[0] = self.leaf_index;
        for i in 0..D {
            out[1 + i] = self.hash_path[i];
        }
        out
    }
}

pub fn aztec_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Aztec_merkle_data<D>,
) {
    let siloed_note_hash =
        compute_siloed_note_hash(AztecAddress::from_field(merkle_data.contract_address), leaf);
    let unique_note_hash = compute_unique_note_hash(merkle_data.leaf_nonce, siloed_note_hash);
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon2_hasher);
    merkle_tree.membership(unique_note_hash, merkle_data.leaf_index, merkle_data.hash_path);

    // let computed_root = root_from_sibling_path(unique_note_hash, merkle_data.leaf_index, merkle_data.hash_path);
    // assert(computed_root == root, "aztec root doesn't matched the one hashed from proof");
}

pub fn evm_merkle_verify<let D: u32>(root: Field, leaf: Field, merkle_data: Evm_merkle_data<D>) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon_hasher);
    merkle_tree.membership(leaf, merkle_data.leaf_index, merkle_data.hash_path);
}
