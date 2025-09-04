import { poseidon1, poseidon2, poseidon3 } from "poseidon-lite";
// we really need hardhat 3 to be in beta so we can just put `type:"module"` in our package.json >:(
const zkpassPoseidon2 = import("@zkpassport/poseidon2");
import { GENERATOR_INDEX__NOTE_HASH_NONCE, GENERATOR_INDEX__SILOED_NOTE_HASH, GENERATOR_INDEX__UNIQUE_NOTE_HASH } from './constants';
export function hashPreCommitment(nullifierPreimage, secret, chainId) {
    return poseidon3([nullifierPreimage, secret, chainId]);
}
export function hashCommitment(preCommitment, amount) {
    return poseidon2([preCommitment, amount]);
}
export function hashCommitmentFromNoteItems(noteItems) {
    const [nullifier_preimage, secret, chain_id, amount] = noteItems;
    const preCommitment = hashPreCommitment(nullifier_preimage.toBigInt(), secret.toBigInt(), chain_id.toBigInt());
    return poseidon2([preCommitment, amount.toBigInt()]);
}
export function hashNullifier(nullifierPreimage) {
    return poseidon1([nullifierPreimage]);
}
/**
 * for aztec note hashing
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/05999f57016f37978512ea36a11a01f7b8bcf1c1/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L48
 */
export async function hashNoteHashNonce(first_nullifier_in_tx, note_index_in_tx) {
    return await poseidon2HashWithSeparator([first_nullifier_in_tx, note_index_in_tx], GENERATOR_INDEX__NOTE_HASH_NONCE);
}
export async function poseidon2HashWithSeparator(inputs, separator) {
    const { poseidon2Hash } = await zkpassPoseidon2;
    let inputs_with_separator = [separator, ...inputs];
    return poseidon2Hash(inputs_with_separator);
}
// TODO move this to different file ----
export async function findNoteHashIndex(contractAddress, noteHashesInTx, plainNoteHash, firstNullifierInTx) {
    const getUniqueNote = async (index) => await attemptHasUniqueNoteHash(contractAddress, firstNullifierInTx, plainNoteHash, index);
    for (let index = 0; index < noteHashesInTx.length; index++) {
        const hashInTx = noteHashesInTx[index].toBigInt();
        const hashAttempt = await getUniqueNote(BigInt(index));
        if (hashAttempt === hashInTx) {
            return index;
        }
    }
    throw new Error("couldn't find the note hash index :/");
}
/**
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/c99fb41148ab9fad92d9ab0ff90dc64bd44afdc8/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L57
 * @param contractAddress
 * @param plainNoteHash
 * @param firstNullifierInTx
 * @param index
 */
export async function hashUniqueNoteHash(nonce, siloed_note_hash) {
    return await poseidon2HashWithSeparator([nonce, siloed_note_hash], GENERATOR_INDEX__UNIQUE_NOTE_HASH);
}
/**
 * based of: https://github.com/AztecProtocol/aztec-packages/blob/c99fb41148ab9fad92d9ab0ff90dc64bd44afdc8/noir-projects/noir-protocol-circuits/crates/types/src/hash.nr#L62
 * @param contractAddress
 * @param plainNoteHash
 */
export async function hashSiloedNoteHash(contractAddress, plainNoteHash) {
    return await poseidon2HashWithSeparator([contractAddress, plainNoteHash], GENERATOR_INDEX__SILOED_NOTE_HASH);
}
/**
 * uses findNoteHashIndex to go over every note has in the noteHashesInTx array to find the correct nonce
 * and then uses that to return which hash is correct
 * @param contractAddress
 * @param noteHashesInTx
 * @param plainNoteHash
 * @param firstNullifierInTx
 * @returns
 */
export async function findUniqueNoteHash(contractAddress, noteHashesInTx, plainNoteHash, firstNullifierInTx) {
    const { poseidon2Hash } = await zkpassPoseidon2;
    const uniqueNoteIndex = await findNoteHashIndex(contractAddress, noteHashesInTx, plainNoteHash, firstNullifierInTx);
    const nonce = await hashNoteHashNonce(firstNullifierInTx.toBigInt(), BigInt(uniqueNoteIndex));
    const siloed_note_hash = await hashSiloedNoteHash(contractAddress.toBigInt(), plainNoteHash.toBigInt());
    const uniqueNoteHash = await hashUniqueNoteHash(nonce, siloed_note_hash);
    return uniqueNoteHash;
}
export async function attemptHasUniqueNoteHash(contractAddress, firstNullifierInTx, plainNoteHash, index) {
    const nonce = await hashNoteHashNonce(firstNullifierInTx.toBigInt(), BigInt(index));
    const siloedNoteHash = await hashSiloedNoteHash(contractAddress.toBigInt(), plainNoteHash.toBigInt());
    return await hashUniqueNoteHash(nonce, siloedNoteHash);
}
