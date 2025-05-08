use aztec::macros::aztec;
mod warptoad_note;
mod hashing;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO post hackathon upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr
#[aztec]
pub contract WarpToadCore {

    // local dep
    use crate::warptoad_note::WarpToadNote;
    use crate::hashing::{Aztec_merkle_data, Evm_merkle_data, aztec_merkle_verify, evm_merkle_verify};
    use super::warptoad_note::Serialize;
    use constants::{AZTEC_TREE_DEPTH, EVM_TREE_DEPTH, GIGA_TREE_DEPTH};
    use hashing::{hash_commitment};


    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;
    use compressed_string::{FieldCompressedString, CompressedString};
    use poseidon::poseidon;

    // TODO remove unused imports once you are sure you dont need them
    use aztec::{
        context::{PrivateCallInterface, PrivateContext},
        event::event_interface::EventInterface,
        history::public_storage::PublicStorageHistoricalRead,
        macros::{
            events::event,
            functions::{initializer, internal, private, public, utility, view},
            notes::note,
            storage::storage,
        },
        messages::logs::{
            event::encode_and_encrypt_event_unconstrained,
            note::{encode_and_encrypt_note, encode_and_encrypt_note_unconstrained},
        },
        note::{
            note_getter::{get_note_internal, get_notes},
            note_interface::NoteHash::{self, compute_note_hash, compute_nullifier},
            retrieved_note::RetrievedNote,
        },
        oracle::get_membership_witness::{get_note_hash_membership_witness, MembershipWitness},
        prelude::{
            AztecAddress, EthAddress, Map, PrivateMutable, PrivateSet, PublicImmutable,
            PublicMutable,
        },
        protocol_types::{
            block_header::BlockHeader,
            constants::NOTE_HASH_TREE_HEIGHT,
            hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash},
            merkle_tree::root::root_from_sibling_path,
            transaction::tx_context::TxContext,
        },
    };


    #[storage]
    struct Storage<Context> {

        giga_root: PublicMutable<Field, Context>,
        native_token: PublicImmutable<EthAddress, Context>,
        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
        commitments: PrivateSet<WarpToadNote, Context>,
        symbol: PublicImmutable<FieldCompressedString, Context>,
        name: PublicImmutable<FieldCompressedString, Context>,
        // docs:start:storage_decimals
        decimals: PublicImmutable<u8, Context>,
        deployer: PublicImmutable<AztecAddress, Context>,
        giga_root_provider: PublicImmutable<AztecAddress, Context>,
        l1_bridge_adapter:PublicImmutable<EthAddress, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[public]
    fn constructor(native_token: EthAddress,_name: str<31>, _symbol: str<31>, _decimals: u8) {
        storage.native_token.initialize(native_token);
        storage.name.initialize(FieldCompressedString::from_string(_name));
        storage.symbol.initialize(FieldCompressedString::from_string(_symbol));
        // docs:start:initialize_decimals
        storage.decimals.initialize(_decimals); // cant be set too high since we use u64 which cant support large numbers
        storage.deployer.initialize(context.msg_sender());
    }

    // @TODO can also be done in constructor 
    #[public]
    fn initialize(_giga_root_provider: AztecAddress, _l1_bridge_adapter: EthAddress) {
        assert(context.msg_sender() == storage.deployer.read(), "you're not the deployer.");
        storage.giga_root_provider.initialize(_giga_root_provider); 
        storage.l1_bridge_adapter.initialize(_l1_bridge_adapter);
    }

    //-------warptoad things----------------------

    // @TODO @WARNING remove this in prod!! Do minting from giga root instead
    #[private]
    fn mint_for_testing(amount: u64, recipient: AztecAddress) {
        storage.balances.at(recipient).add(amount, recipient, context.msg_sender());
    }

    #[public]
    fn receive_giga_root(giga_root: Field) {
        assert(context.msg_sender() == storage.giga_root_provider.read(), "you are not the giga_root_provider.");
        storage.giga_root.write(giga_root);
    }

    #[private]
    fn burn(amount: u64, destination_chain_id: Field, secret: Field, nullifier_preimage: Field) {
        let sender = context.msg_sender();
        storage.balances.at(sender).sub(amount, sender, sender);

        let warptoad_note: WarpToadNote = WarpToadNote {
            nullifier_preimage: nullifier_preimage,
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

    // a separate function for evm vs aztec since aztec uses poseidon2. But evm not yet
    // this works without creating a gigaRoot history right? we just need to make sure the block number we provide matches what gigaRoot was at that time in here!
    #[private]
    fn mint_giga_root_evm(
        amount: u64,
        secret: Field,
        nullifier_preimage: Field,
        recipient: AztecAddress,
        block_number: u32,
        origin_local_root: Field,
        giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
        evm_merkle_data: Evm_merkle_data<EVM_TREE_DEPTH>,
    ) {
        let chain_id: Field = get_chain_id(context.version());
        let giga_root_slot: Field =
            aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root);
        let contract_address: AztecAddress = context.this_address();
        let giga_root: Field = context.historical_header.public_storage_historical_read(
            giga_root_slot,
            contract_address,
        );
        let (commitment, nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, amount as Field);

        // verify origin_local_root is part of giga_root
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
        // verify commitment is part of origin_local_root
        evm_merkle_verify(origin_local_root, commitment, evm_merkle_data);
        context.push_nullifier(nullifier);
        storage.balances.at(recipient).add(amount , recipient, context.msg_sender());
    }

    // just incase there will other instance of aztec we will bridge too :D
    // TODO untested. if someone by accident burns with the aztec chainId, then this is their only method to recover.
    // but besides accidents users should never use this in a world where there is only one aztec. just use the normal private transfers
    #[private]
    fn mint_giga_root_aztec(
        amount: u64,
        secret: Field,
        nullifier_preimage: Field,
        recipient: AztecAddress,
        block_number: u32,
        origin_local_root: Field,
        giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
        aztec_merkle_data: Aztec_merkle_data<AZTEC_TREE_DEPTH>,
    ) {
        let chain_id: Field = get_chain_id(context.version());
        let giga_root_slot: Field =
            aztec::state_vars::storage::Storage::get_storage_slot(storage.giga_root);
        let contract_address: AztecAddress = context.this_address();
        let giga_root: Field = context.historical_header.public_storage_historical_read(
            giga_root_slot,
            contract_address,
        );
        let (commitment, nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, amount as Field);

        // no skip giga_root check here because you shouldn't burn + mint only on aztec. users should use private transfers. try it! its cool :D
        // verify origin_local_root is part of giga_root
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
        // verify commitment is part of origin_local_root
        aztec_merkle_verify(origin_local_root, commitment, aztec_merkle_data);
        context.push_nullifier(nullifier);
        storage.balances.at(recipient).add(amount, recipient, context.msg_sender());
    }

    // technically this function is useless. You can make full private transfers with UTXO notes on aztec through the private transfer function.
    // the only reason this exist as reference to create the EVM circuit that verifies the aztec note hash tree.
    // secret, nullifier, etc is retrieved from the PXE
    #[private]
    fn mint_local(recipient: AztecAddress, block_number: u32) {
        // get note from PXE
        let storage_slot = storage.commitments.storage_slot; // WarpToadNote doesn't care about storage slot for hashing. PXE doesn't th
        //Safety: its fine
        let retrieved_note: RetrievedNote<WarpToadNote> =
            unsafe { get_note_internal::<WarpToadNote, 4>(storage_slot) }; // <- would be input in evm circuit
        let block_header = context.get_block_header_at(block_number);
        let note_hash_root = block_header.state.partial.note_hash_tree.root; // <- would be input in evm circuit

        // check chain id
        let chain_id = get_chain_id(context.version());
        assert(
            retrieved_note.note.chain_id == chain_id,
            "notes chain_id doesnt match current chain_id",
        );

        // prove its in the chain
        let pre_commitment_hash: Field = poseidon::bn254::hash_3([
            retrieved_note.note.nullifier_preimage,
            retrieved_note.note.secret,
            retrieved_note.note.chain_id,
        ]);
        let note_hash = poseidon::bn254::hash_2([pre_commitment_hash, retrieved_note.note.amount]);
        //let note_hash = retrieved_note.note.compute_note_hash(storage_slot);//compute_note_hash_for_read_request(retrieved_note, storage_slot);

        let siloed_note_hash = compute_siloed_note_hash(context.this_address(), note_hash);
        let unique_note_hash =
            compute_unique_note_hash(retrieved_note.metadata.maybe_nonce, siloed_note_hash);
        assert(
            retrieved_note.metadata.maybe_nonce != 0,
            "idk how to deal with pending notes brooooo :,(",
        );

        //Safety: its fine
        let witness: MembershipWitness<40, 41> =
            unsafe { get_note_hash_membership_witness(block_number, unique_note_hash) }; // <- would be input in evm circuit
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
        storage.balances.at(recipient).add(
            retrieved_note.note.amount as u64,
            recipient,
            context.msg_sender(),
        );
    }

    #[utility]
    unconstrained fn get_giga_root() -> pub Field {
        storage.giga_root.read()
    }

    // it allows us to do a eth_getProof like thing for a commitment. Kinda cringe that i cant just call a api in js like on ethereum? Maybe you can?
    #[utility]
    unconstrained fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
        get_note_hash_membership_witness(block_number, note_hash)
    }

    #[utility]
    unconstrained fn get_l1_bridge_adapter() -> pub EthAddress {
        storage.l1_bridge_adapter.read()
    }

    // we hallucinate our own chainId since we just need a unique identifier to identify the chain
    // maybe we can just use the context.version as our chainId since it looks like it doesn't collide with existing chainIds?
    // also is context.version even safe?? will it update with network upgrades??
    #[contract_library_method]
    fn get_chain_id(aztec_version:Field) -> Field {
        let salt: CompressedString<32, 24> = CompressedString::from_string("aztecPlsJustPickAChainId");
        poseidon::bn254::hash_2([salt.serialize()[0], aztec_version])
    }


    // DEBUG remove later
    #[utility]
    unconstrained fn get_chain_id_unconstrained(aztec_version:Field) -> pub Field {
        get_chain_id(aztec_version)
    }

    #[utility]
    unconstrained fn get_version() -> Field {
        context.version()
    }
    //-----------------------------------------------

    // -------------standard token things------------
    // inspired by https://github.com/AztecProtocol/aztec-packages/tree/v0.86.0/noir-projects/noir-contracts/contracts/app/easy_private_token_contract
    // TODO post hackathon make it more like: https://github.com/AztecProtocol/aztec-packages/blob/v0.86.0/noir-projects/noir-contracts/contracts/app/token_contract/src/main.nr
    // so it can support u128 balances
    // but simplified to reduce scope for the hackathon
    #[derive(Serialize)]
    #[event]
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
        amount: u64,
    }

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    #[private]
    fn transfer(to: AztecAddress, amount: u64) {
        let from = context.msg_sender();
        let balances = storage.balances;

        balances.at(from).sub(amount, from, from);
        balances.at(to).add(amount, to, from);
        Transfer { from, to, amount }.emit(encode_and_encrypt_event_unconstrained(
            &mut context,
            to,
            from,
        ));
    }

    // utility
    // Helper function to get the balance of a user.
    #[utility]
    unconstrained fn balance_of(owner: AztecAddress) -> pub Field {
        balance_utils::get_balance(storage.balances.at(owner).set)
    }

    #[utility]
    unconstrained fn public_get_name() -> pub FieldCompressedString {
        storage.name.read()
    }

    #[utility]
    unconstrained fn public_get_symbol() -> pub FieldCompressedString {
        storage.symbol.read()
    }

    #[utility]
    unconstrained fn get_decimals() -> pub u8 {
        storage.decimals.read()
    }

}
