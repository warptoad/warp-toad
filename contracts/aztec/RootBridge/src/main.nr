mod config;

use dep::aztec::macros::aztec;

// Minimal implementation of the message bridge that can move funds between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to

#[aztec]
pub contract RootBridge {
    use crate::config::Config;

    use dep::aztec::prelude::{AztecAddress, EthAddress, PublicImmutable};

    // use dep::token_portal_content_hash_lib::{
    //     get_mint_to_private_content_hash, get_mint_to_public_content_hash,
    //     get_withdraw_content_hash,
    // };

    use dep::aztec::macros::{functions::{initializer, private, public, view}, storage::storage};

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
    }

    // fn double(x: Field) -> pub Field { x * 2 }
    // fn triple(x: Field) -> pub Field { x * 3 }
    // fn quadruple(x: Field) -> pub Field { double(double(x)) }
}
