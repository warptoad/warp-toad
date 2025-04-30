use dep::std::hash::poseidon2::{Poseidon2};
use dep::poseidon::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};

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

//     commitmentHash (hashed onchain on deposit)
//              /                       \
//     pre_commitment_hash          amount (public)
//  (hashed by user, private)
//          |
//     nullifierPreimg, secret, chain_id
pub fn hash_commitment(nullifier_preimage: Field, secret: Field, chain_id: Field, amount: Field) -> (Field,Field) {
    let computed_nullifier_hash: Field = poseidon::bn254::hash_1([nullifier_preimage]);
    let pre_commitment_hash: Field =  poseidon::bn254::hash_3([nullifier_preimage,secret, chain_id]);
    let commitment: Field = poseidon::bn254::hash_2([pre_commitment_hash,amount]);
    (commitment,computed_nullifier_hash)
}

pub fn compute_unique_note_hash(nonce: Field, siloed_note_hash: Field) -> Field {
    std::hash::poseidon2::Poseidon2::hash(
        [GENERATOR_INDEX__UNIQUE_NOTE_HASH as Field,nonce,siloed_note_hash],
        3
    )
}

pub fn compute_siloed_note_hash(contract_address: Field, note_hash: Field) -> Field {
    std::hash::poseidon2::Poseidon2::hash(
        [GENERATOR_INDEX__SILOED_NOTE_HASH as Field,contract_address,note_hash],
        3
    )
    //Poseidon2::hash([contract_address, note_hash,GENERATOR_INDEX__SILOED_NOTE_HASH as Field], 3)
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