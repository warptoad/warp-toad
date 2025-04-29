use dep::std::hash::poseidon2::{Poseidon2};
// ignore the errors around poseidon. 1.0.0-beta.4 doesn't have poseidon in the std but we use 1.0.0-beta.3
// but aztec-nargo IS on 1.0.0-beta.4
// use dep::std::hash::{poseidon};
use dep::poseidon::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};
// use aztec::protocol_types::hash::{compute_siloed_note_hash, compute_unique_note_hash};
//     use aztec::prelude::{
//         AztecAddress,
//         AztecAddress::from_field,
//         };
// use aztec::protocol_types::{
//     merkle_tree::root::root_from_sibling_path,
// };
// trees::merkle::MerkleTree requires a hasher function
fn poseidon2_hasher(leaves: [Field; 2]) -> Field {
    Poseidon2::hash(leaves,leaves.len())
}

fn poseidon_hasher(leaves: [Field; 2]) -> Field {
    poseidon::bn254::hash_2([leaves[0], leaves[1]])
}


// TODO import it instead when nargo beta.4 is more stable
pub global GENERATOR_INDEX__UNIQUE_NOTE_HASH: u32 = 3;
pub global GENERATOR_INDEX__SILOED_NOTE_HASH: u32 = 4;


pub fn array_concat<T, let N: u32, let M: u32>(array1: [T; N], array2: [T; M]) -> [T; N + M] {
    let mut result = [array1[0]; N + M];
    for i in 1..N {
        result[i] = array1[i];
    }
    for i in 0..M {
        result[i + N] = array2[i];
    }
    result
}


pub fn poseidon2_hash(data: [Field; 3]) -> Field {
        std::hash::poseidon2::Poseidon2::hash(data, data.len())
        }

pub fn poseidon2_hash_with_separator(inputs: [Field; 2], separator: u32) -> Field
{
    let inputs_with_separator: [Field; 3] = array_concat([separator as Field], inputs);
    poseidon2_hash(inputs_with_separator)
}


pub fn compute_unique_note_hash(nonce: Field, siloed_note_hash: Field) -> Field {
    let inputs = [nonce, siloed_note_hash];
     poseidon2_hash_with_separator(
        inputs,
        GENERATOR_INDEX__UNIQUE_NOTE_HASH,
    )
    //Poseidon2::hash([nonce,siloed_note_hash,  GENERATOR_INDEX__UNIQUE_NOTE_HASH as Field], 3)
}

pub fn compute_siloed_note_hash(contract_address: Field, note_hash: Field) -> Field {
    poseidon2_hash_with_separator(
        [contract_address, note_hash],
        GENERATOR_INDEX__SILOED_NOTE_HASH,
    )
    //Poseidon2::hash([contract_address, note_hash,GENERATOR_INDEX__SILOED_NOTE_HASH as Field], 3)
}

pub fn root_from_sibling_path<let N: u32>(
    leaf: Field,
    leaf_index: Field,
    sibling_path: [Field; N],
) -> Field {
    let mut node = leaf;
    let indices: [u1; N] = leaf_index.to_le_bits();

    for i in 0..N {
        let (hash_left, hash_right) = if indices[i] == 1 {
            (sibling_path[i], node)
        } else {
            (node, sibling_path[i])
        };
        node = std::hash::poseidon2::Poseidon2::hash([hash_left, hash_right], 2);
    }
    node
}

pub struct Aztec_merkle_data<let D: u32> {
    leaf_index: Field,
    hash_path: [Field; D],
    leaf_nonce: Field,
    contract_address: Field,
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

    // let computed_root = root_from_sibling_path(unique_note_hash, merkle_data.leaf_index, merkle_data.hash_path);
    // assert(computed_root == root, "aztec root doesn't matched the one hashed from proof");
}

pub fn evm_merkle_verify<let D: u32>(
    root: Field,
    leaf: Field,
    merkle_data: Evm_merkle_data<D>
) {
    let merkle_tree: MerkleTree<Field> = MerkleTree::from(root, poseidon_hasher);
    merkle_tree.membership(leaf, merkle_data.leaf_index, merkle_data.hash_path);
}

