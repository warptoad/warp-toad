use dep::poseidon::poseidon;
use dep::aztec::{
    //macros::notes::note,
    context::{PrivateContext},
    note::note_interface::{NoteHash},
    macros::notes::{custom_note},
    protocol_types::{
        //address::AztecAddress, 
        traits::{Packable, Serialize}
        }};
//use aztec::note::note_interface::NoteHash::{compute_nullifier, compute_note_hash};

#[derive(Eq, Serialize,Packable)]
#[custom_note]
pub struct WarpToadNote {
    nullifier_preimage: Field,
    secret: Field,
    chain_id: Field, 
    amount: Field
}

impl WarpToadNote {
    pub fn new(nullifier_preimage: Field, secret: Field, chain_id: Field, amount: Field) -> Self {
        WarpToadNote { nullifier_preimage, secret, chain_id, amount }
    }
}

impl NoteHash for WarpToadNote {
    // just ignoring storage_slot for now
    fn compute_note_hash(self, storage_slot: Field) -> Field {
        let pre_commitment_hash: Field =  poseidon::bn254::hash_3([self.nullifier_preimage,self.secret, self.chain_id]);
        let _ = storage_slot;
        poseidon::bn254::hash_2([pre_commitment_hash,self.amount])
    }

    fn compute_nullifier(self,context: &mut PrivateContext, note_hash_for_nullify: Field) -> Field {
        let _ = context;
        let _ = note_hash_for_nullify;
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }

    unconstrained fn compute_nullifier_unconstrained(self, note_hash_for_nullify: Field) -> Field {
        let _ = note_hash_for_nullify;
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }
}
