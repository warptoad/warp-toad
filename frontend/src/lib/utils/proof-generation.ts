/**
 * Browser-based ZK proof generation for Aztec -> L1 withdrawals
 * 
 * This module handles:
 * 1. Preparing proof inputs in the format expected by the withdraw circuit
 * 2. Generating ZK proofs using @aztec/bb.js (UltraPlonk backend)
 * 3. Formatting proofs for submission to the L1 mint function
 */

import { UltraPlonkBackend } from '@aztec/bb.js';
import { Noir, type CompiledCircuit, type InputMap } from '@noir-lang/noir_js';
import { poseidon1 } from 'poseidon-lite';
import type { CommitmentPreImage } from '$lib/types/bridge';
import type { AztecMerkleData, EvmMerkleData } from './aztec-interactions';

// Import the compiled withdraw circuit
// @ts-ignore - JSON import
import circuit from '$lib/circuits/withdraw.json';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Proof inputs for the withdraw circuit
 * Matches the format expected by backend/circuits/withdraw/src/main.nr
 */
export interface ProofInputs {
	// ----- public inputs -----
	nullifier: string;
	chain_id: string;
	amount: string;
	giga_root: string;
	destination_local_root: string;
	aztec_warptoad_address: string;
	fee_factor: string;
	priority_fee: string;
	max_fee: string;
	relayer_address: string;
	recipient_address: string;


	// ----- private inputs -----
	origin_local_root: string;
	is_from_aztec: boolean;
	nullifier_preimage: string;
	secret: string;
	aztec_merkle_data: {
		leaf_index: string;
		hash_path: string[];
		leaf_nonce: string;
	};
	evm_merkle_data: {
		leaf_index: string;
		hash_path: string[];
	};
	giga_merkle_data: {
		leaf_index: string;
		hash_path: string[];
	};
}

/**
 * Result of proof generation
 */
export interface GeneratedProof {
	proof: Uint8Array;
	publicInputs: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EVM_TREE_DEPTH = 32;
const GIGA_TREE_DEPTH = 5;
const AZTEC_TREE_DEPTH = 42;

// Default fee parameters for self-relaying (no relayer fee)
// NOTE: These fees are for RELAYER COMPENSATION, not gas fees!
// - max_fee is how much of the withdrawal amount you're willing to pay a relayer
// - priority_fee is a minimal gas price check in the circuit
// - For self-relay, we use minimal values and override gas at transaction time
const DEFAULT_FEE_FACTOR = 0n; // No relayer fee for self-relay
const DEFAULT_PRIORITY_FEE = 1_000_000_000n; // 1 gwei - minimal for circuit validation
const DEFAULT_RELAYER_ADDRESS = '0x0000000000000000000000000000000000000001'; // address(1) for self-relay

/**
 * Fee configuration for proof generation
 * NOTE: For self-relay, just use the defaults. These are NOT gas fees!
 */
export interface FeeConfig {
	priorityFee?: bigint;    // Minimal priority fee for circuit validation (default 1 gwei)
	maxFee?: bigint;         // Max relayer fee from withdrawal amount (default: full amount)
	feeFactor?: bigint;      // Fee factor for relayer (0 for self-relay)
	relayerAddress?: string; // Relayer address (default: address(1) for self-relay)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert bigint to hex string (0x prefixed)
 */
function toHex(value: bigint): string {
	return '0x' + value.toString(16);
}

/**
 * Convert address to left-padded 32-byte hex
 */
function addressToHex(address: string): string {
	// Remove 0x prefix if present
	const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
	// Left-pad to 32 bytes (64 hex chars)
	return '0x' + cleanAddress.toLowerCase().padStart(64, '0');
}

/**
 * Hash nullifier: poseidon1([nullifier_preimage])
 */
function hashNullifier(nullifierPreimage: bigint): bigint {
	return poseidon1([nullifierPreimage]);
}

/**
 * Create empty merkle data for unused tree types
 */
function createEmptyEvmMerkleData(): { leaf_index: string; hash_path: string[] } {
	return {
		leaf_index: toHex(0n),
		hash_path: new Array(EVM_TREE_DEPTH).fill(toHex(0n)),
	};
}

function createEmptyGigaMerkleData(): { leaf_index: string; hash_path: string[] } {
	return {
		leaf_index: toHex(0n),
		hash_path: new Array(GIGA_TREE_DEPTH).fill(toHex(0n)),
	};
}

function createEmptyAztecMerkleData(): {
	leaf_index: string;
	hash_path: string[];
	leaf_nonce: string;
	contract_address: string;
} {
	return {
		leaf_index: toHex(0n),
		hash_path: new Array(AZTEC_TREE_DEPTH).fill(toHex(0n)),
		leaf_nonce: toHex(0n),
		contract_address: toHex(0n),
	};
}

// =============================================================================
// PROOF INPUT PREPARATION
// =============================================================================

/**
 * Prepare proof inputs for Aztec -> L1 withdrawal
 * 
 * @param commitmentData - The commitment pre-image from the Aztec burn
 * @param aztecMerkleData - Merkle proof from Aztec note hash tree
 * @param gigaMerkleData - Merkle proof from GigaBridge tree (origin local root in giga root)
 * @param gigaRoot - The giga root from L1 GigaBridge
 * @param destinationLocalRoot - The L1 local root (destination for withdrawal)
 * @param originLocalRoot - The Aztec note hash tree root
 * @param destinationChainId - The L1 chain ID
 * @param recipientAddress - The recipient's L1 address
 * @param feeConfig - Optional fee configuration for relaying
 * @returns ProofInputs ready for the circuit
 */
export function prepareProofInputsForAztecToL1(
	commitmentData: CommitmentPreImage,
	aztecMerkleData: AztecMerkleData,
	gigaMerkleData: EvmMerkleData,
	gigaRoot: bigint,
	destinationLocalRoot: bigint,
	originLocalRoot: bigint,
	destinationChainId: bigint,
	recipientAddress: string,
	feeConfig?: FeeConfig
): ProofInputs {
	// Compute nullifier
	const nullifier = hashNullifier(commitmentData.nullifier_preimg);

	// Use provided fee config or defaults for self-relay
	const feeFactor = feeConfig?.feeFactor ?? DEFAULT_FEE_FACTOR;
	const priorityFee = feeConfig?.priorityFee ?? DEFAULT_PRIORITY_FEE;
	const actualMaxFee = feeConfig?.maxFee ?? commitmentData.amount;
	const relayerAddress = feeConfig?.relayerAddress ?? DEFAULT_RELAYER_ADDRESS;

	const proofInputs: ProofInputs = {
		// ----- public inputs -----
		nullifier: toHex(nullifier),
		chain_id: toHex(destinationChainId),
		amount: toHex(commitmentData.amount),
		giga_root: toHex(gigaRoot),
		destination_local_root: toHex(destinationLocalRoot),
		aztec_warptoad_address: toHex(aztecMerkleData.contract_address),
		fee_factor: toHex(feeFactor),
		priority_fee: toHex(priorityFee),
		max_fee: toHex(actualMaxFee),
		relayer_address: addressToHex(relayerAddress),
		recipient_address: addressToHex(recipientAddress),

		// ----- private inputs -----
		origin_local_root: toHex(originLocalRoot),
		is_from_aztec: true,
		nullifier_preimage: toHex(commitmentData.nullifier_preimg),
		secret: toHex(commitmentData.secret),
		aztec_merkle_data: {
			leaf_index: toHex(aztecMerkleData.leaf_index),
			hash_path: aztecMerkleData.hash_path.map(h => toHex(h)),
			leaf_nonce: toHex(aztecMerkleData.leaf_nonce)
		},
		evm_merkle_data: createEmptyEvmMerkleData(), // Not used for Aztec -> L1
		giga_merkle_data: {
			leaf_index: toHex(gigaMerkleData.leaf_index),
			hash_path: gigaMerkleData.hash_path.map(h => toHex(h)),
		},
	};

	return proofInputs;
}

/**
 * Prepare proof inputs for same-chain withdrawal (origin == destination)
 * This is used when withdrawing on the same chain where the burn occurred
 * 
 * Note: Even for same-chain withdrawals, the contract still validates that gigaRoot
 * is known/valid. The gigaRoot must exist in the contract's history, but we use
 * empty giga merkle data since we don't need to prove cross-chain inclusion.
 * 
 * @param commitmentData - The commitment pre-image from the burn
 * @param aztecMerkleData - Aztec merkle data (null for EVM same-chain)
 * @param evmMerkleData - EVM merkle data (null for Aztec same-chain)
 * @param localRoot - The local root containing the commitment
 * @param gigaRoot - The current gigaRoot from the contract (must be valid/known)
 * @param aztecWarptoadAddress - pub input that matches warptoadCore.aztecWarptoadAddress()
 * @param chainId - The chain ID
 * @param recipientAddress - The recipient's address
 * @param isFromAztec - Whether the burn originated from Aztec
 * @param feeConfig - Optional fee configuration for relaying
 * @returns ProofInputs ready for the circuit
 */
export function prepareProofInputsForSameChain(
	commitmentData: CommitmentPreImage,
	aztecMerkleData: AztecMerkleData | null,
	evmMerkleData: EvmMerkleData | null,
	aztecWarptoadAddress: bigint,
	localRoot: bigint,
	gigaRoot: bigint,
	chainId: bigint,
	recipientAddress: string,
	isFromAztec: boolean,
	feeConfig?: FeeConfig
): ProofInputs {
	const nullifier = hashNullifier(commitmentData.nullifier_preimg);
	const feeFactor = feeConfig?.feeFactor ?? DEFAULT_FEE_FACTOR;
	const priorityFee = feeConfig?.priorityFee ?? DEFAULT_PRIORITY_FEE;
	const actualMaxFee = feeConfig?.maxFee ?? commitmentData.amount;
	const relayerAddress = feeConfig?.relayerAddress ?? DEFAULT_RELAYER_ADDRESS;
	console.log(recipientAddress)
	return {
		nullifier: toHex(nullifier),
		chain_id: toHex(chainId),
		amount: toHex(commitmentData.amount),
		giga_root: toHex(gigaRoot), // Must be a valid gigaRoot known to the contract
		destination_local_root: toHex(localRoot),
		aztec_warptoad_address: toHex(aztecWarptoadAddress),
		fee_factor: toHex(feeFactor),
		priority_fee: toHex(priorityFee),
		max_fee: toHex(actualMaxFee),
		relayer_address: addressToHex(relayerAddress),
		recipient_address: addressToHex(recipientAddress),
		origin_local_root: toHex(localRoot), // Same as destination for same-chain
		is_from_aztec: isFromAztec,
		nullifier_preimage: toHex(commitmentData.nullifier_preimg),
		secret: toHex(commitmentData.secret),
		aztec_merkle_data: aztecMerkleData
			? {
				leaf_index: toHex(aztecMerkleData.leaf_index),
				hash_path: aztecMerkleData.hash_path.map(h => toHex(h)),
				leaf_nonce: toHex(aztecMerkleData.leaf_nonce),
			}
			: createEmptyAztecMerkleData(),
		evm_merkle_data: evmMerkleData
			? {
				leaf_index: toHex(evmMerkleData.leaf_index),
				hash_path: evmMerkleData.hash_path.map(h => toHex(h)),
			}
			: createEmptyEvmMerkleData(),
		giga_merkle_data: createEmptyGigaMerkleData(), // Empty for same-chain (no cross-chain proof needed)
	};
}

/**
 * Prepare proof inputs for L1 → Scroll (EVM to EVM) withdrawal
 * Uses is_from_aztec = false
 * 
 * @param commitmentData - The commitment pre-image from the L1 burn
 * @param l1EvmMerkleData - Merkle proof from L1 burn tree
 * @param gigaMerkleData - Merkle proof from GigaBridge tree (L1 local root in giga root)
 * @param gigaRoot - The giga root from GigaBridge
 * @param scrollLocalRoot - The Scroll local root (destination)
 * @param l1LocalRoot - The L1 local root (origin)
 * @param aztecWarptoadAddress - The Aztec WarpToad address (from L1WarpToad contract)
 * @param scrollChainId - The Scroll chain ID
 * @param recipientAddress - The recipient's Scroll address
 * @param feeConfig - Optional fee configuration for relaying
 * @returns ProofInputs ready for the circuit
 */
export function prepareProofInputsForL1ToScroll(
	commitmentData: CommitmentPreImage,
	l1EvmMerkleData: EvmMerkleData,
	gigaMerkleData: EvmMerkleData,
	gigaRoot: bigint,
	scrollLocalRoot: bigint,
	l1LocalRoot: bigint,
	aztecWarptoadAddress: bigint,
	scrollChainId: bigint,
	recipientAddress: string,
	feeConfig?: FeeConfig
): ProofInputs {
	// Compute nullifier
	const nullifier = hashNullifier(commitmentData.nullifier_preimg);

	// Use provided fee config or defaults for self-relay
	const feeFactor = feeConfig?.feeFactor ?? DEFAULT_FEE_FACTOR;
	const priorityFee = feeConfig?.priorityFee ?? DEFAULT_PRIORITY_FEE;
	const actualMaxFee = feeConfig?.maxFee ?? commitmentData.amount;
	const relayerAddress = feeConfig?.relayerAddress ?? DEFAULT_RELAYER_ADDRESS;

	const proofInputs: ProofInputs = {
		// ----- public inputs -----
		nullifier: toHex(nullifier),
		chain_id: toHex(scrollChainId),
		amount: toHex(commitmentData.amount),
		giga_root: toHex(gigaRoot),
		destination_local_root: toHex(scrollLocalRoot),
		aztec_warptoad_address: toHex(aztecWarptoadAddress),
		fee_factor: toHex(feeFactor),
		priority_fee: toHex(priorityFee),
		max_fee: toHex(actualMaxFee),
		relayer_address: addressToHex(relayerAddress),
		recipient_address: addressToHex(recipientAddress),

		// ----- private inputs -----
		origin_local_root: toHex(l1LocalRoot),
		is_from_aztec: false, // L1 → Scroll uses EVM merkle proof
		nullifier_preimage: toHex(commitmentData.nullifier_preimg),
		secret: toHex(commitmentData.secret),
		aztec_merkle_data: createEmptyAztecMerkleData(), // Not used for EVM → EVM
		evm_merkle_data: {
			leaf_index: toHex(l1EvmMerkleData.leaf_index),
			hash_path: l1EvmMerkleData.hash_path.map(h => toHex(h)),
		},
		giga_merkle_data: {
			leaf_index: toHex(gigaMerkleData.leaf_index),
			hash_path: gigaMerkleData.hash_path.map(h => toHex(h)),
		},
	};

	return proofInputs;
}

/**
 * Prepare proof inputs for Scroll → L1 withdrawal
 * Uses is_from_aztec = false
 * 
 * @param commitmentData - The commitment pre-image from the Scroll burn
 * @param scrollEvmMerkleData - Merkle proof from Scroll burn tree
 * @param gigaMerkleData - Merkle proof from GigaBridge tree (Scroll local root in giga root)
 * @param gigaRoot - The giga root from GigaBridge
 * @param l1LocalRoot - The L1 local root (destination)
 * @param scrollLocalRoot - The Scroll local root (origin)
 * @param aztecWarptoadAddress - The Aztec WarpToad address (from Scroll L2WarpToad contract)
 * @param l1ChainId - The L1 chain ID
 * @param recipientAddress - The recipient's L1 address
 * @param feeConfig - Optional fee configuration for relaying
 * @returns ProofInputs ready for the circuit
 */
export function prepareProofInputsForScrollToL1(
	commitmentData: CommitmentPreImage,
	scrollEvmMerkleData: EvmMerkleData,
	gigaMerkleData: EvmMerkleData,
	gigaRoot: bigint,
	l1LocalRoot: bigint,
	scrollLocalRoot: bigint,
	aztecWarptoadAddress: bigint,
	l1ChainId: bigint,
	recipientAddress: string,
	feeConfig?: FeeConfig
): ProofInputs {
	// Compute nullifier
	const nullifier = hashNullifier(commitmentData.nullifier_preimg);

	// Use provided fee config or defaults for self-relay
	const feeFactor = feeConfig?.feeFactor ?? DEFAULT_FEE_FACTOR;
	const priorityFee = feeConfig?.priorityFee ?? DEFAULT_PRIORITY_FEE;
	const actualMaxFee = feeConfig?.maxFee ?? commitmentData.amount;
	const relayerAddress = feeConfig?.relayerAddress ?? DEFAULT_RELAYER_ADDRESS;

	const proofInputs: ProofInputs = {
		// ----- public inputs -----
		nullifier: toHex(nullifier),
		chain_id: toHex(l1ChainId),
		amount: toHex(commitmentData.amount),
		giga_root: toHex(gigaRoot),
		destination_local_root: toHex(l1LocalRoot),
		aztec_warptoad_address: toHex(aztecWarptoadAddress),
		fee_factor: toHex(feeFactor),
		priority_fee: toHex(priorityFee),
		max_fee: toHex(actualMaxFee),
		relayer_address: addressToHex(relayerAddress),
		recipient_address: addressToHex(recipientAddress),

		// ----- private inputs -----
		origin_local_root: toHex(scrollLocalRoot),
		is_from_aztec: false, // Scroll → L1 uses EVM merkle proof
		nullifier_preimage: toHex(commitmentData.nullifier_preimg),
		secret: toHex(commitmentData.secret),
		aztec_merkle_data: createEmptyAztecMerkleData(), // Not used for EVM → EVM
		evm_merkle_data: {
			leaf_index: toHex(scrollEvmMerkleData.leaf_index),
			hash_path: scrollEvmMerkleData.hash_path.map(h => toHex(h)),
		},
		giga_merkle_data: {
			leaf_index: toHex(gigaMerkleData.leaf_index),
			hash_path: gigaMerkleData.hash_path.map(h => toHex(h)),
		},
	};

	return proofInputs;
}

// =============================================================================
// PROOF GENERATION
// =============================================================================

/**
 * Generate a ZK proof for withdrawal
 * 
 * This uses the UltraPlonk proving system from @aztec/bb.js
 * Note: This can take 30-60 seconds in the browser
 * 
 * @param proofInputs - The prepared proof inputs
 * @param onProgress - Optional callback for progress updates
 * @returns Generated proof and public inputs
 */
export async function generateWithdrawProof(
	proofInputs: ProofInputs,
	onProgress?: (message: string) => void
): Promise<GeneratedProof> {
	const log = (msg: string) => {
		console.log(`[ProofGen] ${msg}`);
		onProgress?.(msg);
	};

	log('Initializing Noir circuit...');
	const noir = new Noir(circuit as CompiledCircuit);

	log('Initializing UltraPlonk backend...');
	const threads = typeof navigator !== 'undefined' 
		? navigator.hardwareConcurrency || 4 
		: 4;
	log(`Using ${threads} threads for proof generation`);
	
	const backend = new UltraPlonkBackend(circuit.bytecode, { threads });

	log('Executing circuit...');
	const executeRes = await noir.execute(proofInputs as unknown as InputMap);
	log('Circuit execution complete');

	log('Generating proof (this may take 30-60 seconds)...');
	const proof = await backend.generateProof(executeRes.witness);
	log('Proof generated successfully');

	// Verify the proof locally before returning
	log('Verifying proof locally...');
	const isValid = await backend.verifyProof(proof);
	if (!isValid) {
		throw new Error('Generated proof failed local verification');
	}
	log('Proof verified successfully');

	return {
		proof: proof.proof,
		publicInputs: proof.publicInputs.map(pi => pi.toString()),
	};
}

/**
 * Format proof for submission to L1 WarpToad.mint()
 * 
 * @param proof - The generated proof bytes
 * @returns Hex-encoded proof string
 */
export function formatProofForL1(proof: Uint8Array): string {
	return '0x' + Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('');
}
