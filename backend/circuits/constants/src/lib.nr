// use aztec::protocol_types::{constants::NOTE_HASH_TREE_HEIGHT};

pub global AZTEC_TREE_DEPTH:u32 = 40;//NOTE_HASH_TREE_HEIGHT; //TODO check maybe get from import?
pub global EVM_TREE_DEPTH: u32 = 32;
pub global EVM_TREE_MAX_LEAVES: Field = 2.pow_32(EVM_TREE_DEPTH as Field);
pub global GIGA_TREE_DEPTH: u32 = 5;