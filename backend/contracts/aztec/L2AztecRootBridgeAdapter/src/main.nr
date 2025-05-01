mod config;

use dep::aztec::macros::aztec;
use WarpToadCore::{WarpToadCore};

// Minimal implementation of the message bridge that can move messages between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to

#[aztec]
pub contract L2AztecRootBridgeAdapter {
    use crate::config::Config;

    use dep::aztec::prelude::{
        EthAddress,  PublicImmutable, PublicMutable, AztecAddress
    };

	use dep::aztec::protocol_types::hash::sha256_to_field;

    use dep::aztec::macros::{
        functions::{initializer, private, public, utility, view},
        storage::storage,
    };
    // use aztec::prelude::{
    //     AztecAddress, EthAddress, Map, PrivateMutable, PrivateSet, PublicImmutable, PublicMutable,
    // };

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        // temp for testing
        counter: PublicMutable<Field, Context>,
    }

    // Constructs the contract.
    #[public]
    #[initializer]
    fn constructor(portal: EthAddress) {
        storage.config.initialize(Config { portal });
    }

    #[public]
    #[view]
    fn get_config_public() -> Config {
        storage.config.read()
    }

    // Consumes a L1->L2 message and calls the WarpToadCore contract to update the GigaRoot
    #[public]
    fn update_gigaroot(new_gigaroot: Field, message_leaf_index: Field, warpToadCore:AztecAddress) {
        // `secret` is used to make the consumption of a message on the L2 private.
        // we don't care about keeping message consumption private at all so to
        // simplify things we hardcode the secret here and the secret_hash in the L1
        // contract.
        let secret: Field = 0;

        let content_hash = new_gigaroot;

        let config = storage.config.read();

        // Consume message and emit nullifier
        context.consume_l1_to_l2_message(content_hash, secret, config.portal, message_leaf_index);
        //call warptoad!
        WarpToadCore::WarpToadCore::at(warpToadCore).receive_giga_root(new_gigaroot).call(&mut context);
    }

    // temp for testing.  Need to call 2 functions to progress the L2 2 blocks
    #[public]
    fn count(new_count: Field) {
        storage.counter.write(new_count);
    }

    // creates a L2 to L1 message 
    // Sends the most recent state root to L1 to be consumed by AztecRootBridge.sol
	// Aztec differs from other L2s we'll support in that we can just pass the chain's 
	// entire state root
	// Needs to be private because accessing `block_header.state.partial.note_hash_tree.root` 
	// can only be done from a private context
    #[private]
    fn send_root_to_l1() {
        let config = storage.config.read();

		// Returns the header of a block whose state is used during private execution (not the block the transaction is included in).
		let block_header = context.get_block_header();
		let block_number = block_header.global_variables.block_number;
		let state_root = block_header.state.partial.note_hash_tree.root;

        let mut hash_bytes = [0; 64];
        let state_root_bytes: [u8; 32] = state_root.to_be_bytes();
        let block_number_bytes: [u8; 32] = block_number.to_be_bytes();

        for i in 0..32 {
            hash_bytes[i] = state_root_bytes[i];
            hash_bytes[i + 32] = block_number_bytes[i];
        }

        let content_hash = sha256_to_field(hash_bytes);

        // Send an L2 to L1 message
        context.message_portal(config.portal, content_hash);
    }

}
