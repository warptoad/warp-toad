import type { Chain, Token, CommitmentPreImage } from '$lib/types/bridge.js';
import { TOKEN_CONTRACTS } from '$lib/stores/proofs.svelte';
import { USDcoinAbi, L1WarpToadAbi } from '$lib/contracts/abis';
import { createClient, getChainId } from './evm-wallet';
import { createPublicClient, http, type Hash } from 'viem';
import { getContractAddresses } from '$lib/contracts/addresses';
import { poseidon2, poseidon3 } from 'poseidon-lite';

// Field size for BN254 curve (used by Aztec)
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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

    const token = TOKEN_CONTRACTS.find(b => b.token === tokenInput);
    const chainId = await getChainId()
    if (!token || !chainId) return
    const chainKey = chain.toLowerCase() + "Address" as 'ethereumAddress' | 'scrollAddress' | 'aztecAddress';

    const client = createClient(chainId)
    if (!client) return

    //get decimals

    const publicClient = createPublicClient({
        chain: client.chain,
        transport: http()
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

import { GigaBridgeAbi, L1WarpToadAbi as WarpToadAbi } from '$lib/contracts/abis';

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
	
	const publicClient = createPublicClient({
		chain: client.chain,
		transport: http()
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