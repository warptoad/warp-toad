use dep::aztec::{
    context::{PrivateContext, PublicContext},
    encrypted_logs::{
        log_assembly_strategies::default_aes128, log_type::PARTIAL_NOTE_PRIVATE_LOG_TYPE_ID,
    },
    keys::getters::{get_nsk_app, get_public_keys},
    macros::notes::custom_note,
    note::note_interface::{NoteHash, NoteType},
    oracle::random::random,
    protocol_types::{
        address::AztecAddress,
        constants::{GENERATOR_INDEX__NOTE_HASH, GENERATOR_INDEX__NOTE_NULLIFIER},
        hash::poseidon2_hash_with_separator,
        traits::{Deserialize, Hash, Packable, Serialize},
        utils::arrays::array_concat,
    },
};


#[custom_note]
#[derive(Eq, Serialize)]
pub struct WarpToadNote {
    // owner: AztecAddress,
    // randomness: Field,
    // token_id: Field,
    nullifier_preimg: Field,
    secret: Field,
    destination_chain_id: Field,
    amount: u64,
}

impl NoteHash for WarpToadNote {
    fn compute_note_hash(self, storage_slot: Field) -> Field {

        let private_content = WarpToadNotePrivateContent { nullifier_preimg: self.nullifier_preimg, secret: self.secret, destination_chain_id: self.destination_chain_id  };
        let partial_note =  WarpToadNotePreCommitment { preCommitment: private_content.compute_partial_commitment(storage_slot) };
        partial_note.compute_complete_note_hash(self.amount)
    }

    fn compute_nullifier(self,context: &mut PrivateContext,note_hash_for_nullify: Field,
    ) -> Field {
        // let owner_npk_m = get_public_keys(self.owner).npk_m;
        // let owner_npk_m_hash = owner_npk_m.hash();
        // let secret = context.request_nsk_app(owner_npk_m_hash);
        // poseidon2_hash_with_separator([note_hash_for_nullify, secret],GENERATOR_INDEX__NOTE_NULLIFIER,)

        poseidon2_hash_with_separator([self.nullifier_preimg],GENERATOR_INDEX__NOTE_NULLIFIER)
    }

    unconstrained fn compute_nullifier_unconstrained(self, note_hash_for_nullify: Field) -> Field {
        // let owner_npk_m = get_public_keys(self.owner).npk_m;
        // let owner_npk_m_hash = owner_npk_m.hash();
        // let secret = get_nsk_app(owner_npk_m_hash);
        // poseidon2_hash_with_separator([note_hash_for_nullify, secret],GENERATOR_INDEX__NOTE_NULLIFIER,)
        poseidon2_hash_with_separator([self.nullifier_preimg],GENERATOR_INDEX__NOTE_NULLIFIER)
    }
}

impl WarpToadNote {
    pub fn new(nullifier_preimg: Field, secret: Field, destination_chain_id: Field, amount: u64,) -> Self {
        Self { nullifier_preimg, secret, destination_chain_id,  amount}
    }

    // pub fn get_token_id(self) -> Field {
    //     self.token_id
    // }

    pub fn partial(
        // owner: AztecAddress,
        storage_slot: Field,
        context: &mut PrivateContext,
        // recipient: AztecAddress,
        // sender: AztecAddress,
        nullifier_preimg: Field,
        secret: Field,
        destination_chain_id: Field

    ) -> WarpToadNotePreCommitment {
        //let randomness = unsafe { random() };
        //let commitment = WarpToadNotePrivateContent { owner, randomness }.compute_partial_commitment(storage_slot);
        let preCommitment = WarpToadNotePrivateContent { nullifier_preimg, secret,destination_chain_id }.compute_partial_commitment(storage_slot);

        // we dont need log?        
        // let private_log_content = PrivateNFTPartialNotePrivateLogContent {
        //     owner,
        //     randomness,
        //     public_log_tag: commitment,
        // };

        // let encrypted_log = default_aes128::note::compute_partial_note_log(
        //     private_log_content,
        //     storage_slot,
        //     recipient,
        //     sender,
        // );
        // context.emit_private_log(encrypted_log);

        WarpToadNotePreCommitment { preCommitment }
    }
}


#[derive(Packable)]
struct WarpToadNotePrivateContent {
    nullifier_preimg: Field,
    secret: Field,
    destination_chain_id: Field
}

impl WarpToadNotePrivateContent {
    fn compute_partial_commitment(self, storage_slot: Field) -> Field {

        // TODO do old  poseidon and use hash_3([self.nullifier_preimg, self.secret, self.destination_chain_id]) instead
        // is okay to drop GENERATOR_INDEX__NOTE_HASH??
        poseidon2_hash_with_separator(array_concat(self.pack(), [storage_slot]),GENERATOR_INDEX__NOTE_HASH)
    }
}

// #[derive(Packable)]
// struct PrivateNFTPartialNotePrivateLogContent {
//     nullifier_preimg: Field,
//     secret: Field,
//     destination_chain_id: Field
// }

// impl NoteType for PrivateNFTPartialNotePrivateLogContent {
//     fn get_id() -> Field {
//         WarpToadNote::get_id()
//     }
// }

#[derive(Packable, Serialize, Deserialize)]
pub struct WarpToadNotePreCommitment {
    preCommitment: Field,
}

impl WarpToadNotePreCommitment {
    pub fn commitment(self) -> Field {
        self.preCommitment
    }
}

impl WarpToadNotePreCommitment {
    /// Completes the partial note, creating a new note that can be used like any other NFTNote.
    pub fn complete(self, amount: u64, context: &mut PublicContext) {
        //context.emit_public_log(self.compute_note_completion_log(token_id));
        context.push_note_hash(self.compute_complete_note_hash(amount));
    }

    // fn compute_note_completion_log(self, token_id: Field) -> [Field; 2] {
    //     [self.commitment, token_id]
    // }


    // TODO use old poseidon? and drop the GENERATOR_INDEX__NOTE_HASH? is that safe?
    fn compute_complete_note_hash(self, amount: u64) -> Field {
        poseidon2_hash_with_separator([self.preCommitment, amount as Field], GENERATOR_INDEX__NOTE_HASH)
    }
}
