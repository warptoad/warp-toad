use aztec::macros::aztec;
mod warptoad_note;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/easy_private_token_contract/src/main.nr
// TODO upgrade to more fleshed out version at: https://github.com/AztecProtocol/aztec-packages/blob/v0.84.0/noir-projects/noir-contracts/contracts/token_contract/src/main.nr
#[aztec]
pub contract WarpToadCore {

    use crate::warptoad_note::{WarpToadNote};
    use super::warptoad_note::Serialize;

    use poseidon::poseidon;
    use compressed_string::FieldCompressedString;
    use dep::easy_private_state::EasyPrivateUint;
    use dep::value_note::balance_utils;
    

    // TODO remove unused imports once you are sure you dont need them
    use aztec::{
        prelude::{AztecAddress, EthAddress, Map, PrivateMutable, PrivateSet, PublicImmutable, PublicMutable,},
        protocol_types::{
            constants::NOTE_HASH_TREE_HEIGHT,
            hash::{compute_note_hash_nonce, compute_siloed_note_hash, compute_unique_note_hash},
            merkle_tree::root::root_from_sibling_path,
            block_header::BlockHeader, 
            transaction::tx_context::TxContext
        },
        context::{PrivateCallInterface, PrivateContext},
        macros::{
            functions::{initializer, internal, private, public, utility, view},
            notes::note,
            storage::storage,
            events::event
        },
        event::event_interface::EventInterface,
        messages::logs::{
            event::encode_and_encrypt_event_unconstrained,
            note::{encode_and_encrypt_note, encode_and_encrypt_note_unconstrained},
        },
        note::{
            retrieved_note::RetrievedNote,
            note_getter::{get_notes, get_note_internal},
            note_interface::{
                NoteHash,
                NoteHash::{compute_nullifier, compute_note_hash,}
            },
        },
        oracle::get_membership_witness::{get_note_hash_membership_witness, MembershipWitness,},
        history::public_storage::PublicStorageHistoricalRead,

    };
    
    #[storage]
    struct Storage<Context> {

        giga_root: PublicMutable<Field, Context>,

        L1_contract: PublicImmutable<EthAddress, Context>,

        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
        commitments: PrivateSet<WarpToadNote, Context>,
        symbol: PublicImmutable<FieldCompressedString, Context>,
        name: PublicImmutable<FieldCompressedString, Context>,
        // docs:start:storage_decimals
        decimals: PublicImmutable<u8, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[public]
    fn constructor(L1_contract: EthAddress,name: str<31>, symbol: str<31>, decimals: u8) {
        storage.L1_contract.initialize(L1_contract);
        storage.name.initialize(FieldCompressedString::from_string(name));
        storage.symbol.initialize(FieldCompressedString::from_string(symbol));
        // docs:start:initialize_decimals
        storage.decimals.initialize(decimals); // cant be set too high since we use u64 which cant support large numbers
    }

    //-------warptoad things----------------------

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
    
    // TODO this is not safe. if sender reveals their viewing keys others can spend their token(they should only be able to see them!)
    // Look at the token contract example for how to do that
    // https://discord.com/channels/1144692727120937080/1359842526915203096
    #[private]
    fn burn(
        amount: u64,
        destination_chain_id: Field,
        secret: Field,
        nullifier_preimage: Field,
    ) { 
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

    // we can split up mint types based on where the burn happened to make users staying on aztec have faster proof time.
    // you can only do this on aztec because on aztec everything is private. So others don't see what function you called!!! :D
    #[private]
    fn mint_giga_root(
        recipient: AztecAddress,
        block_number: u32,
    ) {
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
        let pre_commitment_hash: Field =  poseidon::bn254::hash_3([retrieved_note.note.nullifier_preimage,retrieved_note.note.secret, retrieved_note.note.chain_id]);
        let note_hash = poseidon::bn254::hash_2([pre_commitment_hash,retrieved_note.note.amount]);
        //let note_hash = retrieved_note.note.compute_note_hash(storage_slot);//compute_note_hash_for_read_request(retrieved_note, storage_slot);

        let siloed_note_hash = compute_siloed_note_hash(context.this_address(), note_hash);
        let unique_note_hash = compute_unique_note_hash(retrieved_note.metadata.maybe_nonce, siloed_note_hash);
        assert(retrieved_note.metadata.maybe_nonce != 0, "idk how to deal with pending notes brooooo :,(");

        //Safety: its fine
        let witness: MembershipWitness<40, 41> = unsafe {get_note_hash_membership_witness(block_number, unique_note_hash)}; // <- would be input in evm circuit
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

    // DEBUG remove later
    #[utility]
    unconstrained fn get_chain_id() -> pub Field {
        context.chain_id()
    }
    //-----------------------------------------------


    // -------------standard token things------------
    // inspired by https://github.com/AztecProtocol/aztec-packages/blob/v0.86.0/noir-projects/noir-contracts/contracts/app/token_contract/src/main.nr
    // and 
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
    fn transfer(to: AztecAddress,amount: u64) {
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