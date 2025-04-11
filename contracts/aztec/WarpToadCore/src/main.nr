use aztec::macros::aztec;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr

#[aztec]
pub contract WarpToadCore {
    // macros
    use aztec::macros::{notes::note, functions::{initializer, private, public, view, internal}, storage::{storage}};
    
    // storage types
    use aztec::prelude::{AztecAddress, EthAddress, Map, PublicImmutable, PublicMutable};
    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;

    // note proving
    use aztec::oracle::get_membership_witness::{
        get_note_hash_membership_witness, MembershipWitness,
    };
    use aztec::protocol_types::{
        merkle_tree::root::root_from_sibling_path, 
        constants::NOTE_HASH_TREE_HEIGHT,
        hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash}
        };
    use std::hash::poseidon;

    // archive tree proving
    use aztec::history::public_storage::PublicStorageHistoricalRead;
    use protocol_types::{block_header::BlockHeader, transaction::tx_context::TxContext};

    // arbitrary number because noir didn't like it when i returned a slice at get_all_giga_roots
    global max_history_size: u32 = 4096;

    #[storage]
    struct Storage<Context> {

        giga_root: PublicMutable<Field, Context>,
        giga_root_history: Map<u32, PublicMutable<Field, Context>, Context>,
        giga_root_history_size: PublicImmutable<u32, Context>,
        giga_root_history_index: PublicMutable<u32, Context>,

        L1_contract: PublicImmutable<EthAddress, Context>,

        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[public]
    fn constructor(giga_root_history_size: u32, L1_contract: EthAddress) {
        // TODO cleanup
        assert(max_history_size > giga_root_history_size, "wow too big!");
        storage.giga_root_history_size.initialize(giga_root_history_size);
        storage.L1_contract.initialize(L1_contract);
    }

    // @TODO @WARNING remove this in prod!! Do minting from giga root instead
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
        storage.balances.at(sender).sub(amount, sender, sender);
        storage.balances.at(recipient).add(amount, recipient, sender);
    }

    // we can split up mint types based on where the burn happened to make users staying on aztec have faster proof time.
    // you can only do this on aztec because on aztec everything is private. So others don't see what function you called!!! :D
    #[private]
    fn mint_giga_root(amount: u64) {
        let chain_id: Field = context.chain_id();

        let giga_root_slot: Field =
            aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root);
        let contract_address = context.this_address();
        let giga_root = context.historical_header.public_storage_historical_read(
            giga_root_slot,
            contract_address,
        );

        // TODO check if commitment (from the other chain) is in that root
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
        storage.balances.at(sender).sub(amount, sender, sender);

        // add the commitment
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        context.push_note_hash(commitment); // TODO this doesnt actually put it in the fucking tree???
    }

    // TODO long term we need js equivalent for performance and cleaner code but we need poseidon2 in js for that
    #[view]
    fn hash_unique_note_hash(
        contract_address: AztecAddress,
        note_hash: Field,
        first_nullifier_in_tx: Field,
        unique_note_hash_index_in_tx: u32,
    ) -> pub Field {
        let siloed_note_hash = compute_siloed_note_hash(contract_address, note_hash);
        let nonce = compute_note_hash_nonce(first_nullifier_in_tx,unique_note_hash_index_in_tx);
        let unique_note_hash = compute_unique_note_hash(nonce,siloed_note_hash);
        unique_note_hash
    }

    //TODO long term we need js equivalent for performance and cleaner code but we need poseidon2 in js for that
    #[view]
    unconstrained fn hash_unique_note_hash_helper(
        contract_address: AztecAddress,
        note_hash: Field,
        first_nullifier_in_tx: Field,
        unique_note_hash_index_in_tx: u32,
    ) -> pub Field {
        hash_unique_note_hash(contract_address, note_hash,first_nullifier_in_tx,unique_note_hash_index_in_tx)
    }


    fn prove_note_hash_inclusion(
        plain_note_hash: Field,      
        block_header: BlockHeader,
        contract_address: AztecAddress,
        first_nullifier_in_tx: Field, // any nullifier that is in the same tx as ur commitment
        unique_note_hash_index_in_tx: u32
    ) {
        let unique_note_hash = hash_unique_note_hash(contract_address,plain_note_hash,first_nullifier_in_tx,unique_note_hash_index_in_tx);

        let witness: MembershipWitness<40, 41> = unsafe {
            get_note_hash_membership_witness(block_header.global_variables.block_number as u32, unique_note_hash)
        };

        assert_eq(
            block_header.state.partial.note_hash_tree.root,
            root_from_sibling_path(unique_note_hash, witness.index, witness.path),
            "Proving note inclusion failed",
        );
    }


    #[view]
    fn hash_commit(
        nullifier_preimg: Field,
        secret: Field,
        destination_chain_id: Field,
        amount: u64,
    ) -> pub Field {
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        commitment
    }

    #[private]
    fn mint_local(
        nullifier_preimg: Field,
        secret: Field,
        amount: u64,
        recipient: AztecAddress,
        burn_tx_first_nullifier: Field, // any nullifier that is in the same tx as ur commitment
        note_index_in_tx: u32,
    ) {
        let chain_id: Field = context.chain_id();
        let commitment: Field = hash_commit(nullifier_preimg, secret, chain_id, amount);
        let nullifier: Field = poseidon::bn254::hash_1([nullifier_preimg]);

        let block_header: BlockHeader = context.historical_header;
        let contract_address: AztecAddress = context.this_address();

        prove_note_hash_inclusion(
            commitment,       
            block_header,
            contract_address,
            burn_tx_first_nullifier, 
            note_index_in_tx,
        );

        // TODO pushing the same nullifier twice is impossible right??
        context.push_nullifier(nullifier);
        // mint!
        storage.balances.at(recipient).add(amount, recipient, recipient);
    }

    // we dont need history we have the archive treee!!!
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
}
