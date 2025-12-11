/**
 * Scroll L2 Bridge Interactions
 *
 * Handles all Scroll-specific contract interactions including:
 * - Minting tokens (for testing)
 * - Burning tokens for bridge-out
 * - Claiming tokens from bridge-in (with ZK proof)
 * - Reading bridge state (gigaRoot, localRoot)
 *
 * Note: Scroll L2WarpToad does NOT have wrap/unwrap like L1WarpToad.
 * Users get tokens via mint (bridge-in) or getFreeShit (testing).
 */

import { createPublicClient, http, type Hash } from 'viem';
import { L2WarpToadAbi, L2ScrollBridgeAdapterAbi, USDcoinAbi } from '$lib/contracts/abis';
import { getEVMChain, type EVMChainDefinition } from '$lib/config/chains.js';
import { createClient, getChainId } from './evm-wallet.js';
import type { CommitmentPreImage } from '$lib/types/bridge.js';
import {
	hashPreCommitment,
	hashCommitment,
	createCommitmentPreImage,
	encodeNote,
} from './evm-interactions.js';

// ============================================================================
// Chain Configuration Helpers
// ============================================================================

/**
 * Get Scroll chain configuration
 * Throws if Scroll is not enabled (test mode)
 */
function getScrollConfig(): EVMChainDefinition {
	const scroll = getEVMChain('Scroll');
	if (!scroll || !scroll.enabled) {
		throw new Error('Scroll is not available in the current environment. Switch to testnet mode.');
	}
	return scroll;
}

/**
 * Check if current chain is Scroll
 */
export async function isOnScrollNetwork(): Promise<boolean> {
	const chainId = await getChainId();
	const scroll = getEVMChain('Scroll');
	return (scroll?.enabled && chainId === scroll.chainId) ?? false;
}

/**
 * Get Scroll chain ID
 */
export function getScrollChainId(): number {
	return getScrollConfig().chainId;
}

// ============================================================================
// Balance & Token Operations
// ============================================================================

/**
 * Get wrapped token balance on Scroll L2
 * This is the L2WarpToad token balance (what users bridge with)
 */
export async function getScrollWrappedBalance(address: string): Promise<bigint> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const balance = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'balanceOf',
		args: [address as `0x${string}`],
	});

	return balance;
}

/**
 * Get wrapped token decimals on Scroll
 */
export async function getScrollTokenDecimals(): Promise<number> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const decimals = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'decimals',
	});

	return decimals;
}

/**
 * Get native token balance on Scroll (if there's a native token deployed)
 * This would be the original token before wrapping
 */
export async function getScrollNativeBalance(address: string): Promise<bigint> {
	const scroll = getScrollConfig();

	if (!scroll.contracts.nativeToken) {
		console.warn('No native token configured for Scroll');
		return 0n;
	}

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const balance = await publicClient.readContract({
		address: scroll.contracts.nativeToken as `0x${string}`,
		abi: USDcoinAbi,
		functionName: 'balanceOf',
		args: [address as `0x${string}`],
	});

	return balance;
}

/**
 * Mint free tokens on Scroll (for testing)
 * Calls L2WarpToad.getFreeShit()
 */
export async function mintFreeScrollTokens(amount: bigint): Promise<Hash> {
	const scroll = getScrollConfig();
	const client = createClient(scroll.chainId);
	if (!client) throw new Error('Failed to create wallet client for Scroll');

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const userAddress = (await client.getAddresses())[0];

	const { request } = await publicClient.simulateContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		account: userAddress,
		functionName: 'getFreeShit',
		args: [amount],
	});

	const hash = await client.writeContract(request);
	await publicClient.waitForTransactionReceipt({ hash });

	return hash;
}

// ============================================================================
// Bridge State Readers
// ============================================================================

/**
 * Get gigaRoot from L2ScrollBridgeAdapter
 * This is the root synced from L1 GigaBridge via Scroll messenger
 */
export async function getScrollGigaRoot(): Promise<bigint> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const gigaRoot = await publicClient.readContract({
		address: scroll.contracts.bridgeAdapter as `0x${string}`,
		abi: L2ScrollBridgeAdapterAbi,
		functionName: 'gigaRoot',
	});

	return gigaRoot;
}

/**
 * Get localRoot from L2WarpToad
 * This is the merkle root of all burns on Scroll
 */
export async function getScrollLocalRoot(): Promise<bigint> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const localRoot = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'localRoot',
	});

	return localRoot;
}

/**
 * Get cached local root from L2WarpToad
 */
export async function getScrollCachedLocalRoot(): Promise<bigint> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const cachedRoot = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'cachedLocalRoot',
	});

	return cachedRoot;
}

/**
 * Check if a gigaRoot is valid on Scroll
 */
export async function isValidScrollGigaRoot(gigaRoot: bigint): Promise<boolean> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const isValid = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'isValidGigaRoot',
		args: [gigaRoot],
	});

	return isValid;
}

/**
 * Check if a localRoot is valid on Scroll
 */
export async function isValidScrollLocalRoot(localRoot: bigint): Promise<boolean> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const isValid = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'isValidLocalRoot',
		args: [localRoot],
	});

	return isValid;
}

// ============================================================================
// Bridge Out: Scroll -> Other Chain
// ============================================================================

/**
 * Burn tokens on Scroll and create commitment for bridge-out
 *
 * @param amount - Amount to burn (in token units)
 * @param destinationChainId - Target chain ID (poseidon hash for Aztec, standard for EVM)
 * @returns Commitment data and transaction hash
 */
export async function burnOnScroll(
	amount: bigint,
	destinationChainId: bigint
): Promise<{
	commitmentPreImg: CommitmentPreImage;
	preCommitment: bigint;
	commitment: bigint;
	burnTxHash: Hash;
}> {
	const scroll = getScrollConfig();
	const client = createClient(scroll.chainId);
	if (!client) throw new Error('Failed to create wallet client for Scroll');

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const userAddress = (await client.getAddresses())[0];

	// 1. Generate commitment pre-image
	const commitmentPreImg = createCommitmentPreImage(amount, destinationChainId);

	// 2. Hash pre-commitment
	const preCommitment = hashPreCommitment(
		commitmentPreImg.nullifier_preimg,
		commitmentPreImg.secret,
		commitmentPreImg.destination_chain_id
	);

	// 3. Call burn function
	const { request } = await publicClient.simulateContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		account: userAddress,
		functionName: 'burn',
		args: [preCommitment, amount],
	});

	const burnTxHash = await client.writeContract(request);
	await publicClient.waitForTransactionReceipt({ hash: burnTxHash });

	// 4. Hash full commitment
	const commitment = hashCommitment(preCommitment, amount);

	return {
		commitmentPreImg,
		preCommitment,
		commitment,
		burnTxHash,
	};
}

/**
 * Full bridge flow from Scroll to another chain
 *
 * @param amount - Amount in human-readable format (e.g., "100.5")
 * @param destinationChainId - Target chain ID
 * @returns Bridge result with note and transaction details
 */
export async function bridgeFromScroll(
	amount: string,
	destinationChainId: bigint
): Promise<{
	note: string;
	commitmentPreImg: CommitmentPreImage;
	preCommitment: string;
	commitment: string;
	burnTxHash: string;
}> {
	const scroll = getScrollConfig();

	// Get decimals and convert amount
	const decimals = await getScrollTokenDecimals();
	const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

	// Burn tokens and create commitment
	console.log('Burning tokens on Scroll...');
	const burnResult = await burnOnScroll(amountBigInt, destinationChainId);

	// Create note
	console.log('Creating note...');
	const sourceChainId = BigInt(scroll.chainId);
	const note = encodeNote(burnResult.commitmentPreImg, sourceChainId, burnResult.preCommitment, burnResult.commitment);

	return {
		note,
		commitmentPreImg: burnResult.commitmentPreImg,
		preCommitment: burnResult.preCommitment.toString(),
		commitment: burnResult.commitment.toString(),
		burnTxHash: burnResult.burnTxHash,
	};
}

// ============================================================================
// Bridge In: Other Chain -> Scroll
// ============================================================================

/**
 * Convert a 32-byte padded hex string to a proper 20-byte Ethereum address
 */
function paddedHexToAddress(paddedHex: string): `0x${string}` {
	const clean = paddedHex.startsWith('0x') ? paddedHex.slice(2) : paddedHex;
	const addressHex = clean.slice(-40);
	return `0x${addressHex}` as `0x${string}`;
}

/**
 * Claim tokens on Scroll from a burn on another chain
 * Uses ZK proof verification via L2WarpToad.mint()
 *
 * @param proofInputs - The proof inputs (public inputs)
 * @param proof - The ZK proof bytes (hex encoded)
 * @returns Transaction hash
 */
export async function claimOnScroll(
	proofInputs: {
		nullifier: string;
		amount: string;
		giga_root: string;
		destination_local_root: string;
		fee_factor: string;
		priority_fee: string;
		max_fee: string;
		relayer_address: string;
		recipient_address: string;
	},
	proof: string
): Promise<{ txHash: string }> {
	const scroll = getScrollConfig();
	const client = createClient(scroll.chainId);
	if (!client) throw new Error('Failed to create wallet client for Scroll');

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	const userAddress = (await client.getAddresses())[0];

	console.log('Claiming on Scroll L2...');
	console.log('Nullifier:', proofInputs.nullifier);
	console.log('Amount:', proofInputs.amount);
	console.log('Recipient:', proofInputs.recipient_address);

	// Call mint function on L2WarpToad
	const { request } = await publicClient.simulateContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		account: userAddress,
		functionName: 'mint',
		args: [
			BigInt(proofInputs.nullifier),
			BigInt(proofInputs.amount),
			BigInt(proofInputs.giga_root),
			BigInt(proofInputs.destination_local_root),
			BigInt(proofInputs.fee_factor),
			BigInt(proofInputs.priority_fee),
			BigInt(proofInputs.max_fee),
			paddedHexToAddress(proofInputs.relayer_address),
			paddedHexToAddress(proofInputs.recipient_address),
			proof as `0x${string}`,
		],
		// Set gas price parameters
		maxPriorityFeePerGas: BigInt(proofInputs.priority_fee),
		maxFeePerGas: BigInt(proofInputs.priority_fee) * 100n,
	});

	const txHash = await client.writeContract(request);
	await publicClient.waitForTransactionReceipt({ hash: txHash });

	console.log('Claim transaction completed:', txHash);
	return { txHash };
}

// ============================================================================
// Merkle Data for Scroll
// ============================================================================

/**
 * Get merkle data for a commitment on Scroll
 * Used when withdrawing FROM Scroll to another chain
 *
 * This fetches the Burn events from L2WarpToad and builds the merkle proof
 */
export async function getScrollMerkleData(
	commitment: bigint
): Promise<{
	index: number;
	siblings: bigint[];
	localRoot: bigint;
}> {
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	// Get all Burn events to build the tree
	const burnEvents = await publicClient.getLogs({
		address: scroll.contracts.warpToad as `0x${string}`,
		event: {
			type: 'event',
			name: 'Burn',
			inputs: [
				{ type: 'uint256', name: 'commitment', indexed: true },
				{ type: 'uint256', name: 'amount', indexed: false },
				{ type: 'uint256', name: 'index', indexed: false },
			],
		},
		fromBlock: 'earliest',
		toBlock: 'latest',
	});

	// Find our commitment
	let commitmentIndex = -1;
	const commitments: bigint[] = [];

	for (const event of burnEvents) {
		const eventCommitment = event.args.commitment as bigint;
		const eventIndex = Number(event.args.index as bigint);

		commitments[eventIndex] = eventCommitment;

		if (eventCommitment === commitment) {
			commitmentIndex = eventIndex;
		}
	}

	if (commitmentIndex === -1) {
		throw new Error('Commitment not found in Scroll burn events. Has the bridge sync completed?');
	}

	// Get the current local root
	const localRoot = await getScrollLocalRoot();

	// Build merkle proof (simplified - in production use the actual LazyIMT library)
	// For now, return placeholder siblings - the actual proof generation
	// should match the circuit's expected format
	const siblings = await buildScrollMerkleProof(commitments, commitmentIndex);

	return {
		index: commitmentIndex,
		siblings,
		localRoot,
	};
}

/**
 * Build merkle proof for Scroll commitment tree
 * Uses the LazyIMT structure matching the contract
 */
async function buildScrollMerkleProof(commitments: bigint[], index: number): Promise<bigint[]> {
	// This is a simplified implementation
	// In production, this should match the LazyIMT proof generation
	const scroll = getScrollConfig();

	const publicClient = createPublicClient({
		chain: scroll.viemChain,
		transport: http(scroll.rpcUrl),
	});

	// Get tree depth
	const maxTreeDepth = await publicClient.readContract({
		address: scroll.contracts.warpToad as `0x${string}`,
		abi: L2WarpToadAbi,
		functionName: 'maxTreeDepth',
	});

	// Build the tree and generate proof
	// Note: This needs to match the LazyIMT implementation
	const siblings: bigint[] = [];
	const depth = Number(maxTreeDepth);

	// For LazyIMT, we need to compute siblings at each level
	// This is a placeholder - actual implementation should use zk-kit's LazyIMT
	for (let level = 0; level < depth; level++) {
		// Compute sibling at this level
		const siblingIndex = index ^ 1; // XOR to get sibling
		const sibling = computeSiblingAtLevel(commitments, siblingIndex, level);
		siblings.push(sibling);
		index = Math.floor(index / 2); // Move to parent
	}

	return siblings;
}

/**
 * Compute sibling hash at a given tree level
 * Placeholder - needs proper LazyIMT implementation
 */
function computeSiblingAtLevel(commitments: bigint[], siblingIndex: number, level: number): bigint {
	// This is a placeholder implementation
	// In a real implementation, we'd need to:
	// 1. Build the tree from leaves
	// 2. Compute hashes at each level using poseidon2
	// 3. Return the sibling at the requested level

	if (level === 0) {
		// At leaf level, return the commitment at siblingIndex (or 0 if empty)
		return commitments[siblingIndex] ?? 0n;
	}

	// For higher levels, would need to compute from children
	// For now return 0 as placeholder
	return 0n;
}

// ============================================================================
// Utility Exports
// ============================================================================

export { getScrollConfig };
