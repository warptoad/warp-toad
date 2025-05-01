mod config;

use dep::aztec::macros::aztec;

// Minimal implementation of the message bridge that can move messages between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to

#[aztec]
pub contract L2AztecRootBridgeAdapter {
    use crate::config::Config;

    use dep::aztec::prelude::{
        EthAddress,  PublicImmutable, PublicMutable,
    };

	use dep::aztec::oracle::debug_log::{ debug_log_format };
	use dep::aztec::protocol_types::hash::sha256_to_field;

    use dep::aztec::macros::{
        functions::{initializer, public, utility, view},
        storage::storage,
    };

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
        temp_testing_giga_root: PublicMutable<Field, Context>,
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
    fn update_gigaroot(new_gigaroot: Field, message_leaf_index: Field) {
        // `secret` is used to make the consumption of a message on the L2 private.
        // we don't care about keeping message consumption private at all so to
        // simplify things we hardcode the secret here and the secret_hash in the L1
        // contract.
        let secret: Field = 0;

        let content_hash = new_gigaroot;

        let config = storage.config.read();

        // Consume message and emit nullifier
        context.consume_l1_to_l2_message(content_hash, secret, config.portal, message_leaf_index);

        // TODO: call function on WarpToadCore
        storage.temp_testing_giga_root.write(new_gigaroot);
    }

    // temp for testing.  Need to call 2 functions to progress the L2 2 blocks
    #[public]
    fn count(new_count: Field) {
        storage.counter.write(new_count);
    }

    #[utility]
    unconstrained fn get_giga_root() -> pub Field {
        storage.temp_testing_giga_root.read()
    }

    // creates a L2 to L1 message publicly
    // Sends the most recent state root to L1 to be consumed by AztecRootBridge.sol
	// Aztec differs from other L2s we'll support in that we can just pass the chain's 
	// entire state root
    #[public]
    fn send_root_to_l1(state_root: Field) {
        let config = storage.config.read();

        let block_number = context.block_number();
		// TODO: get the current note hash tree root
		// let block_header = context.get_block_header_at(block_number);
		// let state_root = block_header.state.partial.note_hash_tree.root;

        let contentHash = get_content_hash(state_root, block_number);

        // Send an L2 to L1 message
        context.message_portal(config.portal, contentHash);
    }

    // Adds this hash to the message portal.  The L1 contract should be able to reconstruct this same hash
	#[public]
    fn get_content_hash(local_root: Field, block_number: Field) -> pub Field {
		debug_log_format("block_number: {0}", [block_number]);
		debug_log_format("local_root: {0}", [local_root]);
        let mut hash_bytes = [0; 64];
        let local_root_bytes: [u8; 32] = local_root.to_be_bytes();
        let block_number_bytes: [u8; 32] = block_number.to_be_bytes();

        for i in 0..32 {
            hash_bytes[i] = local_root_bytes[i];
            hash_bytes[i + 32] = block_number_bytes[i];
        }

        let content_hash = sha256_to_field(hash_bytes);
		debug_log_format("content_hash: {0}", [content_hash]);
        content_hash

    }

}
