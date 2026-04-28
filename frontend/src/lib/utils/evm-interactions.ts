import type { Chain, Token, CommitmentPreImage } from '$lib/types/bridge.js';
import { TOKEN_CONTRACTS } from '$lib/stores/proofs.svelte';
import { USDcoinAbi, L1WarpToadAbi, GigaBridgeAbi, L1WarpToadAbi as WarpToadAbi } from '$lib/contracts/abis';
import { createClient, getChainId } from './evm-wallet';
import { createPublicClient, http, toHex, type Hash } from 'viem';
import { getContractAddresses, CONTRACT_ADDRESSES } from '$lib/contracts/addresses';
import { poseidon2, poseidon3 } from 'poseidon-lite';
import { getEVMChain } from '$lib/config/chains';
import { queryEventInChunks } from './viem-chunks';
import { getLatestLocalRootEventForIndex } from './aztec-interactions';
import { rpcSettings } from '$lib/stores/rpc-settings.svelte';

// Field size for BN254 curve (used by Aztec)
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Get RPC URL for a chain ID.
 *
 * Order of preference:
 *   1. User's custom RPC (if they've both configured one AND have the toggle
 *      enabled in `rpcSettings`).
 *   2. The chain registry default, which in production is the bridge.warptoad
 *      proxy baked in at build time via VITE_*_RPC_URL.
 *
 * Callers don't need to know about the override; every read-client factory in
 * this file goes through here, and `scroll-interactions.ts` goes through the
 * exported version.
 */
export function getRpcUrl(chainId: number): string | undefined {
	const chainMap: Record<number, 'Ethereum' | 'Scroll'> = {
		31337: 'Ethereum',
		11155111: 'Ethereum',
		534351: 'Scroll',
	};

	const chainName = chainMap[chainId];
	if (!chainName) return undefined;
	const chainDef = getEVMChain(chainName);
	return rpcSettings.resolve(chainId, chainDef?.rpcUrl);
}

/**
 * Get deployment block for a chain (used as starting point for event queries)
 */
function getDeploymentBlock(chainId: number): bigint {
	const chainData = CONTRACT_ADDRESSES[chainId.toString()];
	if (chainData?.deploymentBlock) {
		return BigInt(chainData.deploymentBlock);
	}
	return chainId === 31337 ? 0n : 0n; // localhost = 0, others = 0 (fallback)
}

/**
 * GAS PRICE UTILITIES
 */

/**
 * Estimate appropriate gas fees for the current network
 * Returns priority fee and max fee suitable for proof generation
 * 
 * @param chainId - The chain ID
 * @returns Object with priorityFee and maxFee in wei
 */
export async function estimateGasFeesForProof(chainId: number): Promise<{
	priorityFee: bigint;
	maxFee: bigint;
}> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	// Check if this is localhost (Anvil)
	const isLocalhost = chainId === 31337;
	
	if (isLocalhost) {
		// For local development, use minimal fees (1 gwei)
		const oneGwei = 1_000_000_000n;
		return {
			priorityFee: oneGwei,
			maxFee: oneGwei * 2n, // 2 gwei total
		};
	}
	
	// For testnets/mainnet, estimate current gas prices
	try {
		// Get current gas price estimate from the network
		const feeData = await publicClient.estimateFeesPerGas();
		
		// Extract base fee and priority fee
		const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 2_000_000_000n; // Default 2 gwei
		const maxFeePerGas = feeData.maxFeePerGas || 50_000_000_000n; // Default 50 gwei
		
		// Use the network's priority fee, but ensure minimum of 2 gwei
		const minPriorityFee = 2_000_000_000n; // 2 gwei minimum
		const priorityFee = maxPriorityFeePerGas > minPriorityFee
			? maxPriorityFeePerGas
			: minPriorityFee;
		
		// Max fee should be at least 2x current base fee + priority fee to handle fluctuations
		// We'll use the network's estimate but ensure it's reasonable
		const minMaxFee = priorityFee * 25n; // At least 25x priority fee (e.g., 50 gwei if priority is 2 gwei)
		const maxFee = maxFeePerGas > minMaxFee ? maxFeePerGas : minMaxFee;
		
		console.log('Estimated gas fees for proof:');
		console.log('  Priority Fee:', (Number(priorityFee) / 1e9).toFixed(2), 'gwei');
		console.log('  Max Fee:', (Number(maxFee) / 1e9).toFixed(2), 'gwei');
		
		return {
			priorityFee,
			maxFee,
		};
	} catch (error) {
		console.error('Failed to estimate gas fees, using defaults:', error);
		// Fallback to conservative defaults for testnets
		return {
			priorityFee: 2_000_000_000n, // 2 gwei
			maxFee: 100_000_000_000n, // 100 gwei
		};
	}
}

/**
 * HASHING UTILITIES
 */

/**
 * Generate cryptographically secure random field element
 */
export function generateRandomField(): bigint {
	// Generate 32 random bytes
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	
	// Convert to bigint and ensure it's within field modulus
	let value = 0n;
	for (let i = 0; i < randomBytes.length; i++) {
		value = (value << 8n) | BigInt(randomBytes[i]);
	}
	
	// Reduce modulo field size
	return value % FIELD_MODULUS;
}

/**
 * Hash pre-commitment using Poseidon3
 * Matches backend: hashPreCommitment(nullifierPreimage, secret, chainId)
 */
export function hashPreCommitment(
	nullifierPreimage: bigint,
	secret: bigint,
	chainId: bigint
): bigint {
	return poseidon3([nullifierPreimage, secret, chainId]);
}

/**
 * Hash commitment using Poseidon2
 * Matches backend: hashCommitment(preCommitment, amount)
 */
export function hashCommitment(preCommitment: bigint, amount: bigint): bigint {
	return poseidon2([preCommitment, amount]);
}

/**
 * Create commitment pre-image
 */
export function createCommitmentPreImage(
	amount: bigint,
	destinationChainId: bigint
): CommitmentPreImage {
	return {
		amount,
		destination_chain_id: destinationChainId,
		secret: generateRandomField(),
		nullifier_preimg: generateRandomField(),
	};
}

/**
 * Encode note as JSON (matching Tornado Cash note style)
 */
export function encodeNote(
	commitmentPreImg: CommitmentPreImage,
	sourceChainId: bigint,
	preCommitment: bigint,
	commitment: bigint
): string {
	const noteData = {
		version: '1.0',
		protocol: 'warptoad',
		sourceChainId: sourceChainId.toString(),
		destinationChainId: commitmentPreImg.destination_chain_id.toString(),
		amount: commitmentPreImg.amount.toString(),
		secret: commitmentPreImg.secret.toString(),
		nullifier_preimg: commitmentPreImg.nullifier_preimg.toString(),
		preCommitment: preCommitment.toString(),
		commitment: commitment.toString(),
	};
	
	// Base64 encode the JSON
	const jsonStr = JSON.stringify(noteData);
	const base64 = btoa(jsonStr);
	
	return `warptoad-note-${base64}`;
}

/**
 * Decode note from string
 */
export function decodeNote(note: string): CommitmentPreImage & { 
	sourceChainId: bigint;
	preCommitment: bigint;
	commitment: bigint;
} {
	if (!note.startsWith('warptoad-note-')) {
		throw new Error('Invalid note format');
	}
	
	const base64 = note.replace('warptoad-note-', '');
	const jsonStr = atob(base64);
	const noteData = JSON.parse(jsonStr);
	
	return {
		amount: BigInt(noteData.amount),
		destination_chain_id: BigInt(noteData.destinationChainId),
		secret: BigInt(noteData.secret),
		nullifier_preimg: BigInt(noteData.nullifier_preimg),
		sourceChainId: BigInt(noteData.sourceChainId),
		preCommitment: BigInt(noteData.preCommitment),
		commitment: BigInt(noteData.commitment),
	};
}

/**
 * EVM CONTRACT INTERACTIONS
 */

/**
 * Get token decimals
 */
async function getTokenDecimals(
	tokenAddress: string,
	chainId: number
): Promise<number> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const decimals = await publicClient.readContract({
		address: tokenAddress as `0x${string}`,
		abi: USDcoinAbi,
		functionName: 'decimals',
	});
	
	return decimals;
}

/**
 * Check token allowance
 */
async function checkAllowance(
	tokenAddress: string,
	spenderAddress: string,
	ownerAddress: string,
	chainId: number
): Promise<bigint> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const allowance = await publicClient.readContract({
		address: tokenAddress as `0x${string}`,
		abi: USDcoinAbi,
		functionName: 'allowance',
		args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
	});
	
	return allowance;
}

/**
 * Approve WarpToad to spend tokens
 */
export async function approveWarpToad(
	tokenAddress: string,
	warpToadAddress: string,
	amount: bigint,
	chainId: number
): Promise<Hash> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const userAddress = (await client.getAddresses())[0];
	
	// Check current allowance
	const currentAllowance = await checkAllowance(
		tokenAddress,
		warpToadAddress,
		userAddress,
		chainId
	);
	
	if (currentAllowance >= amount) {
		console.log('Sufficient allowance already exists');
		return '0x0' as Hash; // No tx needed
	}
	
	// Approve
	const { request } = await publicClient.simulateContract({
		address: tokenAddress as `0x${string}`,
		abi: USDcoinAbi,
		account: userAddress,
		functionName: 'approve',
		args: [warpToadAddress as `0x${string}`, amount],
	});
	
	const hash = await client.writeContract(request);
	
	// Wait for confirmation
	await publicClient.waitForTransactionReceipt({ hash });
	
	return hash;
}

/**
 * Wrap native tokens into wrapped tokens
 */
export async function wrapTokens(
	warpToadAddress: string,
	amount: bigint,
	chainId: number
): Promise<Hash> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const userAddress = (await client.getAddresses())[0];
	
	const { request } = await publicClient.simulateContract({
		address: warpToadAddress as `0x${string}`,
		abi: L1WarpToadAbi,
		account: userAddress,
		functionName: 'wrap',
		args: [amount],
	});
	
	const hash = await client.writeContract(request);
	
	// Wait for confirmation
	await publicClient.waitForTransactionReceipt({ hash });
	
	return hash;
}

/**
 * Burn tokens and create commitment
 */
export async function burnTokens(
	warpToadAddress: string,
	amount: bigint,
	destinationChainId: bigint,
	chainId: number
): Promise<{
	commitmentPreImg: CommitmentPreImage;
	preCommitment: bigint;
	commitment: bigint;
	burnTxHash: Hash;
}> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
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
		address: warpToadAddress as `0x${string}`,
		abi: L1WarpToadAbi,
		account: userAddress,
		functionName: 'burn',
		args: [preCommitment, amount],
	});
	
	const burnTxHash = await client.writeContract(request);
	
	// Wait for confirmation
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
 * Main bridging orchestration function
 */
export async function bridgeToChain(
	token: Token,
	sourceChain: Chain,
	targetChain: Chain,
	amount: string,
	destinationChainId: bigint
): Promise<{
	note: string;
	commitmentPreImg: CommitmentPreImage;
	preCommitment: string;
	commitment: string;
	burnTxHash: string;
	approvalTxHash?: string;
	wrapTxHash?: string;
}> {
	// Get current chain ID
	const chainId = await getChainId();
	if (!chainId) throw new Error('Could not determine chain ID');
	
	// Get contract addresses
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	if (!addresses.USDcoin) throw new Error('Native token address not found');
	
	// Get token decimals and convert amount
	const decimals = await getTokenDecimals(addresses.USDcoin, chainId);
	const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));
	
	// Step 1: Approve tokens
	console.log('Step 1: Approving tokens...');
	const approvalTxHash = await approveWarpToad(
		addresses.USDcoin,
		addresses.L1WarpToad,
		amountBigInt,
		chainId
	);
	
	// Step 2: Wrap tokens
	console.log('Step 2: Wrapping tokens...');
	const wrapTxHash = await wrapTokens(
		addresses.L1WarpToad,
		amountBigInt,
		chainId
	);
	
	// Step 3: Burn tokens with commitment
	console.log('Step 3: Burning tokens and creating commitment...');
	const burnResult = await burnTokens(
		addresses.L1WarpToad,
		amountBigInt,
		destinationChainId,
		chainId
	);
	
	// Step 4: Create note
	console.log('Step 4: Creating note...');
	const note = encodeNote(
		burnResult.commitmentPreImg,
		BigInt(chainId),
		burnResult.preCommitment,
		burnResult.commitment
	);
	
	return {
		note,
		commitmentPreImg: burnResult.commitmentPreImg,
		preCommitment: burnResult.preCommitment.toString(),
		commitment: burnResult.commitment.toString(),
		burnTxHash: burnResult.burnTxHash,
		approvalTxHash: approvalTxHash !== '0x0' ? approvalTxHash : undefined,
		wrapTxHash,
	};
}

/**
 * TEST MINT FUNCTION FOR TEST TOKEN
 */
export async function mintFreeTokens(tokenInput: Token, chain: Chain, amount: number): Promise<void> {

	const token = TOKEN_CONTRACTS.find((b: any) => b.token === tokenInput);
	const chainId = await getChainId()
	if (!token || !chainId) return
	const chainKey = chain.toLowerCase() + "Address" as 'ethereumAddress' | 'scrollAddress' | 'aztecAddress';

	const client = createClient(chainId)
	if (!client) return

	//get decimals

	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	})

	const decimals = await publicClient.readContract({
		address: token[chainKey] as `0x${string}`,
		abi: USDcoinAbi,
		functionName: 'decimals',
	})

	if (!decimals) return

	//try to mint tokens

	try {

		const { request } = await publicClient.simulateContract({
			address: token[chainKey] as `0x${string}`,
			abi: USDcoinAbi,
			account: (await client.getAddresses())[0],
			functionName: 'getFreeShit',
			args: [BigInt(amount * 10 ** decimals)]
		})

		await client.writeContract(request)

	} catch (error) {
		throw error
	}

}

/**
 * BRIDGE SYNC FUNCTIONS
 * These functions trigger the bridge sync process (updateGigaRoot + sendGigaRoot)
 * This is typically done by a relayer, but can be triggered manually by a user with an L1 wallet
 */

/**
 * Store the current local root in history
 * This must be called before same-chain withdrawals to make the root valid
 * 
 * @param chainId - The chain ID
 * @returns Transaction hash if successful, undefined if skipped
 */
export async function storeL1LocalRootInHistory(chainId: number): Promise<string | undefined> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create wallet client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const userAddress = (await client.getAddresses())[0];
	
	console.log('Storing local root in history...');
	try {
		const { request } = await publicClient.simulateContract({
			address: addresses.L1WarpToad as `0x${string}`,
			abi: WarpToadAbi,
			account: userAddress,
			functionName: 'storeLocalRootInHistory',
		});
		
		const txHash = await client.writeContract(request);
		await publicClient.waitForTransactionReceipt({ hash: txHash });
		console.log('Local root stored:', txHash);
		return txHash;
	} catch (error) {
		console.log('storeLocalRootInHistory skipped (no new burns or already stored)');
		return undefined;
	}
}

/**
 * Trigger a bridge sync: updates the gigaRoot and sends it to all recipients
 * This calls:
 * 1. L1WarpToad.storeLocalRootInHistory() - to cache the current local root
 * 2. GigaBridge.updateGigaRoot() - to collect local roots and compute new gigaRoot  
 * 3. GigaBridge.sendGigaRoot() - to send the gigaRoot to all recipients
 * 
 * @param chainId - The L1 chain ID
 * @returns Transaction hashes for each step
 */
export async function triggerBridgeSync(chainId: number): Promise<{
	storeRootTxHash?: string;
	updateGigaRootTxHash: string;
	sendGigaRootTxHash: string;
}> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create wallet client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.GigaBridge) throw new Error('GigaBridge address not found');
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const userAddress = (await client.getAddresses())[0];
	
	// Step 1: Store local root in history (for L1WarpToad)
	console.log('Step 1: Storing local root in history...');
	let storeRootTxHash: string | undefined;
	try {
		const { request: storeRequest } = await publicClient.simulateContract({
			address: addresses.L1WarpToad as `0x${string}`,
			abi: WarpToadAbi,
			account: userAddress,
			functionName: 'storeLocalRootInHistory',
		});
		
		const storeHash = await client.writeContract(storeRequest);
		await publicClient.waitForTransactionReceipt({ hash: storeHash });
		storeRootTxHash = storeHash;
		console.log('Local root stored:', storeRootTxHash);
	} catch (error) {
		// This might fail if no new burns since last store, which is OK
		console.log('storeLocalRootInHistory skipped (no new burns or already stored)');
	}
	
	// Step 2: Update gigaRoot - collect local roots from all providers
	console.log('Step 2: Updating gigaRoot...');
	
	// Get local root providers - for now just L1WarpToad
	// In production, this would include L1AztecBridgeAdapter, L1ScrollBridgeAdapter, etc.
	const localRootProviders = [addresses.L1WarpToad];
	
	const { request: updateRequest } = await publicClient.simulateContract({
		address: addresses.GigaBridge as `0x${string}`,
		abi: GigaBridgeAbi,
		account: userAddress,
		functionName: 'updateGigaRoot',
		args: [localRootProviders as `0x${string}`[]],
	});
	
	const updateHash = await client.writeContract(updateRequest);
	await publicClient.waitForTransactionReceipt({ hash: updateHash });
	console.log('GigaRoot updated:', updateHash);
	
	// Step 3: Send gigaRoot to all recipients
	console.log('Step 3: Sending gigaRoot to recipients...');
	
	// Recipients are the same as providers for simplicity
	// amounts are 0 for non-payable recipients (L1WarpToad)
	const amounts = localRootProviders.map(() => 0n);
	
	const { request: sendRequest } = await publicClient.simulateContract({
		address: addresses.GigaBridge as `0x${string}`,
		abi: GigaBridgeAbi,
		account: userAddress,
		functionName: 'sendGigaRoot',
		args: [localRootProviders as `0x${string}`[], amounts],
	});
	
	const sendHash = await client.writeContract(sendRequest);
	await publicClient.waitForTransactionReceipt({ hash: sendHash });
	console.log('GigaRoot sent:', sendHash);
	
	return {
		storeRootTxHash,
		updateGigaRootTxHash: updateHash,
		sendGigaRootTxHash: sendHash,
	};
}

// =============================================================================
// CLAIM FROM AZTEC (L1 WITHDRAWAL)
// =============================================================================

/**
 * Get the current gigaRoot from L1 WarpToad contract
 */
export async function getL1GigaRoot(chainId: number): Promise<bigint> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const gigaRoot = await publicClient.readContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		functionName: 'gigaRoot',
	});
	
	return gigaRoot;
}

/**
 * Get the current local root from L1 WarpToad contract
 */
export async function getL1LocalRoot(chainId: number): Promise<bigint> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const localRoot = await publicClient.readContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		functionName: 'cachedLocalRoot',
	});
	
	return localRoot;
}

/**
 * Convert a 32-byte padded hex string to a proper 20-byte Ethereum address
 * 
 * The ZK circuit uses 32-byte (Field) representation for addresses,
 * but viem requires proper 20-byte addresses. This extracts the last
 * 20 bytes (40 hex chars) from the padded representation.
 * 
 * @param paddedHex - 32-byte hex string (64 chars + 0x prefix)
 * @returns 20-byte Ethereum address
 */
function paddedHexToAddress(paddedHex: string): `0x${string}` {
	// Remove 0x prefix if present
	const clean = paddedHex.startsWith('0x') ? paddedHex.slice(2) : paddedHex;
	// Take last 40 hex chars (20 bytes) - addresses are right-aligned in 32-byte fields
	const addressHex = clean.slice(-40);
	return `0x${addressHex}` as `0x${string}`;
}

/**
 * Proof inputs type for L1 claim operations
 */
export interface ClaimProofInputs {
	nullifier: string;
	amount: string;
	giga_root: string;
	destination_local_root: string;
	fee_factor: string;
	priority_fee: string;
	max_fee: string;
	relayer_address: string;
	recipient_address: string;
}

/**
 * Claim tokens on L1 by calling the mint function with a ZK proof
 * 
 * This is the core withdrawal function for L1. It can be used for:
 * - Aztec -> L1 withdrawals
 * - Scroll -> L1 withdrawals  
 * - L1 -> L1 same-chain private transfers
 * 
 * @param proofInputs - The proof inputs (public inputs)
 * @param proof - The ZK proof bytes (hex encoded)
 * @param chainId - The L1 chain ID
 * @param logPrefix - Optional prefix for log messages (e.g., "Aztec -> L1", "L1 -> L1")
 * @returns Transaction hash
 */
export async function claimOnL1(
	proofInputs: ClaimProofInputs,
	proof: string,
	chainId: number,
	logPrefix: string = 'L1'
): Promise<{ txHash: string }> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const userAddress = (await client.getAddresses())[0];
	
	console.log(`Claiming on L1 (${logPrefix})...`);
	console.log('Nullifier:', proofInputs.nullifier);
	console.log('Amount:', proofInputs.amount);
	console.log('GigaRoot:', proofInputs.giga_root);
	console.log('Recipient:', proofInputs.recipient_address);
	
	// Get current network gas prices (these are separate from the proof's fee params)
	const { priorityFee: currentPriorityFee, maxFee: currentMaxFee } = await estimateGasFeesForProof(chainId);
	console.log('Using gas prices:');
	console.log('  Priority Fee:', (Number(currentPriorityFee) / 1e9).toFixed(2), 'gwei');
	console.log('  Max Fee:', (Number(currentMaxFee) / 1e9).toFixed(2), 'gwei');
	
	// Estimate gas for the transaction
	const gasEstimate = await publicClient.estimateContractGas({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
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
	});
	
	// Add 20% buffer to gas estimate
	const gasLimit = (gasEstimate * 120n) / 100n;
	console.log('Gas estimate:', gasEstimate.toString(), 'Gas limit:', gasLimit.toString());
	
	// Call mint function on L1WarpToad
	const { request } = await publicClient.simulateContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
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
		// Use current network gas prices (NOT the proof's fee params)
		maxPriorityFeePerGas: currentPriorityFee,
		maxFeePerGas: currentMaxFee,
		gas: gasLimit,
	});
	
	const txHash = await client.writeContract(request);
	await publicClient.waitForTransactionReceipt({ hash: txHash });
	
	console.log('Claim transaction completed:', txHash);
	return { txHash };
}

/**
 * Claim tokens on L1 from an Aztec burn
 * 
 * This is a convenience wrapper around claimOnL1 for the Aztec -> L1 flow.
 * 
 * @param proofInputs - The proof inputs (public inputs)
 * @param proof - The ZK proof bytes (hex encoded)
 * @param chainId - The L1 chain ID
 * @returns Transaction hash
 */
export async function claimFromAztec(
	proofInputs: ClaimProofInputs,
	proof: string,
	chainId: number
): Promise<{ txHash: string }> {
	return claimOnL1(proofInputs, proof, chainId, 'Aztec -> L1');
}

/**
 * Claim tokens on L1 and automatically unwrap to native token
 * 
 * This combines mint + unwrap in two transactions.
 * Note: Once L1WarpToad.mintAndUnwrap() is implemented, this can be done in one tx.
 * 
 * @param proofInputs - The proof inputs
 * @param proof - The ZK proof bytes (hex encoded)
 * @param chainId - The L1 chain ID
 * @param logPrefix - Optional prefix for log messages
 * @returns Transaction hashes
 */
export async function claimAndUnwrapOnL1(
	proofInputs: ClaimProofInputs,
	proof: string,
	chainId: number,
	logPrefix: string = 'L1'
): Promise<{ mintTxHash: string; unwrapTxHash: string }> {
	// First, mint the wrapped tokens
	const { txHash: mintTxHash } = await claimOnL1(proofInputs, proof, chainId, logPrefix);
	
	// Calculate the amount received (after relayer fee)
	const amount = BigInt(proofInputs.amount);
	const feeFactor = BigInt(proofInputs.fee_factor);
	let amountToUnwrap = amount;
	
	if (feeFactor !== 0n) {
		// Fee is calculated as: feeFactor * (baseFee + priorityFee)
		// For simplicity, we'll just use max_fee as upper bound
		// The actual fee will be less, but we can't know the exact baseFee here
		// TODO: This should be improved to get the actual fee from the mint tx receipt
		const maxFee = BigInt(proofInputs.max_fee);
		amountToUnwrap = amount - maxFee;
	}
	
	// Then unwrap to native token
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const userAddress = (await client.getAddresses())[0];
	
	console.log('Unwrapping tokens...');
	console.log('Amount to unwrap:', amountToUnwrap.toString());
	
	const { request } = await publicClient.simulateContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		account: userAddress,
		functionName: 'unwrap',
		args: [amountToUnwrap],
	});
	
	const unwrapTxHash = await client.writeContract(request);
	await publicClient.waitForTransactionReceipt({ hash: unwrapTxHash });
	
	console.log('Unwrap transaction completed:', unwrapTxHash);
	return { mintTxHash, unwrapTxHash };
}

/**
 * Claim tokens on L1 from Aztec and automatically unwrap to native token
 * 
 * This is a convenience wrapper around claimAndUnwrapOnL1 for the Aztec -> L1 flow.
 * 
 * @param proofInputs - The proof inputs
 * @param proof - The ZK proof bytes (hex encoded)
 * @param chainId - The L1 chain ID
 * @returns Transaction hashes
 */
export async function claimAndUnwrapFromAztec(
	proofInputs: ClaimProofInputs,
	proof: string,
	chainId: number
): Promise<{ mintTxHash: string; unwrapTxHash: string }> {
	return claimAndUnwrapOnL1(proofInputs, proof, chainId, 'Aztec -> L1');
}

// =============================================================================
// EVM MERKLE DATA FOR SAME-CHAIN WITHDRAWALS
// =============================================================================

import { MerkleTree, type Element } from 'fixed-merkle-tree';

// EVM tree depth constant (matches backend)
const EVM_TREE_DEPTH = 32;

/**
 * EVM Merkle data structure for proof generation
 */
export interface EvmMerkleData {
	leaf_index: bigint;
	hash_path: bigint[];
}

/**
 * Query Burn events from L1WarpToad contract in chunks.
 * Thin adapter over queryEventInChunks that preserves the original tuple shape.
 *
 * Defaults to reverseOrder when `maxEvents` is supplied so callers that know
 * the exact leaf count (via lastLeafIndex) stop scanning as soon as the tree
 * is whole, instead of walking deployment → head every time.
 */
async function queryBurnEventsInChunks(
	publicClient: ReturnType<typeof createPublicClient>,
	warpToadAddress: `0x${string}`,
	fromBlock: bigint,
	toBlock: bigint,
	opts: { reverseOrder?: boolean; maxEvents?: number; chunkSize?: bigint } = {}
): Promise<{ commitment: bigint; amount: bigint; index: bigint }[]> {
	const logs = await queryEventInChunks({
		publicClient: publicClient as any,
		contract: { address: warpToadAddress, abi: L1WarpToadAbi },
		eventName: 'Burn',
		firstBlock: fromBlock,
		lastBlock: toBlock,
		reverseOrder: opts.reverseOrder,
		maxEvents: opts.maxEvents,
		chunkSize: opts.chunkSize,
	});

	return logs.map((log: any) => ({
		commitment: log.args.commitment as bigint,
		amount: log.args.amount as bigint,
		index: log.args.index as bigint,
	}));
}

/**
 * Check if a local root exists in history
 */
export async function isValidL1LocalRoot(chainId: number, localRoot: bigint): Promise<boolean> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	const isValid = await publicClient.readContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		functionName: 'localRootHistory',
		args: [localRoot],
	});
	
	return isValid;
}

/**
 * Get EVM merkle data for a commitment on L1
 * Used for same-chain withdrawals (L1 -> L1 or Scroll -> Scroll)
 * 
 * This function:
 * 1. Queries Burn events from the WarpToad contract
 * 2. Builds a merkle tree from the commitments using poseidon2
 * 3. Generates the merkle proof path for the given commitment
 * 
 * @param chainId - The chain ID
 * @param commitment - The commitment to get merkle data for
 * @param localRootBlockNumber - Optional block number to limit event query
 * @returns EVM merkle data with leaf index and hash path
 */
export async function getEvmMerkleDataForL1(
	chainId: number,
	commitment: bigint,
	localRootBlockNumber?: number
): Promise<{evmMerkleData:EvmMerkleData, aztecWarptoadAddress:bigint}> {
	const client = createClient(chainId);
	if (!client) throw new Error('Failed to create client');
	
	const rpcUrl = getRpcUrl(chainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(chainId);
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	// Get current block number if not specified
	const toBlock = localRootBlockNumber
		? BigInt(localRootBlockNumber)
		: await publicClient.getBlockNumber();

	// Query from deployment block to avoid scanning entire chain history
	const fromBlock = getDeploymentBlock(chainId);

	// Read the leaf count at toBlock so we know exactly how many Burn events to
	// collect; indices are sequential 0..N-1 so total == lastLeafIndex.
	const lastLeafIndex = (await publicClient.readContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		functionName: 'lastLeafIndex',
		blockNumber: toBlock,
	})) as bigint;
	const totalLeaves = Number(lastLeafIndex);

	console.log(`Querying ${totalLeaves} Burn events from block ${fromBlock} to ${toBlock}...`);

	// Reverse-scan and stop as soon as we've collected all leaves. Burns cluster
	// near the head in practice, so this usually short-circuits after a few
	// chunks instead of scanning the full deployment→head window.
	const burnEvents = totalLeaves > 0
		? await queryBurnEventsInChunks(
			publicClient,
			addresses.L1WarpToad as `0x${string}`, 	// @TODO danish docstring says this function can do scroll<->scroll but here address is L1Warptoad only!
			fromBlock,
			toBlock,
			{ reverseOrder: true, maxEvents: totalLeaves }
		)
		: [];

	// @TODO danish here i make the same wrong assumption like above! Sorry!
	// address: can both be a L1Warptoad or L2WarptoadScroll doesn't matter!
	// or even get address somewhere else ofc, without a contract call
	const aztecWarptoadAddress = await publicClient.readContract({
		address: addresses.L1WarpToad as `0x${string}`,
		abi: L1WarpToadAbi,
		functionName: 'aztecWarptoadAddress',
	})


	console.log(`Found ${burnEvents.length} Burn events`);
	
	// Sort events by index to ensure correct tree construction
	burnEvents.sort((a, b) => Number(a.index - b.index));
	
	// Extract commitments as leaves
	const leaves = burnEvents.map(e => e.commitment);
	
	// Find our commitment's index
	const leafIndex = burnEvents.findIndex(e => e.commitment === commitment);
	if (leafIndex === -1) {
		throw new Error(
			`Commitment not found in burn events. ` +
			`Make sure the burn transaction was confirmed and the local root has been stored.`
		);
	}
	
	console.log(`Commitment found at index ${leafIndex}`);
	
	// Build merkle tree using poseidon2 hash function
	// Note: fixed-merkle-tree expects string returns but works with bigint internally
	const hashFunc = (left: Element, right: Element): string => {
		const result = poseidon2([BigInt(left.toString()), BigInt(right.toString())]);
		return result.toString();
	};

	const tree = new MerkleTree(EVM_TREE_DEPTH, leaves.map(l => l.toString()), {
		hashFunction: hashFunc,
		zeroElement: '0'
	});
	
	// Verify the tree root matches what's stored on-chain
	const treeRoot = BigInt(tree.root.toString());
	const isValidRoot = await isValidL1LocalRoot(chainId, treeRoot);
	
	if (!isValidRoot) {
		console.warn(
			`Warning: Computed tree root ${treeRoot} is not in local root history. ` +
			`The local root may not have been stored yet. Call storeLocalRootInHistory() first.`
		);
	}
	
	// Get merkle proof
	const proof = tree.proof(commitment.toString());
	const hashPath = proof.pathElements.map(e => BigInt(e.toString()));
	
	return {
		evmMerkleData: {
			leaf_index: BigInt(leafIndex),
			hash_path: hashPath,
		}, aztecWarptoadAddress
	};
}

/**
 * Get the current local root and verify it exists in history
 * Returns both the root and its validity status
 */
export async function getL1LocalRootWithValidity(chainId: number): Promise<{
	localRoot: bigint;
	isValid: boolean;
}> {
	const localRoot = await getL1LocalRoot(chainId);
	const isValid = await isValidL1LocalRoot(chainId, localRoot);
	return { localRoot, isValid };
}

// ============================================================================
// GIGABRIDGE MERKLE DATA
// ============================================================================

/**
 * Get GigaBridge merkle data for L1 → Scroll withdrawal
 * Proves that L1's localRoot exists in the gigaRoot on Scroll
 * 
 * @param l1ChainId - L1 chain ID (where GigaBridge lives)
 * @param gigaRoot - The gigaRoot to search for L1's local root in
 * @returns L1 local root, block number, and giga merkle proof
 */
export async function getMerkleDataForL1ToScroll(
	l1ChainId: number,
	gigaRoot: bigint
): Promise<{
	l1LocalRoot: bigint;
	l1LocalRootBlockNumber: number;
	gigaMerkleData: EvmMerkleData;
}> {
	const client = createClient(l1ChainId);
	if (!client) throw new Error('Failed to create client for L1');
	
	const rpcUrl = getRpcUrl(l1ChainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(l1ChainId);
	if (!addresses.GigaBridge) throw new Error('GigaBridge address not found');
	if (!addresses.L1WarpToad) throw new Error('L1WarpToad address not found');
	
	// Step 1: Find when this gigaRoot was constructed
	console.log(`Searching for ConstructedNewGigaRoot event for gigaRoot: ${gigaRoot.toString()}`);
	
	const fromBlock = getDeploymentBlock(l1ChainId);
	const toBlock = await publicClient.getBlockNumber();

	const gigaRootEvents = await queryEventInChunks({
		publicClient,
		contract: { address: addresses.GigaBridge as `0x${string}`, abi: GigaBridgeAbi },
		eventName: 'ConstructedNewGigaRoot',
		eventFilterArgs: { newGigaRoot: gigaRoot },
		firstBlock: fromBlock,
		lastBlock: toBlock,
		reverseOrder: true,
		maxEvents: 1,
	});

	if (gigaRootEvents.length === 0) {
		throw new Error(
			`GigaRoot ${gigaRoot} not found on L1. ` +
			`Please wait for bridge sync to complete.`
		);
	}

	const gigaRootBlock = gigaRootEvents[0].blockNumber;
	console.log(`Found gigaRoot at block ${gigaRootBlock}`);

	// Step 2: Get L1WarpToad's index in the giga tree
	const l1WarpToadIndex = await publicClient.readContract({
		address: addresses.GigaBridge as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'getLocalRootProvidersIndex',
		args: [addresses.L1WarpToad as `0x${string}`]
	});
	
	console.log(`L1WarpToad index in giga tree: ${l1WarpToadIndex}`);
	
	// Step 3: Get all local roots at that block (to build giga tree)
	console.log(`Querying ReceivedNewLocalRoot events at block ${gigaRootBlock}...`);
	
	const localRootEvents = await publicClient.getLogs({
		address: addresses.GigaBridge as `0x${string}`,
		event: {
			type: 'event',
			name: 'ReceivedNewLocalRoot',
			inputs: [
				{ type: 'uint256', name: 'newLocalRoot', indexed: true },
				{ type: 'uint40', name: 'localRootIndex', indexed: true },
				{ type: 'uint256', name: 'localRootBlockNumber', indexed: false }
			]
		},
		fromBlock: gigaRootBlock,
		toBlock: gigaRootBlock
	});
	
	console.log(`Found ${localRootEvents.length} local root events at block ${gigaRootBlock}`);
	
	// Step 4: Build the giga tree leaves array
	// We need to find the maximum index to know the tree size
	const maxTreeDepth = await publicClient.readContract({
		address: addresses.GigaBridge as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'maxTreeDepth'
	});
	
	const maxLeaves = 2 ** Number(maxTreeDepth);
	const leaves: bigint[] = new Array(maxLeaves).fill(0n);
	
	let l1LocalRoot: bigint | null = null;
	let l1LocalRootBlockNumber = 0;
	
	// Fill in the leaves from events
	for (const event of localRootEvents) {
		const localRoot = event.args.newLocalRoot as bigint;
		const leafIndex = Number(event.args.localRootIndex as bigint | undefined);
		const blockNumber = Number(event.args.localRootBlockNumber as bigint | undefined);
		
		leaves[leafIndex] = localRoot;
		
		// Check if this is L1WarpToad's local root
		if (leafIndex === Number(l1WarpToadIndex)) {
			l1LocalRoot = localRoot;
			l1LocalRootBlockNumber = blockNumber;
		}
	}
	
	if (l1LocalRoot === null) {
		throw new Error(
			`L1WarpToad local root not found in giga tree at block ${gigaRootBlock}. ` +
			`This should not happen - the gigaRoot should contain L1's local root.`
		);
	}
	
	console.log(`L1 local root: ${l1LocalRoot.toString()}`);
	console.log(`L1 local root block number: ${l1LocalRootBlockNumber}`);
	
	// Step 5: Build merkle tree and get proof
	const hashFunc = (left: Element, right: Element): string => {
		const result = poseidon2([BigInt(left.toString()), BigInt(right.toString())]);
		return result.toString();
	};
	
	const gigaTree = new MerkleTree(Number(maxTreeDepth), leaves.map(l => l.toString()), {
		hashFunction: hashFunc,
		zeroElement: '0'
	});
	
	// Verify tree root matches gigaRoot
	const computedRoot = BigInt(gigaTree.root.toString());
	if (computedRoot !== gigaRoot) {
		console.warn(
			`Warning: Computed giga tree root ${computedRoot} ` +
			`does not match expected gigaRoot ${gigaRoot}`
		);
	}
	
	// Get merkle proof for L1's local root
	const proof = gigaTree.proof(l1LocalRoot.toString());
	const hashPath = proof.pathElements.map(e => BigInt(e.toString()));
	
	return {
		l1LocalRoot,
		l1LocalRootBlockNumber,
		gigaMerkleData: {
			leaf_index: BigInt(l1WarpToadIndex),
			hash_path: hashPath
		}
	};
}

/**
 * Get GigaBridge merkle data for Scroll → L1 withdrawal
 * Proves that Scroll's localRoot exists in the gigaRoot on L1
 * 
 * @param l1ChainId - L1 chain ID (where GigaBridge lives)
 * @param gigaRoot - The gigaRoot to search for Scroll's local root in
 * @returns Scroll local root, block number, and giga merkle proof
 */
export async function getMerkleDataForScrollToL1(
	l1ChainId: number,
	gigaRoot: bigint
): Promise<{
	scrollLocalRoot: bigint;
	scrollLocalRootBlockNumber: number;
	gigaMerkleData: EvmMerkleData;
}> {
	const client = createClient(l1ChainId);
	if (!client) throw new Error('Failed to create client for L1');
	
	const rpcUrl = getRpcUrl(l1ChainId);
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http(rpcUrl)
	});
	
	const addresses = getContractAddresses(l1ChainId);
	if (!addresses.GigaBridge) throw new Error('GigaBridge address not found');
	if (!addresses.L1ScrollBridgeAdapter) throw new Error('L1ScrollBridgeAdapter address not found');
	
	// Step 1: Find when this gigaRoot was constructed
	console.log(`Searching for ConstructedNewGigaRoot event for gigaRoot: ${gigaRoot.toString()}`);
	
	const fromBlock = getDeploymentBlock(l1ChainId);
	const toBlock = await publicClient.getBlockNumber();

	const gigaRootEvents = await queryEventInChunks({
		publicClient,
		contract: { address: addresses.GigaBridge as `0x${string}`, abi: GigaBridgeAbi },
		eventName: 'ConstructedNewGigaRoot',
		eventFilterArgs: { newGigaRoot: gigaRoot },
		firstBlock: fromBlock,
		lastBlock: toBlock,
		reverseOrder: true,
		maxEvents: 1,
	});

	if (gigaRootEvents.length === 0) {
		throw new Error(
			`GigaRoot ${gigaRoot} not found on L1. ` +
			`Please wait for bridge sync to complete.`
		);
	}

	const gigaRootBlock = gigaRootEvents[0].blockNumber;
	console.log(`Found gigaRoot at block ${gigaRootBlock}`);

	// Step 2: Read tree shape and the scroll adapter's index in parallel
	const [scrollAdapterIndexRaw, amountOfLocalRootsRaw, maxTreeDepthRaw] = await Promise.all([
		publicClient.readContract({
			address: addresses.GigaBridge as `0x${string}`,
			abi: GigaBridgeAbi,
			functionName: 'getLocalRootProvidersIndex',
			args: [addresses.L1ScrollBridgeAdapter as `0x${string}`]
		}),
		publicClient.readContract({
			address: addresses.GigaBridge as `0x${string}`,
			abi: GigaBridgeAbi,
			functionName: 'amountOfLocalRoots',
		}),
		publicClient.readContract({
			address: addresses.GigaBridge as `0x${string}`,
			abi: GigaBridgeAbi,
			functionName: 'maxTreeDepth'
		})
	]);
	const scrollAdapterIndex = Number(scrollAdapterIndexRaw);
	const amountOfLocalRoots = Number(amountOfLocalRootsRaw);
	const maxTreeDepth = Number(maxTreeDepthRaw);

	console.log(`L1ScrollBridgeAdapter index in giga tree: ${scrollAdapterIndex}`);
	console.log(`Reconstructing ${amountOfLocalRoots} giga tree leaves at or before block ${gigaRootBlock}...`);

	// Step 3: Walk events backward per-index. updateGigaRoot only emits
	// ReceivedNewLocalRoot for the providers passed in that call; other
	// providers' local roots stay in the tree from earlier updates and
	// silently flow into the new gigaRoot. So for each index we need its
	// most-recent event at or before the construction block.
	const indexEvents = await Promise.all(
		Array.from({ length: amountOfLocalRoots }, (_, i) =>
			getLatestLocalRootEventForIndex(
				publicClient,
				addresses.GigaBridge as string,
				l1ChainId,
				i,
				gigaRootBlock
			)
		)
	);

	const maxLeaves = 2 ** maxTreeDepth;
	const leaves: bigint[] = new Array(maxLeaves).fill(0n);

	let scrollLocalRoot: bigint | null = null;
	let scrollLocalRootBlockNumber = 0;

	for (let i = 0; i < amountOfLocalRoots; i++) {
		const event = indexEvents[i];
		if (!event) continue;
		leaves[i] = event.localRoot;
		if (i === scrollAdapterIndex) {
			scrollLocalRoot = event.localRoot;
			scrollLocalRootBlockNumber = event.blockNumber;
		}
	}

	if (scrollLocalRoot === null) {
		throw new Error(
			`Scroll local root not found in giga tree at block ${gigaRootBlock}. ` +
			`L1ScrollBridgeAdapter (index ${scrollAdapterIndex}) has never emitted a ReceivedNewLocalRoot at or before that block.`
		);
	}
	
	console.log(`Scroll local root: ${scrollLocalRoot.toString()}`);
	console.log(`Scroll local root block number: ${scrollLocalRootBlockNumber}`);
	
	// Step 5: Build merkle tree and get proof
	const hashFunc = (left: Element, right: Element): string => {
		const result = poseidon2([BigInt(left.toString()), BigInt(right.toString())]);
		return result.toString();
	};
	
	const gigaTree = new MerkleTree(Number(maxTreeDepth), leaves.map(l => l.toString()), {
		hashFunction: hashFunc,
		zeroElement: '0'
	});
	
	// Verify tree root matches gigaRoot
	const computedRoot = BigInt(gigaTree.root.toString());
	if (computedRoot !== gigaRoot) {
		console.warn(
			`Warning: Computed giga tree root ${computedRoot} ` +
			`does not match expected gigaRoot ${gigaRoot}`
		);
	}
	
	// Get merkle proof for Scroll's local root
	const proof = gigaTree.proof(scrollLocalRoot.toString());
	const hashPath = proof.pathElements.map(e => BigInt(e.toString()));
	
	return {
		scrollLocalRoot,
		scrollLocalRootBlockNumber,
		gigaMerkleData: {
			leaf_index: BigInt(scrollAdapterIndex),
			hash_path: hashPath
		}
	};
}