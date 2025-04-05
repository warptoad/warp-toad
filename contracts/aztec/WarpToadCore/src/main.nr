use aztec::macros::aztec;

// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3


#[aztec]
pub contract WarpToadCore {
    use std::hash::poseidon;
    use aztec::macros::{functions::{initializer, public}, storage::storage}; 
    use aztec::prelude::{PublicMutable,PublicImmutable, Map}; 
    //use trees::merkle::MerkleTree::{calculate_two_roots};
    // use trees::merkle::{MerkleTree};
    // use trees::types::{Calculator, MembershipProver, Modifier, MT_Creator};
    //  use aztec::protocol_types::traits::{FromField, ToField}; // utils

    // pub struct MerkleTree<T> {
    //     pub root: T,
    //     pub hasher: fn([T; 2]) -> T,
    // }

    #[storage]
    struct Storage<Context> {
        maxTreeDepth: PublicImmutable<u32, Context>,
    
        localRoot: PublicMutable<Field, Context>,
        lastLeafIndex: PublicMutable<u128, Context>,

        leaves: Map<Field, PublicMutable<Field, Context>, Context>,             // mapping(index -> hash)          
        lastSubtrees:  Map<u32, PublicMutable<Field, Context>, Context>,        // mapping(index -> subTreeHash)  

        zeroes:   Map<u32, PublicMutable<Field, Context>, Context>,    
    }

    // constructor bassically
    #[initializer]
    #[public]
    // We can name our initializer anything we want as long as it's marked as aztec(initializer)
    fn initialize(_maxTreeDepth: u32) {
        storage.maxTreeDepth.initialize(_maxTreeDepth);
        storage.lastLeafIndex.write(0); // idk if you need to do this
    }   

    unconstrained fn get_root() -> pub Field {
        let localRoot = storage.localRoot;
        localRoot.read()
    }



    // we need to push the commitments to aztecs own commitment tree.
    // we're at the gas limit at depth 4. absolute cringe!
    // so we dont have to fuck with enque to public which leaks information
    // also saves on cost vs making incontract merkle tree
    // L1 contract would just get the aztec commitment root somehow and treat that as a localRoot
    #[public] //@TODO make sure only this contract can call this
    fn _insertLeaf(_leaf: Field) {
        // based of: https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/309b8d8d7d4f553ef44e3aa672040a3698e5179c/packages/imt/contracts/InternalBinaryIMT.sol#L142
        let depth: u32 = storage.maxTreeDepth.read();

        let mut index:u128 = storage.lastLeafIndex.read();
        storage.lastLeafIndex.write(index+1);
        storage.leaves.at(index as Field).write(_leaf);

        let mut hash: Field = _leaf;  

        for i in 0..depth {
            if(index%2==0) {
                hash = poseidon::bn254::hash_2([hash, storage.zeroes.at(i).read()]);
                storage.lastSubtrees.at(i).write(hash)
            } else {
                hash = poseidon::bn254::hash_2([storage.lastSubtrees.at(i).read(), hash]);
            }
            index /= 2; 
        };

        storage.localRoot.write(hash);
    }


}
