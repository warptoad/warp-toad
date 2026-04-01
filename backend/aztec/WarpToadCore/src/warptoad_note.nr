use poseidon::poseidon;
use aztec::{
    context::PrivateContext,
    note::note_interface::NoteHash,
    macros::notes::custom_note,
    protocol::{
        address::AztecAddress,
        traits::{Packable, Serialize, Deserialize},
    },
};

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
    fn compute_note_hash(self, owner: AztecAddress, storage_slot: Field, randomness: Field) -> Field {
        let pre_commitment_hash: Field = poseidon::bn254::hash_3([self.nullifier_preimage, self.secret, self.chain_id]);
        let _ = storage_slot;
        let _ = randomness;
        let _ = owner;
        poseidon::bn254::hash_2([pre_commitment_hash, self.amount])
    }

    fn compute_nullifier(self, context: &mut PrivateContext, owner: AztecAddress, note_hash_for_nullification: Field) -> Field {
        let _ = context;
        let _ = note_hash_for_nullification;
        let _ = owner;
        poseidon::bn254::hash_1([self.nullifier_preimage])
    }

    unconstrained fn compute_nullifier_unconstrained(self, owner: AztecAddress, note_hash_for_nullification: Field) -> Option<Field> {
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
