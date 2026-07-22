use aztec::macros::aztec;

// Minimal implementation of the message bridge that can move messages between L1 <> L2.
// The bridge has a corresponding Portal contract on L1 that it is attached to

#[aztec]
pub contract L2AztecBridgeAdapter {

    use aztec::{
        protocol::address::{AztecAddress, EthAddress},
        protocol::hash::sha256_to_field,
        state_vars::{PublicImmutable, PublicMutable},
        macros::{functions::{external, initializer, view}, storage::storage},
    };

    // Storage structure, containing all storage, and specifying what slots they use.
    #[storage]
    struct Storage<Context> {
        l1BridgeAdapter: PublicImmutable<EthAddress, Context>,
        // temp for testing
        counter: PublicMutable<Field, Context>,
    }

    // Constructs the contract.
    #[external("public")]
    #[initializer]
    fn constructor(l1BridgeAdapter: EthAddress) {
        self.storage.l1BridgeAdapter.initialize(l1BridgeAdapter);
    }

    #[external("public")]
    #[view]
    fn get_l1BridgeAdapter_public() -> EthAddress {
        self.storage.l1BridgeAdapter.read()
    }

    // Consumes a L1->L2 message and calls the WarpToadCore contract to update the GigaRoot
    #[external("public")]
    fn receive_giga_root(new_gigaroot: Field, message_leaf_index: Field, warpToadCore: AztecAddress) {
        let secret: Field = 0;
        let content_hash = new_gigaroot;
        let l1BridgeAdapter = self.storage.l1BridgeAdapter.read();

        // Consume message and emit nullifier
        self.context.consume_l1_to_l2_message(content_hash, [secret], l1BridgeAdapter, message_leaf_index);
        //call warptoad!
        WarpToadCore::WarpToadCore::at(warpToadCore).receive_giga_root(new_gigaroot).call(self.context);
    }

    // temp for testing. Need to call 2 functions to progress the L2 2 blocks
    #[external("public")]
    fn count(new_count: Field) {
        self.storage.counter.write(new_count);
    }

    // creates a L2 to L1 message
    #[external("private")]
    fn send_root_to_l1(block_number: u32) {
        let l1BridgeAdapter = self.storage.l1BridgeAdapter.read();

        let block_header = self.context.get_block_header_at(block_number);

        let root = block_header.state.partial.note_hash_tree.root;

        let mut hash_bytes = [0; 64];
        let root_bytes: [u8; 32] = root.to_be_bytes();
        let block_number_bytes: [u8; 32] = (block_number as Field).to_be_bytes();

        for i in 0..32 {
            hash_bytes[i] = root_bytes[i];
            hash_bytes[i + 32] = block_number_bytes[i];
        }

        let content_hash = sha256_to_field(hash_bytes);

        // Send an L2 to L1 message
        self.context.message_portal(l1BridgeAdapter, content_hash);
    }

    #[external("utility")]
    unconstrained fn get_content_hash(block_number: u32, root: Field) -> pub Field {
        let mut hash_bytes = [0; 64];
        let root_bytes: [u8; 32] = root.to_be_bytes();
        let block_number_bytes: [u8; 32] = (block_number as Field).to_be_bytes();

        for i in 0..32 {
            hash_bytes[i] = root_bytes[i];
            hash_bytes[i + 32] = block_number_bytes[i];
        }

        let content_hash = sha256_to_field(hash_bytes);
        content_hash
    }

}
