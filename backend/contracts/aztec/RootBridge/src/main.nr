mod config;

use dep::aztec::macros::aztec;

// Minimal implementation of the message bridge that can move messages between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to

#[aztec]
pub contract RootBridge {
    use crate::config::Config;

    use dep::aztec::prelude::{AztecAddress, EthAddress, PublicMutable, PublicImmutable};

    use dep::aztec::macros::{functions::{utility, initializer, private, public, view}, storage::storage};

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        config: PublicImmutable<Config, Context>,
		temp_testing_giga_root: PublicMutable<Field, Context>,
		// temp for testing
		counter: PublicMutable<Field, Context>
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
    #[public]
    fn send_root_to_l1(local_root: Field) {
        let config = storage.config.read();

        // TODO: get most recent state root from WarpToadCore
        let content = local_root;

        // Send an L2 to L1 message
        context.message_portal(config.portal, content);
    }
}
