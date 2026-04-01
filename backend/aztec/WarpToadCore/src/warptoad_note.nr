use dep::poseidon::poseidon;
use dep::aztec::{
    //macros::notes::note,
    context::{PrivateContext},
    note::note_interface::{NoteHash},
    macros::notes::{custom_note},
    protocol_types::{
        address::AztecAddress, 
        traits::{Packable, Serialize, Deserialize}
        }};
//use aztec::note::note_interface::NoteHash::{compute_nullifier, compute_note_hash};

#[derive(Eq, Serialize, Deserialize)]
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
    // TODO use all input properly. I dont see issues with ignoring how to properly use these. But that might change in the future? But that does adds additional data that needs to be proven on EVM
    // storage_slot: needs to just be set and used. So multiple state vars can use WarpToadNote in the same contract. 
    // owner: We need to switch to verifying signatures. This is fucking cringe how it needs to be a AztecAddress?? We for sure need a secp256k1 so user can just use metamask and ledger!
    // randomness: When we switch to signature and pubKeys, we also need randomness ofc!
    fn compute_note_hash(self, owner:AztecAddress, storage_slot: Field, randomness:Field) -> Field {
        let pre_commitment_hash: Field =  poseidon::bn254::hash_3([self.nullifier_preimage,self.secret, self.chain_id]);
        // a little silly to not do anything with this but older version of aztec didn't have these inputs
        let _ = storage_slot;
        let _ = randomness;
        let _ = owner;
        poseidon::bn254::hash_2([pre_commitment_hash,self.amount])
    }

    fn compute_nullifier(self,context: &mut PrivateContext,owner:AztecAddress, note_hash_for_nullification: Field) -> Field {
        let _ = context;
        let _ = note_hash_for_nullification;
        let _ = owner;
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }

    unconstrained fn compute_nullifier_unconstrained(self,owner:AztecAddress, note_hash_for_nullification: Field) -> Option<Field> {
        let _ = note_hash_for_nullification;
        let _ = owner;
        Option::some(poseidon::bn254::hash_1([self.nullifier_preimage]))
    }
}

impl Packable for WarpToadNote {
    let N: u32 = 4;

    fn pack(self) -> [Field; Self::N] {
        [self.nullifier_preimage, self.secret, self.chain_id, self.amount]
    }

    fn unpack(packed: [Field; Self::N]) -> Self {
        WarpToadNote {
            nullifier_preimage: packed[0],
            secret: packed[1],
            chain_id: packed[2],
            amount: packed[3],
        }
    }
}