use aztec::macros::aztec;

// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr

#[aztec]
pub contract WarpToadCore {
    use dep::easy_private_state::EasyPrivateUint;
    use aztec::macros::{functions::{initializer, private, public, view}, storage::storage};
    use aztec::prelude::{AztecAddress, Map, PublicImmutable, PublicMutable};
    // use std::hash::poseidon;
    use dep::value_note::balance_utils;
    // use aztec::oracle::get_membership_witness::{
    //     get_note_hash_membership_witness, MembershipWitness,
    // };
    // use aztec::protocol_types::constants::{ARCHIVE_HEIGHT, NOTE_HASH_TREE_HEIGHT};

    #[storage]
    struct Storage<Context> {
        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[private]
    fn constructor(initial_supply: u64, owner: AztecAddress) {
        let balances = storage.balances;

        balances.at(owner).add(initial_supply, owner, context.msg_sender());
    }
    
    // #[private]
    // fn mint(amount: u64, owner: AztecAddress) {
    //     let balances = storage.balances;

    //     balances.at(owner).add(amount, owner, context.msg_sender());
    // }

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    #[private]
    fn transfer(amount: u64, sender: AztecAddress, recipient: AztecAddress) {
        let balances = storage.balances;

        balances.at(sender).sub(amount, sender, sender);
        balances.at(recipient).add(amount, recipient, sender);
    }

    // Helper function to get the balance of a user.
    // #[utility] //not in this version??
    unconstrained fn get_balance(owner: AztecAddress) -> pub Field {
        let balances = storage.balances;

        // Return the sum of all notes in the set.
        balance_utils::get_balance(balances.at(owner).set)
    }
    // #[view]
    // unconstrained fn get_note_proof(
    //     block_number: u32,
    //     note_hash: Field,
    // ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
    //     get_note_hash_membership_witness(block_number, note_hash)
    // }

}
