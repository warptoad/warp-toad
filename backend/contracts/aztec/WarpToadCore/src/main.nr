use aztec::macros::aztec;
mod warptoad_note;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr

#[aztec]
pub contract WarpToadCore {
    // macros
    use crate::warptoad_note::{WarpToadNote};//, NoteHash::{compute_note_hash}};
    use aztec::macros::{
        functions::{initializer, internal, private, public, utility, view},
        notes::note,
        storage::storage,
    };
    // storage types
    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;
    use aztec::messages::logs::note::encode_and_encrypt_note;
    use aztec::prelude::{
        AztecAddress, EthAddress, Map, PrivateMutable, PrivateSet, PublicImmutable, PublicMutable,
    };
    // note proving
    use aztec::note::{ 
        utils::{compute_note_hash_for_nullify_from_read_request, compute_note_hash_for_read_request},
        note_metadata,
        note_metadata::SettledNoteMetadata
    };
    use aztec::note::retrieved_note::RetrievedNote;
    use aztec::oracle::get_membership_witness::{
        get_note_hash_membership_witness, MembershipWitness,
    };
    use aztec::protocol_types::{
        constants::NOTE_HASH_TREE_HEIGHT,
        hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash},
        merkle_tree::root::root_from_sibling_path,
    };

    // old poseidon was removed from std lib for some reason?
    // https://github.com/noir-lang/noir/pull/7650
    use poseidon::poseidon;

    // archive tree proving
    use super::warptoad_note::Serialize;
    use aztec::history::public_storage::PublicStorageHistoricalRead;
    use aztec::note::note_getter::{get_notes, get_note_internal};
    use aztec::note::note_getter_options::NoteGetterOptions;
    use protocol_types::{block_header::BlockHeader, transaction::tx_context::TxContext};
    use aztec::note::note_interface::NoteHash::{compute_nullifier, compute_note_hash};
    use aztec::note::note_interface::NoteHash;
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
            amount: amount as Field,
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
        nonce: Field,
    ) -> Field {
        let siloed_note_hash = compute_siloed_note_hash(contract_address, note_hash);
        let unique_note_hash = compute_unique_note_hash(nonce, siloed_note_hash);
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
        let nonce: Field = compute_note_hash_nonce(first_nullifier_in_tx, unique_note_hash_index_in_tx);
        hash_unique_note_hash(
            contract_address,
            note_hash,
            nonce
        )
    }

    #[contract_library_method]
    fn prove_note_hash_inclusion(
        plain_note_hash: Field,
        block_header: BlockHeader,
        contract_address: AztecAddress,
        nonce: Field,
    ) {
        let unique_note_hash = hash_unique_note_hash(
            contract_address,
            plain_note_hash,
            nonce
        );
        // Safety: is fine
        let witness: MembershipWitness<40, 41> = unsafe {
            get_note_hash_membership_witness(
                block_header.global_variables.block_number as u32,
                unique_note_hash,
            )
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
        let pre_commitment: Field =
            poseidon::bn254::hash_3([nullifier_preimage, secret, destination_chain_id]);
        let commitment: Field = poseidon::bn254::hash_2([amount as Field, pre_commitment]);
        commitment
    }

    // technically this function is useless. You can make full private transfers with UTXO notes on aztec through the private transfer function.
    // the only reason this exist as reference to create the EVM circuit that verifies the aztec note hash tree. 
    // secret, nullifier, etc is retrieved from the PXE
    #[private]
    fn mint_local(
        recipient: AztecAddress,
        block_number: u32,
    ) { 
        // get note from PXE
        let storage_slot = storage.commitments.storage_slot; // WarpToadNote doesn't care about storage slot for hashing. PXE doesn't th
        //Safety: its fine
        let retrieved_note: RetrievedNote<WarpToadNote> = unsafe { get_note_internal::<WarpToadNote, 4>(storage_slot) }; // <- would be input in evm circuit
        let block_header = context.get_block_header_at(block_number);
        let note_hash_root = block_header.state.partial.note_hash_tree.root; // <- would be input in evm circuit

        // check chain id 
        let chain_id = context.chain_id();
        assert(retrieved_note.note.chain_id == chain_id, "notes chain_id doesnt match current chain_id");
        
        // prove its in the chain
        let note_hash = retrieved_note.note.compute_note_hash(storage_slot);//compute_note_hash_for_read_request(retrieved_note, storage_slot);

        let siloed_note_hash = compute_siloed_note_hash(context.this_address(), note_hash);
        let unique_note_hash = compute_unique_note_hash(retrieved_note.metadata.maybe_nonce, siloed_note_hash);
        assert(retrieved_note.metadata.maybe_nonce != 0, "idk how to deal with pending notes brooooo :,(");

        //Safety: its fine
        let witness = unsafe {get_note_hash_membership_witness(block_number, unique_note_hash)}; // <- would be input in evm circuit
        assert_eq(
            note_hash_root,
            root_from_sibling_path(unique_note_hash, witness.index, witness.path),
            "Proving note inclusion failed",
        );
        // the above is what the private kernel does when you do context.push_note_hash_read_request(note_hash)
        // but we do it like this instead because i wanted to know how to do it in the EVM circuit and this how we would do it! (i hope)
    
        let nullifier: Field = retrieved_note.note.compute_nullifier(&mut context, note_hash);
        
        // nullify it
        context.push_nullifier(nullifier);

        // finally we can mint
        storage.balances.at(recipient).add(retrieved_note.note.amount as u64, recipient, context.msg_sender());
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
