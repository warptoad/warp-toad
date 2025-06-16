use poseidon::poseidon;
use dep::aztec::{
    //macros::notes::note,
    protocol_types::{
        //address::AztecAddress, 
        traits::Serialize
        }};
use dep::aztec::macros::notes::{custom_note};
use dep::aztec::note::note_interface::{NoteHash};
use dep::aztec::context::{PrivateContext};
//use aztec::note::note_interface::NoteHash::{compute_nullifier, compute_note_hash};

#[custom_note]
#[derive(Eq, Serialize)]
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
        poseidon::bn254::hash_2([pre_commitment_hash,self.amount])
    }

    fn compute_nullifier(self,context: &mut PrivateContext, note_hash_for_nullify: Field) -> Field {
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }

    unconstrained fn compute_nullifier_unconstrained(self, note_hash_for_nullify: Field) -> Field {
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }
}
