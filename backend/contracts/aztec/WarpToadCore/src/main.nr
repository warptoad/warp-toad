use aztec::macros::aztec;
mod warptoad_note;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/defi-wonderland/aztec-standards/tree/v2.0.3/src/token_contract
#[aztec]
pub contract WarpToadCore {

    // local dep
    use crate::warptoad_note::WarpToadNote;
    use hashing::{Evm_merkle_data, evm_merkle_verify};
    use dep::aztec::protocol_types::traits::{Serialize, ToField};
    use dep::std::hash::pedersen_hash;
    use constants::{EVM_TREE_DEPTH, GIGA_TREE_DEPTH};
    use hashing::{hash_commitment};

    use aztec::event::event_emission::emit_event_in_public;
    use compressed_string::{FieldCompressedString, CompressedString};
    use poseidon::poseidon;
    use easy_private_state::{EasyPrivateUint};

    use aztec::{
        history::public_storage::PublicStorageHistoricalRead,
        macros::{
            events::event,
            functions::{initializer, external},
            storage::storage,
        },
        event::event_emission::{emit_event_in_private},
        messages::{
            message_delivery::MessageDelivery
        },
        oracle::get_membership_witness::{get_note_hash_membership_witness, MembershipWitness},
        protocol_types::{
            address::{AztecAddress, EthAddress},
        },
        state_vars::{
            map::Map,
            private_set::PrivateSet, public_immutable::PublicImmutable, public_mutable::PublicMutable,
        },
        protocol_types::{
            constants::NOTE_HASH_TREE_HEIGHT,
        },
    };



    // ---- Events yay! :D
    #[derive(Serialize)]
    #[event]
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
        amount: u64,
    }

    #[derive(Serialize)]
    #[event]
    struct Approval {
        owner: AztecAddress,
        spender: AztecAddress,
        amount: u64,
    }

    #[event]
    struct NewGigaRoot {
        giga_root:Field,
        block_number:u32, 
        // TODO technically ^ this doesn't need to be here but aztec js doesn't include this info
    }


    // ---- Storage (AIP-20 style integrated) https://github.com/defi-wonderland/aztec-standards/tree/v2.0.3/src/token_contract
    #[storage]
    struct Storage<Context> {
        //Bridge
        giga_root: PublicMutable<Field, Context>,
        native_token: PublicImmutable<EthAddress, Context>,
        //Notes for bridging
        commitments: PrivateSet<WarpToadNote, Context>,

        //AIP-20 token state
        balances: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
        allowances: Map<Field, EasyPrivateUint<Context>, Context>,
        //Token Metadata
        symbol: PublicImmutable<FieldCompressedString, Context>,
        name: PublicImmutable<FieldCompressedString, Context>,
        decimals: PublicImmutable<u8, Context>,

        //Admin | wiring
        deployer: PublicImmutable<AztecAddress, Context>,
        giga_root_provider: PublicImmutable<AztecAddress, Context>,
        l1_bridge_adapter: PublicImmutable<EthAddress, Context>,
    }

    /**
     * initialize the contract's initial state variables.
     */
    #[initializer]
    #[external("public")]
    fn constructor(native_token: EthAddress, _name: str<31>, _symbol: str<31>, _decimals: u8) {
        storage.native_token.initialize(native_token);
        storage.name.initialize(FieldCompressedString::from_string(_name));
        storage.symbol.initialize(FieldCompressedString::from_string(_symbol));
        storage.decimals.initialize(_decimals);
        storage.deployer.initialize(context.msg_sender().expect(f"Deployer must not be none!"));
    }

     #[external("public")]
    fn initialize(_giga_root_provider: AztecAddress, _l1_bridge_adapter: EthAddress) {
        assert(context.msg_sender().expect(f"msg sender must not be none!") == storage.deployer.read(), "not deployer");
        storage.giga_root_provider.initialize(_giga_root_provider);
        storage.l1_bridge_adapter.initialize(_l1_bridge_adapter);
    }

    //-------warptoad things----------------------

    // @TODO @WARNING remove this in prod!! Do minting from giga root instead
    #[external("private")]
    fn mint_for_testing(amount: u64, recipient: AztecAddress) {
        storage.balances.at(recipient).add(amount, recipient);
        emit_event_in_private(
            Transfer { from: context.this_address(), to: recipient, amount },
            &mut context,
            recipient,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    #[external("public")]
    fn receive_giga_root(giga_root: Field) {
        assert(context.msg_sender().expect(f"Sender must not be none!") == storage.giga_root_provider.read(), "not giga_root_provider");
        storage.giga_root.write(giga_root);
        emit_event_in_public(NewGigaRoot { giga_root, block_number: context.block_number() }, &mut context);
    }

    // a separate function for evm vs aztec since aztec uses poseidon2. But evm not yet
    // this works without creating a gigaRoot history right? we just need to make sure the block number we provide matches what gigaRoot was at that time in here!
    #[external("private")]
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
        let giga_root_slot: Field = aztec::state_vars::storage::HasStorageSlot::get_storage_slot(storage.giga_root);
        let contract_address: AztecAddress = context.this_address();
        let historical_header = context.get_block_header_at(block_number);
        let giga_root: Field = historical_header.public_storage_historical_read(giga_root_slot, contract_address);

        let (commitment, nullifier) = hash_commitment(nullifier_preimage, secret, chain_id, (amount as Field));

        // verify origin_local_root is part of giga_root
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
        // verify commitment is part of origin_local_root
        evm_merkle_verify(origin_local_root, commitment, evm_merkle_data);

        context.push_nullifier(nullifier);

        // Mint into private balance
        storage.balances.at(recipient).add(amount, recipient);

        emit_event_in_private(
            Transfer { from: context.this_address(), to: recipient, amount },
            &mut context,
            recipient,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    #[external("private")]
    fn burn(amount: u64, destination_chain_id: Field, secret: Field, nullifier_preimage: Field) {
        let sender = context.msg_sender().expect(f"Sender must not be none!");

        // Will fail if insufficient balance so no need for bal checkssssss
        storage.balances.at(sender).sub(amount, sender);

        let warptoad_note: WarpToadNote = WarpToadNote::new(
            nullifier_preimage,
            secret,
            destination_chain_id,
            (amount as Field),
        );

        storage.commitments.insert(warptoad_note).emit(sender, MessageDelivery.CONSTRAINED_ONCHAIN);

        emit_event_in_private(
            Transfer { from: sender, to: context.this_address(), amount },
            &mut context,
            sender,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    //-----------------------------------------------

    // -------------standard token things------------
    // inspired by https://github.com/AztecProtocol/aztec-packages/tree/v0.86.0/noir-projects/noir-contracts/contracts/app/easy_private_token_contract
    // TODO post hackathon make it more like: https://github.com/AztecProtocol/aztec-packages/blob/v0.86.0/noir-projects/noir-contracts/contracts/app/token_contract/src/main.nr
    // so it can support u128 balances
    // but simplified to reduce scope for the hackathon

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    #[external("private")]
    fn transfer(to: AztecAddress, amount: u64) {
        let from = context.msg_sender().expect(f"From must not be none!");
        storage.balances.at(from).sub(amount, from); // reverts if insufficient funds
        storage.balances.at(to).add(amount, to);

        emit_event_in_private(
            Transfer { from, to, amount },
            &mut context,
            to,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    #[external("private")]
    fn increase_allowance(spender: AztecAddress, added: u64) {
        let owner = context.msg_sender().expect(f"Owner must not be none!");
        let key = pedersen_hash([owner.to_field(), spender.to_field()]);
        storage.allowances.at(key).add(added, owner);
        let _ = added;
        // we emit delta for wallet UX; clients should track deltas or query via PXE.
        emit_event_in_private(
            Approval { owner, spender, amount: added },
            &mut context,
            owner,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    #[external("private")]
    fn decrease_allowance(spender: AztecAddress, subtracted: u64) {
        let owner = context.msg_sender().expect(f"Owner must not be none!");
        let key = pedersen_hash([owner.to_field(), spender.to_field()]);
        storage.allowances.at(key).sub(subtracted, owner); // underflow means revert
        emit_event_in_private(
            Approval { owner, spender, amount: 0u64 }, // semantic: signal decrease occurred
            &mut context,
            owner,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }
    

    #[external("private")]
    fn transfer_from(owner: AztecAddress, to: AztecAddress, amount: u64) {
        let spender = context.msg_sender().expect(f"Spender must not be none!");
        let key = pedersen_hash([owner.to_field(), spender.to_field()]);
        // Check & consume allowance (reverts on insufficient)
        storage.allowances.at(key).sub(amount, owner);

        storage.balances.at(owner).sub(amount, owner);
        storage.balances.at(to).add(amount, to);

        emit_event_in_private(
            Transfer { from: owner, to, amount },
            &mut context,
            to,
            MessageDelivery.UNCONSTRAINED_OFFCHAIN,
        );
    }

    // utility

    #[external("utility")]
    unconstrained fn get_giga_root() -> pub Field { 
        storage.giga_root.read() 
    }

    // it allows us to do a eth_getProof like thing for a commitment. Kinda cringe that i cant just call a api in js like on ethereum? Maybe you can?
    #[external("utility")]
    unconstrained fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
        get_note_hash_membership_witness(block_number, note_hash)
    }

    #[external("utility")]
    unconstrained fn get_l1_bridge_adapter() -> pub EthAddress { storage.l1_bridge_adapter.read() }

    // we hallucinate our own chainId since we just need a unique identifier to identify the chain
    // maybe we can just use the context.version as our chainId since it looks like it doesn't collide with existing chainIds?
    // also is context.version even safe?? will it update with network upgrades??
    #[contract_library_method]
    fn get_chain_id(aztec_version: Field) -> Field {
        let salt: CompressedString<32, 24> = CompressedString::from_string("aztecPlsJustPickAChainId");
        poseidon::bn254::hash_2([salt.serialize()[0], aztec_version])
    }

    #[external("utility")]
    unconstrained fn get_chain_id_unconstrained(aztec_version: Field) -> pub Field { 
        get_chain_id(aztec_version) 
    }

    #[external("utility")]
    unconstrained fn get_version() -> Field { 
        context.version() 
    }

    #[external("utility")]
    unconstrained fn public_get_name() -> pub FieldCompressedString { 
        storage.name.read() 
    }

    #[external("utility")]
    unconstrained fn public_get_symbol() -> pub FieldCompressedString { 
        storage.symbol.read() 
    }

    #[external("utility")]
    unconstrained fn get_decimals() -> pub u8 { 
        storage.decimals.read() 
    }

}
