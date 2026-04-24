use aztec::macros::aztec;
mod warptoad_note;

// token functionality based of: https://github.com/defi-wonderland/aztec-standards/tree/v2.0.3/src/token_contract
#[aztec]
pub contract WarpToadCore {

    // local dep
    use crate::warptoad_note::WarpToadNote;
    use constants::{EVM_TREE_DEPTH, GIGA_TREE_DEPTH};
    use hashing::{Evm_merkle_data, evm_merkle_verify, hash_commitment};

    use compressed_string::{CompressedString, FieldCompressedString};
    use poseidon::poseidon;

    use aztec::{
        history::storage::public_storage_historical_read,
        macros::{
            events::event,
            functions::{external, initializer, view},
            storage::storage,
        },
        messages::message_delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
        oracle::get_membership_witness::get_note_hash_membership_witness,
        oracle::nullifiers::check_nullifier_exists,
        protocol::{
            address::{AztecAddress, EthAddress},
            constants::NOTE_HASH_TREE_HEIGHT,
            merkle_tree::MembershipWitness,
            traits::{Serialize, Deserialize, Packable},
        },
        state_vars::{Owned, PrivateSet, PublicImmutable, PublicMutable, StateVariable},
    };
    use balance_set::BalanceSet;

    // Wrapper struct returned by `get_notes_with_nonces`: a commitment note alongside its
    // settled note_nonce, which the JS caller needs to compute the unique note hash for the
    // historical merkle inclusion proof of the note in the Aztec note hash tree.
    #[derive(Eq, Serialize, Deserialize, Packable)]
    pub struct WarpToadNoteWithNonce {
        note: WarpToadNote,
        note_nonce: Field,
    }

    // ---- Events
    #[event]
    struct Transfer {
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
    }

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
    }

    // ---- Storage
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

    #[initializer]
    #[external("public")]
    fn constructor(native_token: EthAddress, _name: str<31>, _symbol: str<31>, _decimals: u8) {
        self.storage.native_token.initialize(native_token);
        self.storage.name.initialize(FieldCompressedString::from_string(_name));
        self.storage.symbol.initialize(FieldCompressedString::from_string(_symbol));
        self.storage.decimals.initialize(_decimals);
        self.storage.deployer.initialize(self.msg_sender());
    }

    #[external("public")]
    fn initialize(_giga_root_provider: AztecAddress, _l1_bridge_adapter: EthAddress) {
        assert(
            self.msg_sender() == self.storage.deployer.read(),
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
            self.msg_sender() == self.storage.giga_root_provider.read(),
            "not giga_root_provider",
        );
        self.storage.giga_root.write(giga_root);
        self.emit(
            NewGigaRoot { giga_root, block_number: self.context.block_number() },
        );
    }

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
        let historical_header = self.context.get_block_header_at(block_number);
        let giga_root: Field = public_storage_historical_read(
            historical_header,
            self.storage.giga_root.get_storage_slot(),
            self.context.this_address(),
        );

        let (commitment, nullifier) =
            hash_commitment(nullifier_preimage, secret, chain_id, (amount as Field));

        // verify origin_local_root is part of giga_root
        evm_merkle_verify(giga_root, origin_local_root, giga_merkle_data);
        // verify commitment is part of origin_local_root
        evm_merkle_verify(origin_local_root, commitment, evm_merkle_data);

        self.context.push_nullifier(nullifier);

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
        let sender = self.msg_sender();
        let recipient = sender;

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

    #[external("private")]
    fn transfer_private_to_private(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        _nonce: Field,
    ) {
        let from = self.msg_sender();

        self.storage.balances.at(from).sub(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        self.storage.balances.at(to).add(amount).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        self.emit(
            Transfer { from, to, amount },
        )
            .deliver_to(to, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn increase_allowance(spender: AztecAddress, added: u128) {
        let owner = self.msg_sender();
        self.storage.allowances.at(owner).add(added).deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
        let _ = added;
        self.emit(Approval { owner, spender, amount: added }).deliver_to(
            owner,
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );
    }

    #[external("private")]
    fn decrease_allowance(spender: AztecAddress, subtracted: u128) {
        let owner = self.msg_sender();
        self.storage.allowances.at(owner).sub(subtracted).deliver(
            MessageDelivery.ONCHAIN_UNCONSTRAINED,
        );
        self.emit(
            Approval { owner, spender, amount: 0u128 },
        )
            .deliver_to(owner, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn transfer_from(owner: AztecAddress, to: AztecAddress, amount: u128) {
        let spender = self.msg_sender();
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
        let historical_header = self.context.get_block_header_at(block_number);
        public_storage_historical_read(
            historical_header,
            self.storage.giga_root.get_storage_slot(),
            self.context.this_address(),
        )
    }

    #[external("utility")]
    unconstrained fn get_giga_root() -> pub Field {
        self.storage.giga_root.read()
    }

    // Note: get_note_proof moved to private since UtilityContext can't access block headers.
    // Alternatively, use aztec.js client-side to fetch membership witnesses.
    #[external("private")]
    fn get_note_proof(
        block_number: u32,
        note_hash: Field,
    ) -> pub MembershipWitness<NOTE_HASH_TREE_HEIGHT> {
        let block_header = self.context.get_block_header_at(block_number);
        // Safety: oracle call to get membership witness from the note hash tree
        unsafe { get_note_hash_membership_witness(block_header, note_hash) }
    }

    #[external("utility")]
    unconstrained fn get_l1_bridge_adapter() -> pub EthAddress {
        self.storage.l1_bridge_adapter.read()
    }

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

    #[external("public")]
    #[view]
    fn name() -> FieldCompressedString {
        self.storage.name.read()
    }

    #[external("public")]
    #[view]
    fn symbol() -> FieldCompressedString {
        self.storage.symbol.read()
    }

    #[external("public")]
    #[view]
    fn decimals() -> u8 {
        self.storage.decimals.read()
    }

    #[external("utility")]
    unconstrained fn balance_of(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }

    #[external("utility")]
    unconstrained fn balance_of_private(owner: AztecAddress) -> u128 {
        self.storage.balances.at(owner).balance_of()
    }

    // Note: In v4, get_notes returns ConfirmedNote which wraps the actual note.
    // We use pop_notes to consume and return the raw notes directly.
    #[external("private")]
    fn get_notes_util(slot: Field) -> BoundedVec<WarpToadNote, 16> {
        let owner = self.msg_sender();
        // pop_notes consumes the notes (nullifies them) and returns raw note data
        let notes = self.storage.commitments.at(owner).pop_notes(
            NoteGetterOptions::<WarpToadNote, 4, _, _>::new(),
        );
        notes
    }

    // Returns the user's commitment notes alongside their settled note nonces. Unlike
    // `get_notes_util`, this uses `get_notes` (read-only, does NOT nullify the notes),
    // so the caller can later build a historical merkle inclusion proof of the note in
    // the Aztec note hash tree. The note_nonce is required on the JS side to compute
    // the unique note hash that the L1 ZK proof will verify membership for.
    #[external("private")]
    fn get_notes_with_nonces(_slot: Field) -> pub BoundedVec<WarpToadNoteWithNonce, 16> {
        let owner = self.msg_sender();
        let confirmed_notes = self.storage.commitments.at(owner).get_notes(
            NoteGetterOptions::<WarpToadNote, 4, _, _>::new(),
        );
        let mut result: BoundedVec<WarpToadNoteWithNonce, 16> = BoundedVec::new();
        for i in 0..16 {
            if i < confirmed_notes.len() {
                let cn = confirmed_notes.get_unchecked(i);
                let nonce = cn.metadata.to_settled().note_nonce();
                result.push(WarpToadNoteWithNonce { note: cn.note, note_nonce: nonce });
            }
        }
        result
    }

    #[external("utility")]
    unconstrained fn nullifier_exists(nullifier: Field) -> bool {
        check_nullifier_exists(nullifier)
    }

    #[external("public")]
    #[view]
    fn balance_of_public(owner: AztecAddress) -> u128 {
        696969696 //TODO not implemented
    }

    #[external("private")]
    fn transfer_private_to_public(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        _nonce: Field,
    ) {}

    #[external("private")]
    fn transfer_public_to_private(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        _nonce: Field,
    ) {}

    #[external("public")]
    fn transfer_public_to_public(
        from: AztecAddress,
        to: AztecAddress,
        amount: u128,
        _nonce: Field,
    ) {}
}
