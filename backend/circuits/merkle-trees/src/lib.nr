// Vendored from privacy-scaling-explorations/zk-kit.noir (packages/merkle-trees, branch main).
// Patched for Noir beta.22: to_le_bits/to_be_bits now return [bool; N] (the u1 type was removed).
// The sparse_merkle module is dropped here; warptoad only uses the dense MerkleTree.
pub mod types;
pub mod merkle;
