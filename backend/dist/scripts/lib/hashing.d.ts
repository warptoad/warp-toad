import { AztecAddress, Fr } from '@aztec/aztec.js';
export declare function hashPreCommitment(nullifierPreimage: bigint, secret: bigint, chainId: bigint): bigint;
export declare function hashCommitment(preCommitment: bigint, amount: bigint): bigint;
export declare function hashCommitmentFromNoteItems(noteItems: Fr[]): bigint;
export declare function hashNullifier(nullifierPreimage: bigint): bigint;
/**
 * for aztec note hashing
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L48
 */
export declare function hashNoteHashNonce(first_nullifier_in_tx: bigint, note_index_in_tx: bigint): Promise<bigint>;
export declare function poseidon2HashWithSeparator(inputs: bigint[], separator: bigint): Promise<bigint>;
export declare function findNoteHashIndex(contractAddress: AztecAddress, noteHashesInTx: Fr[], plainNoteHash: Fr, firstNullifierInTx: Fr): Promise<number>;
/**
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/c99fb41148ab9fad92d9ab0ff90dc64bd44afdc8/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L57
 * @param contractAddress
 * @param plainNoteHash
 * @param firstNullifierInTx
 * @param index
 */
export declare function hashUniqueNoteHash(nonce: bigint, siloed_note_hash: bigint): Promise<bigint>;
/**
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/c99fb41148ab9fad92d9ab0ff90dc64bd44afdc8/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L62
 * @param contractAddress
 * @param plainNoteHash
 */
export declare function hashSiloedNoteHash(contractAddress: bigint, plainNoteHash: bigint): Promise<bigint>;
/**
 * uses findNoteHashIndex to go over every note has in the noteHashesInTx array to find the correct nonce
 * and then uses that to return which hash is correct
 * @param contractAddress
 * @param noteHashesInTx
 * @param plainNoteHash
 * @param firstNullifierInTx
 * @returns
 */
export declare function findUniqueNoteHash(contractAddress: AztecAddress, noteHashesInTx: Fr[], plainNoteHash: Fr, firstNullifierInTx: Fr): Promise<bigint>;
export declare function attemptHasUniqueNoteHash(contractAddress: AztecAddress, firstNullifierInTx: Fr, plainNoteHash: Fr, index: number | bigint): Promise<bigint>;
