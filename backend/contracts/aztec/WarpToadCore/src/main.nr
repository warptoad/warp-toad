use aztec::macros::aztec;
mod warptoad_note;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr

#[aztec]
pub contract WarpToadCore {
    // macros
    use aztec::macros::{notes::note, functions::{initializer, private, public, view, internal,utility}, storage::{storage}};
    use crate::warptoad_note::WarpToadNote;
    // storage types
    use aztec::prelude::{AztecAddress, EthAddress, Map, PublicImmutable, PublicMutable,PrivateMutable,PrivateSet};
    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;
    use aztec::messages::logs::note::encode_and_encrypt_note;
    // note proving
    use aztec::oracle::get_membership_witness::{
        get_note_hash_membership_witness, MembershipWitness,
    };
    use aztec::protocol_types::{
        merkle_tree::root::root_from_sibling_path, 
        constants::NOTE_HASH_TREE_HEIGHT,
        hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash}
        };
    use aztec::note::retrieved_note::RetrievedNote;
    use aztec::note::note_metadata::SettledNoteMetadata;

    // old poseidon was removed from std lib for some reason?
    // https://github.com/noir-lang/noir/pull/7650
    use poseidon::poseidon;

    // archive tree proving
    use aztec::history::public_storage::PublicStorageHistoricalRead;
    use protocol_types::{block_header::BlockHeader, transaction::tx_context::TxContext};

    #[storage]
    struct Storage<Context> {

        giga_root: PublicMutable<Field, Context>,

        L1_contract: PublicImmutable<EthAddress, Context>,

        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
        commitments: PrivateSet<WarpToadNote, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[public]
    fn constructor(L1_contract: EthAddress) {
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
    }

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    // TODO unsafe any can be pretend to be sender if they know the viewing
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
        nullifier_preimage: Field,
        sender: AztecAddress,
    ) {
        storage.balances.at(sender).sub(amount, sender, sender);

        // add the commitment
        // let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimg, secret, destination_chain_id]);
        // let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        // context.push_note_hash(commitment); // TODO this doesnt actually put it in the fucking tree???
        let warptoad_note: WarpToadNote = WarpToadNote {
            nullifier_preimage,
            secret,
            chain_id: destination_chain_id,
            amount: amount as Field
        };
        storage.commitments.insert(warptoad_note).emit(encode_and_encrypt_note(
            &mut context,
            context.msg_sender(),
            context.msg_sender(),
        ));
        
    }

    #[contract_library_method]
    fn hash_unique_note_hash(
        contract_address: AztecAddress,
        note_hash: Field,
        first_nullifier_in_tx: Field,
        unique_note_hash_index_in_tx: u32,
    ) -> Field {
        let siloed_note_hash = compute_siloed_note_hash(contract_address, note_hash);
        let nonce = compute_note_hash_nonce(first_nullifier_in_tx,unique_note_hash_index_in_tx);
        let unique_note_hash = compute_unique_note_hash(nonce,siloed_note_hash);
        unique_note_hash
    }

    //TODO long term we need js equivalent for performance and cleaner code but we need poseidon2 in js for that
    #[utility]
    unconstrained fn hash_unique_note_hash_helper(
        contract_address: AztecAddress,
        note_hash: Field,
        first_nullifier_in_tx: Field,
        unique_note_hash_index_in_tx: u32,
    ) -> pub Field {
        hash_unique_note_hash(contract_address, note_hash,first_nullifier_in_tx,unique_note_hash_index_in_tx)
    }

    #[contract_library_method]
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

    #[contract_library_method]
    fn hash_commit(
        nullifier_preimage: Field,
        secret: Field,
        destination_chain_id: Field,
        amount: u64,
    ) -> Field {
        let pre_commitment: Field = poseidon::bn254::hash_3([nullifier_preimage, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        commitment
    }

    #[private]
    fn mint_local(
        nullifier_preimage: Field,
        secret: Field,
        amount: u64,
        recipient: AztecAddress,
        burn_tx_first_nullifier: Field, // any nullifier that is in the same tx as ur commitment
        note_index_in_tx: u32,
    ) {
        let chain_id: Field = context.chain_id();
        // let commitment: Field = hash_commit(nullifier_preimage, secret, chain_id, amount);
        let nullifier: Field = poseidon::bn254::hash_1([nullifier_preimage]);

        // let block_header: BlockHeader = context.historical_header;
        // let contract_address: AztecAddress = context.this_address();

        // prove_note_hash_inclusion(
        //     commitment,       
        //     block_header,
        //     contract_address,
        //     burn_tx_first_nullifier, 
        //     note_index_in_tx,
        // );
        let nonce = compute_note_hash_nonce(burn_tx_first_nullifier,note_index_in_tx);
        let warptoad_note: WarpToadNote = WarpToadNote {
            nullifier_preimage,
            secret,
            chain_id: chain_id,
            amount: amount as Field
        };
        let retrieved_note:RetrievedNote<WarpToadNote> = RetrievedNote{
            note: warptoad_note,
            contract_address: context.this_address(),
            metadata:  aztec::note::note_metadata::SettledNoteMetadata::new(nonce).into() 
        };
        storage.commitments.remove(retrieved_note);
        // TODO pushing the same nullifier twice is impossible right??
        context.push_nullifier(nullifier);
        // mint!
        storage.balances.at(recipient).add(amount, recipient, recipient);
    }

    // it allows us to do a eth_getProof like thing for a commitment. Kinda cringe that i cant just call a api in js like on ethereum? Maybe you can?
    #[utility]
    unconstrained fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
        get_note_hash_membership_witness(block_number, note_hash)
    }


    // DEBUG remove later
    #[utility]
    unconstrained fn get_chain_id() -> pub Field {
        context.chain_id()
    }

    // Helper function to get the balance of a user.
    #[utility]
    unconstrained fn get_balance(owner: AztecAddress) -> pub Field {
        balance_utils::get_balance(storage.balances.at(owner).set)
    }

    #[utility] 
    unconstrained fn get_giga_root() -> pub Field {
        storage.giga_root.read()
    }

}
