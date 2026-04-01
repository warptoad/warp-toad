use aztec::macros::aztec;
mod warptoad_note;
// from
// https://github.com/privacy-scaling-explorations/zk-kit.noir/blob/fa5fdb0f0d0867e367388f85079db3b1f9a47590/packages/merkle-trees/src/merkle.nr#L3

// token functionality based of: https://github.com/defi-wonderland/aztec-standards/tree/v2.0.3/src/token_contract
#[aztec]
pub contract WarpToadCore {

    // local dep
    use crate::warptoad_note::WarpToadNote;
    use dep::aztec::protocol_types::traits::{Serialize, ToField};
    use dep::std::hash::pedersen_hash;
    use constants::{EVM_TREE_DEPTH, GIGA_TREE_DEPTH};
    use hashing::{Evm_merkle_data, evm_merkle_verify};
    use hashing::hash_commitment;

    use compressed_string::{CompressedString, FieldCompressedString};
    use dep::aztec::state_vars::state_variable::StateVariable;
    use poseidon::poseidon;

    use dep::aztec::note::note_getter::get_notes;
    use aztec::context::{self, utility_context::UtilityContext};
    use aztec::{
        history::public_storage::PublicStorageHistoricalRead,
        macros::{events::event, functions::{external, initializer, view}, storage::storage},
        messages::message_delivery::MessageDelivery,
        oracle::{
            get_membership_witness::{get_note_hash_membership_witness, MembershipWitness},
            notes::check_nullifier_exists,
        },
        protocol_types::{address::{AztecAddress, EthAddress}, constants::NOTE_HASH_TREE_HEIGHT},
        state_vars::{
            map::Map, private_set::PrivateSet, public_immutable::PublicImmutable,
            public_mutable::PublicMutable,
        },
    };
    use aztec::note::{
        note_getter_options::{NoteGetterOptions, NoteStatus},
        note_viewer_options::NoteViewerOptions,
    };
    use balance_set::BalanceSet;

    use aztec::note::retrieved_note::RetrievedNote;

    use aztec::state_vars::owned::Owned;
    use protocol_types::constants::MAX_NOTE_HASHES_PER_CALL;

    // ---- Events yay! :D
    #[derive(Serialize)]
    #[event]
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
    }

    #[derive(Serialize)]
    #[event]
    struct Approval {
        owner: AztecAddress,
        spender: AztecAddress,
        amount: u128,
    }

    #[event]
    struct NewGigaRoot {
        giga_root: Field,
        block_number: u32,
        // TODO technically ^ this doesn't need to be here but aztec js doesn't include this info
    }

    // ---- Storage (AIP-20 style integrated) https://github.com/defi-wonderland/aztec-standards/tree/v2.0.3/src/token_contract
    #[storage]
    struct Storage<Context> {
        //Bridge
        giga_root: PublicMutable<Field, Context>,
        native_token: PublicImmutable<EthAddress, Context>,
        //Notes for bridging
        commitments: Owned<PrivateSet<WarpToadNote, Context>, Context>,

        //AIP-20 token state
        balances: Owned<BalanceSet<Context>, Context>,
        allowances: Owned<BalanceSet<Context>, Context>,
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
        self.storage.native_token.initialize(native_token);
        self.storage.name.initialize(FieldCompressedString::from_string(_name));
        self.storage.symbol.initialize(FieldCompressedString::from_string(_symbol));
        self.storage.decimals.initialize(_decimals);
        self.storage.deployer.initialize(self.context.msg_sender().expect(
            f"Deployer must not be none!",
        ));
    }

    #[external("public")]
    fn initialize(_giga_root_provider: AztecAddress, _l1_bridge_adapter: EthAddress) {
        assert(
            self.context.msg_sender().expect(f"msg sender must not be none!")
                == self.storage.deployer.read(),
            "not deployer",
        );
        self.storage.giga_root_provider.initialize(_giga_root_provider);
        self.storage.l1_bridge_adapter.initialize(_l1_bridge_adapter);
    }

    //-------warptoad things----------------------

    // @TODO @WARNING remove this in prod!! Do minting from giga root instead
    #[external("private")]
    fn mint_for_testing(amount: u128, recipient: AztecAddress) {
        self.storage.balances.at(recipient).add(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        self.emit(
            Transfer { from: self.context.this_address(), to: recipient, amount },
        )
            .deliver_to(recipient, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("public")]
    fn receive_giga_root(giga_root: Field) {
        assert(
            self.context.msg_sender().expect(f"Sender must not be none!")
                == self.storage.giga_root_provider.read(),
            "not giga_root_provider",
        );
        self.storage.giga_root.write(giga_root);
        self.emit(
            NewGigaRoot { giga_root, block_number: self.context.block_number() },
        );
    }

    // a separate function for evm vs aztec since aztec uses poseidon2. But evm not yet
    // this works without creating a gigaRoot history right? we just need to make sure the block number we provide matches what gigaRoot was at that time in here!
    #[external("private")]
    fn mint_giga_root_evm(
        amount: u128,
        secret: Field,
        nullifier_preimage: Field,
        recipient: AztecAddress,
        block_number: u32,
        origin_local_root: Field,
        giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
        evm_merkle_data: Evm_merkle_data<EVM_TREE_DEPTH>,
    ) {
        let chain_id: Field = get_chain_id(self.context.version());
        let giga_root_slot: Field = self.storage.giga_root.get_storage_slot();
        let contract_address: AztecAddress = self.context.this_address();
        let historical_header = self.context.get_block_header_at(block_number);
        let giga_root: Field =
            historical_header.public_storage_historical_read(giga_root_slot, contract_address);

        let (commitment, nullifier) =
            hash_commitment(nullifier_preimage, secret, chain_id, (amount as Field));

        // verify origin_local_root is part of giga_root
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
        // verify commitment is part of origin_local_root
        evm_merkle_verify(origin_local_root, commitment, evm_merkle_data);

        self.context.push_nullifier(nullifier);

        // TODO Mint into private balance
        self.storage.balances.at(recipient).add(amount).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );

        self.emit(
            Transfer { from: self.context.this_address(), to: recipient, amount },
        )
            .deliver_to(recipient, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn burn(amount: u128, destination_chain_id: Field, secret: Field, nullifier_preimage: Field) {
        let sender = self.context.msg_sender().expect(f"Sender must not be none!");
        let recipient = sender;

        // Will fail if insufficient balance so no need for bal checkssssss
        self.storage.balances.at(sender).sub(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);

        let warptoad_note: WarpToadNote = WarpToadNote::new(
            nullifier_preimage,
            secret,
            destination_chain_id,
            (amount as Field),
        );

        self.storage.commitments.at(recipient).insert(warptoad_note).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );

        self.emit(
            Transfer { from: sender, to: self.context.this_address(), amount },
        )
            .deliver_to(sender, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    //-----------------------------------------------

    // -------------standard token things------------
    // inspired by https://github.com/AztecProtocol/aztec-packages/tree/v0.86.0/noir-projects/noir-contracts/contracts/app/easy_private_token_contract
    // TODO post hackathon make it more like: https://github.com/AztecProtocol/aztec-packages/blob/v0.86.0/noir-projects/noir-contracts/contracts/app/token_contract/src/main.nr
    // so it can support u128 balances
    // but simplified to reduce scope for the hackathon

    // Transfers `amount` of tokens from `sender` to a `recipient`.
    #[external("private")]
    fn transfer_private_to_private(
        from: AztecAddress, // TODO unused
        to: AztecAddress,
        amount: u128,
        _nonce: Field, // TODO unused
    ) {
        let from = self.context.msg_sender().expect(f"From must not be none!");

        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED); // reverts if insufficient funds
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        self.emit(
            Transfer { from: from, to: to, amount: amount },
        )
            .deliver_to(to, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn increase_allowance(spender: AztecAddress, added: u128) {
        let owner = self.context.msg_sender().expect(f"Owner must not be none!");
        self.storage.allowances.at(owner).add(added).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        let _ = added;
        // we emit delta for wallet UX; clients should track deltas or query via PXE.
        self.emit(Approval { owner, spender, amount: added }).deliver_to(
            owner,
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );
    }

    #[external("private")]
    fn decrease_allowance(spender: AztecAddress, subtracted: u128) {
        let owner = self.context.msg_sender().expect(f"Owner must not be none!");
        self.storage.allowances.at(owner).sub(subtracted).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        ); // underflow means revert
        self.emit(
            Approval { owner, spender, amount: 0u128 }, // semantic: signal decrease occurred
        )
            .deliver_to(owner, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn transfer_from(owner: AztecAddress, to: AztecAddress, amount: u128) {
        let spender = self.context.msg_sender().expect(f"Spender must not be none!");
        // Check & consume allowance (reverts on insufficient)
        self.storage.allowances.at(spender).sub(amount).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );

        self.storage.balances.at(owner).sub(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);

        self.emit(Transfer { from: owner, to, amount }).deliver_to(
            to,
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );
    }

    // utility
    #[external("private")]
    fn get_root_from_block(block_number: u32) -> pub Field {
        let giga_root_slot: Field = self.storage.giga_root.get_storage_slot();

        let contract_address: AztecAddress = self.context.this_address();

        let historical_header = self.context.get_block_header_at(block_number);

        historical_header.public_storage_historical_read(giga_root_slot, contract_address)
    }

    #[external("utility")]
    unconstrained fn get_giga_root() -> pub Field {
        self.storage.giga_root.read()
    }

    // it allows us to do a eth_getProof like thing for a commitment. Kinda cringe that i cant just call a api in js like on ethereum? Maybe you can?
    #[external("utility")]
    unconstrained fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT, NOTE_HASH_TREE_HEIGHT + 1> {
        let witness = get_note_hash_membership_witness(block_number, note_hash);
        witness
    }

    #[external("utility")]
    unconstrained fn get_l1_bridge_adapter() -> pub EthAddress {
        self.storage.l1_bridge_adapter.read()
    }

    // we hallucinate our own chainId since we just need a unique identifier to identify the chain
    // maybe we can just use the self.context.version as our chainId since it looks like it doesn't collide with existing chainIds?
    // also is self.context.version even safe?? will it update with network upgrades??
    #[contract_library_method]
    fn get_chain_id(aztec_version: Field) -> Field {
        let salt: CompressedString<32, 24> =
            CompressedString::from_string("aztecPlsJustPickAChainId");
        poseidon::bn254::hash_2([salt.serialize()[0], aztec_version])
    }

    #[external("utility")]
    unconstrained fn get_chain_id_unconstrained(aztec_version: Field) -> pub Field {
        get_chain_id(aztec_version)
    }

    #[external("utility")]
    unconstrained fn get_version() -> Field {
        self.context.version()
    }

    //------old warptoad name getter (still used in ui and test)-------------------------------------------
    #[external("utility")]
    unconstrained fn public_get_name() -> pub FieldCompressedString {
        self.storage.name.read()
    }

    #[external("utility")]
    unconstrained fn public_get_symbol() -> pub FieldCompressedString {
        self.storage.symbol.read()
    }

    #[external("utility")]
    unconstrained fn get_decimals() -> pub u8 {
        self.storage.decimals.read()
    }

    //----------these are from wonderland, the above does the exact same but is our own naming and should be removed but ui and test still use it :/
    /// @notice Returns the name of the token
    /// @return The name of the token
    #[external("public")]
    #[view]
    fn name() -> FieldCompressedString {
        self.storage.name.read()
    }

    /// @notice Returns the symbol of the token
    /// @return The symbol of the token
    #[external("public")]
    #[view]
    fn symbol() -> FieldCompressedString {
        self.storage.symbol.read()
    }

    /// @notice Returns the decimals of the token
    /// @return The decimals of the token
    #[external("public")]
    #[view]
    fn decimals() -> u8 {
        self.storage.decimals.read()
    }
    //-------------------------------------------------

    // @TODO this a duplicate of balance_of_private and should be removed. However tests and ui still use this function!
    #[external("utility")]
    unconstrained fn balance_of(owner: AztecAddress) -> u128 {
        let balance = self.storage.balances.at(owner).balance_of();
        balance
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        let balance = self.storage.balances.at(owner).balance_of();
        balance
    }

    #[external("private")]
    fn get_notes_util(slot: Field) -> BoundedVec<RetrievedNote<WarpToadNote>, 16> {
        let owner = self.context.msg_sender().unwrap();
        let retrieved_notes = self.storage.commitments.at(owner).get_notes(
            NoteGetterOptions::<WarpToadNote, 4, _, _>::new(),
        );
        retrieved_notes
    }

    #[external("utility")]
    unconstrained fn nullifier_exists(nullifier: Field) -> bool {
        check_nullifier_exists(nullifier)
    }

    //------------TODO to be implemented -------

    /// @notice Returns the public balance of `owner`
    /// @param owner The address of the owner
    /// @return The balance of the public balance of `owner`
    #[external("public")]
    #[view]
    fn balance_of_public(owner: AztecAddress) -> u128 {
        696969696 //TODO not implemented (azguard needs this)
    }

    #[external("private")]
    fn transfer_private_to_public(
        from: AztecAddress, // TODO unused
        to: AztecAddress,
        amount: u128,
        _nonce: Field, // TODO unused
    ) {}

    #[external("private")]
    fn transfer_public_to_private(
        from: AztecAddress, // TODO unused
        to: AztecAddress,
        amount: u128,
        _nonce: Field, // TODO unused
    ) {}

    #[external("public")]
    fn transfer_public_to_public(
        from: AztecAddress, // TODO unused
        to: AztecAddress,
        amount: u128,
        _nonce: Field, // TODO unused
    ) {}

    //---------------------------

}
