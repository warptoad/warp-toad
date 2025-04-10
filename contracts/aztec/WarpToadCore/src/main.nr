use aztec::macros::aztec;
mod types;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr

#[aztec]
pub contract WarpToadCore {
    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;
    use aztec::macros::{functions::{initializer, private, public, view}, storage::storage};
    use aztec::oracle::get_membership_witness::{
        get_note_hash_membership_witness, MembershipWitness,
    };

    use aztec::prelude::{AztecAddress, EthAddress, Map, PublicImmutable, PublicMutable,PrivateSet};
    use aztec::protocol_types::constants::NOTE_HASH_TREE_HEIGHT;
    use std::hash::poseidon;

    use aztec::history::public_storage::PublicStorageHistoricalRead;
    use aztec::history::note_inclusion::{ProveNoteInclusion};

    use dep::aztec::{macros::notes::{ note}};
    use dep::protocol_types::merkle_tree::root::root_from_sibling_path;
    use dep::protocol_types::hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash};



    // use crate::types::WarpToadNote::{WarpToadNote};
    
    // arbitrary number because noir didn't like it when i returned a slice at get_all_giga_roots
    global max_history_size: u32 = 4096;

    #[storage]
    struct Storage<Context> {

        giga_root: PublicMutable<Field, Context>,
        giga_root_history: Map<u32, PublicMutable<Field, Context>, Context>,
        giga_root_history_size: PublicImmutable<u32, Context>,
        giga_root_history_index: PublicMutable<u32, Context>,

        L1_contract: PublicMutable<EthAddress, Context>,

        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
        
        // commitments: PrivateSet<WarpToadNote, Context>
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[public]
    fn constructor(giga_root_history_size: u32) {
        // TODO cleanup
        assert(max_history_size > giga_root_history_size, "wow too big!");
        storage.giga_root_history_size.initialize(giga_root_history_size);
    }

    // @TODO @WARNING remove this in prod!!
    #[private]
    fn mint_for_testing(amount: u64, recipient: AztecAddress) {
        storage.balances.at(recipient).add(amount, recipient, context.msg_sender());
    }

    #[public]
    fn receive_giga_root(giga_root: Field) {
        // TODO make only the bridge able to use this function. And also make sure the contract that send the bridge transfer is L1_contract
        storage.giga_root.write(giga_root);
        let current_index: u32 = storage.giga_root_history_index.read();
        storage.giga_root_history.at(current_index).write(giga_root);

        let next_index: u32 = (current_index + 1) % storage.giga_root_history_size.read();
        storage.giga_root_history_index.write(next_index);
    }

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    #[private]
    fn transfer(amount: u64, sender: AztecAddress, recipient: AztecAddress) {
        let balances = storage.balances;

        balances.at(sender).sub(amount, sender, sender);
        balances.at(recipient).add(amount, recipient, sender);
    }

    // we can split up mint types based on where the burn happened to make users staying on aztec have faster proof time.
    // you can only do this on aztec because on aztec everything is private. So others don't see what function you called!!! :D
    #[private]
    fn mint_giga_root(amount: u64) {
        let chain_id = context.chain_id();

        let giga_root_slot: Field =
            aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root);
        let contract_address = context.this_address();
        let giga_root = context.historical_header.public_storage_historical_read(
            giga_root_slot,
            contract_address,
        );

        // TODO check if commitment (from the other chain) is in that root
    }


    #[private]
    fn hash_commit(
        amount: u64,
        destination_chain_id: Field,
        secret: Field,
        nullifier_preimg: Field,
    ) -> Field {
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        commitment
    }



    #[private]
    fn hash_siloed_commit(
        amount: u64,
        destination_chain_id: Field,
        secret: Field,
        nullifier_preimg: Field,
        burn_tx_nullifier: Field,
        note_index_in_tx: u32,
    ) -> Field {
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        let siloed_note_hash = compute_siloed_note_hash(context.this_address(), commitment);
        let nonce = compute_note_hash_nonce(burn_tx_nullifier,note_index_in_tx);
        let unique_note_hash = compute_unique_note_hash(nonce,siloed_note_hash);
        unique_note_hash
    }

    // TODO this is not safe. if sender reveals their viewing keys others can spend their token(they should only be able to see them!)
    // Look at the token contract example for how to do that 
    // https://discord.com/channels/1144692727120937080/1359842526915203096
    #[private]
    fn burn(
        amount: u64,
        destination_chain_id: Field,
        secret: Field,
        nullifier_preimg: Field,
        sender: AztecAddress,
    ) {
        // TODO someone 
        storage.balances.at(sender).sub(amount, sender, sender);

        // add the commitment
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        context.push_note_hash(commitment); // TODO this doesnt actually put it in the fucking tree???
    }

    #[private]
    fn mint_local(
        amount: u64,
        destination_chain_id: Field,
        secret: Field,
        nullifier_preimg: Field,
        recipient: AztecAddress,
        block_number: u32,
        burn_tx_first_nullifier: Field, // any nullifier that is in the same tx as ur commitment. Also nullifiers that come from some other contract if you aggregate txs together :/
        note_index_in_tx: u32,
    ) {
        let chain_id: Field = context.chain_id();
        assert(destination_chain_id == chain_id, "not here bro");
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        let nullifier: Field = poseidon::bn254::hash_1([nullifier_preimg]);
        let block_header = context.get_block_header_at(block_number);
        

        let siloed_note_hash = compute_siloed_note_hash(context.this_address(), commitment);
        
        let nonce = compute_note_hash_nonce(burn_tx_first_nullifier,note_index_in_tx);

        let unique_note_hash = compute_unique_note_hash(nonce,siloed_note_hash);
        let note_hash = unique_note_hash;
        // let note_hash = unique_note_hash;

        let witness: MembershipWitness<40, 41> = unsafe {
            get_note_hash_membership_witness(block_number, note_hash)
        };

        assert_eq(
            block_header.state.partial.note_hash_tree.root,
            root_from_sibling_path(note_hash, witness.index, witness.path),
            "Proving note inclusion failed",
        );
        
        // TODO pushing the same nullifier twice is impossible right??
        context.push_nullifier(nullifier);
        // mint!
        storage.balances.at(recipient).add(amount, recipient, recipient);
    }

    // Helper function to get the balance of a user.
    // #[utility] //not in this version??
    unconstrained fn get_balance(owner: AztecAddress) -> pub Field {
        balance_utils::get_balance(storage.balances.at(owner).set)
    }

    // #[utility] //not in this version??
    unconstrained fn get_giga_root() -> pub Field {
        storage.giga_root.read()
    }

    unconstrained fn get_all_giga_roots() -> pub [Field; max_history_size] {
        let mut all_roots: [Field; max_history_size] = [0;max_history_size];
        let amount_of_roots = storage.giga_root_history_size.read();
        for i in 0..amount_of_roots {
            let root: Field = storage.giga_root_history.at(i).read();
            all_roots[i] = root;
        }
        all_roots
    }

    // fuck this this shit is gay we can just pick a block number instead of keeping a whole ass array of historical giga_roots
    #[private]
    fn get_historical_giga_root() -> pub Field {
        let giga_root_slot: Field = aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root);
        let contract_address = context.this_address();
        let giga_root = context.historical_header.public_storage_historical_read(giga_root_slot,contract_address);
        giga_root
    }

        #[private]
    fn get_historical_giga_root_by_index(index: u32) -> pub Field {
        let giga_root_slot: Field = aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root_history.at(index));
        let contract_address = context.this_address();
        let giga_root = context.historical_header.public_storage_historical_read(giga_root_slot,contract_address);
        giga_root
    }

    // i think this allows us to do a eth_getProof like thing for a commitment. Kinda cringe that i cant just call a api in js like on ethereum? Maybe you can?
    #[view]
    unconstrained fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
        get_note_hash_membership_witness(block_number, note_hash)
    }

    #[view]
    unconstrained fn get_chain_id() -> pub Field {
        context.chain_id()
    }
}
