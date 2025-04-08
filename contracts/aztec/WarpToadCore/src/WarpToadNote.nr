use dep::aztec::{
    macros::notes::custom_note,
    prelude::{NoteHash, PrivateContext},
    protocol_types::{
        constants::{GENERATOR_INDEX__NOTE_HASH, GENERATOR_INDEX__NOTE_NULLIFIER},
        hash::poseidon2_hash_with_separator,
        traits::Packable,
        utils::arrays::array_concat,
    },
};
use dep::std::mem::{zeroed};
use std::hash::{poseidon};

// inspired by: https://github.com/AztecProtocol/aztec-packages/blob/v0.82.3/noir-projects/noir-contracts/contracts/token_blacklist_contract/src/types/transparent_note.nr


pub struct ToadWarpNotePreCommitment {
    nullifier_preimg: Field, 
    secret: Field,
    destination_chain_id: Field
}

#[custom_note]
#[derive(Eq)]
pub struct ToadWarpNote {
    amount: u128,
    pre_commitment: Field, //secret_hash in original transparent note (its the same thing)
}

impl NoteHash for ToadWarpNote {
    fn compute_note_hash(nullifier_preimg: Field) -> Field {
        poseidon::bn254::hash_3(nullifier_preimg)
    }

    // Computing a nullifier in a transparent note is not guarded by making secret a part of the nullifier preimage (as
    // is common in other cases) and instead is guarded by the functionality of "redeem_shield" function. There we do
    // the following:
    //      1) We pass the secret as an argument to the function and use it to compute a secret hash,
    //      2) we fetch a note via the "get_notes" oracle which accepts the secret hash as an argument,
    //      3) the "get_notes" oracle constrains that the secret hash in the returned note matches the one computed in
    //         circuit.
    // This achieves that the note can only be spent by the party that knows the secret.
    fn compute_nullifier(nullifier_preimg:Field) -> Field {
         poseidon::bn254::hash_1([nullifier_preimg])
    }

    unconstrained fn compute_nullifier_unconstrained(self, note_hash_for_nullify: Field) -> Field {
        // compute_nullifier ignores context so we can reuse it here
        self.compute_nullifier(zeroed(), note_hash_for_nullify)
    }
}

impl ToadWarpNote {
    // CONSTRUCTORS
    pub fn new(amount: u128, secret_hash: Field) -> Self {
        ToadWarpNote { amount, secret_hash }
    }
}
