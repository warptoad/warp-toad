use dep::std::hash::poseidon;
use trees::{merkle::{MembershipProver, MerkleTree}, types::MT_Creator};

global AZTEC_TREE_DEPTH:u32 = 32; //TODO check maybe get from import?
global EVM_TREE_DEPTH: u32 = 32;
global EVM_TREE_MAX_LEAVES: Field = 2.pow_32(EVM_TREE_DEPTH as Field);
global GIGA_TREE_DEPTH: u32 = 5;

// trees::merkle::MerkleTree requires a hasher function
fn hasher(leaves: [Field; 2]) -> Field {
    poseidon::bn254::hash_2([leaves[0], leaves[1]])
}


//     commitmentHash (hashed onchain on deposit)
//              /                       \
//     pre_commitment_hash          amount (public)
//  (hashed by user, private)
//          |
//     nullifierPerimg, secret, chain_id
fn commitment_hasher(nullifier_preimage: Field, secret: Field, chain_id: Field, amount: Field) -> (Field,Field) {
    let computed_nullifier_hash: Field = poseidon::bn254::hash_1([nullifier_preimage]);
    let pre_commitment_hash: Field =  poseidon::bn254::hash_3([nullifier_preimage,secret, chain_id]);
    let commitment: Field = poseidon::bn254::hash_2([pre_commitment_hash,amount]);
    (commitment,computed_nullifier_hash)
}

unconstrained fn calc_giga_leaf_index(deposit_chain_root_index:Field, local_leaf_index: Field) -> Field {
    EVM_TREE_MAX_LEAVES * deposit_chain_root_index + local_leaf_index
}


unconstrained fn slice_array<let N: u32,let L: u32>(array:[Field;N]) -> [Field;L] {
    let mut new_array:[Field;L]= [0;L];
    for index in 0 .. L {
        new_array[index] = array[index];
    }
    new_array
}

fn main(
    // ----- public inputs -----
    nullifier: pub Field,
    chain_id: pub Field,
    amount: pub Field,
    giga_merkle_tree_root: pub Field,
    local_merkle_tree_root: pub Field,
    // if true, then the caller is withdrawing on the same chain as they deposited on and we only check membership
    // on local_merkle_tree_root.  If False, then the caller with withdrawing on a DIFFERENT chain than where they
    // deposited and we only check membership on giga_merkle_tree_root.
    deposited_here: bool,
    // ----- private inputs -----
    // TODO: decide on the merkle tree size for the giga tree
    nullifier_preimage: Field,
    secret: Field,
    local_leaf_index: Field,
    deposit_chain_root_index: Field,
    merkle_proof: [Field; EVM_TREE_DEPTH+GIGA_TREE_DEPTH], //TODO this assumes AZTEC tree is smaller
)
{
    // TODO do recursive verification instead with 3 different circuits: EVM-leaf-to-gigaRoot, EVM-leaf-to-local-root, AZTEC
    // doing it not recursive means proof time is 3x as long :/
    // NOTE:   EVM-leaf-to-gigaRoot giga_leaf_index = (2**EVM_tree_depth) * deposit_chain_root_index + leaf_index
    let (commitment, hashed_nullifier) = commitment_hasher(nullifier_preimage, secret, chain_id, amount);
    assert(hashed_nullifier == nullifier, "hashed_nullifier doesn't match the nullifier pub input");

    if deposited_here {
        let merkle_tree: MerkleTree<Field> = MerkleTree::from(local_merkle_tree_root, hasher);
        // Safety: it's safe getting anything else then the right merkle proof wont make a proof anyway
        let local_merkle_proof: [Field;EVM_TREE_DEPTH] = unsafe {
            slice_array(merkle_proof)
        };

        // TODO: test
        merkle_tree.membership(commitment, local_leaf_index, local_merkle_proof);
    } else {
        let merkle_tree: MerkleTree<Field> = MerkleTree::from(giga_merkle_tree_root, hasher);

        // TODO do this in js instead because its cleaner
        // Safety: it's safe getting anything else then the right index wont make a valid merkle proof anyway
        let giga_leaf_index:Field = unsafe {
            calc_giga_leaf_index(deposit_chain_root_index, local_leaf_index)
        };
        merkle_tree.membership(commitment, giga_leaf_index, merkle_proof);
    }
}


#[test]
fn test() {
    println(EVM_TREE_MAX_LEAVES)
}