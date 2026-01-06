/**
 * Aztec interactions for cross-chain bridging
 * 
 * This module handles bidirectional bridging between L1 (EVM) and Aztec L2.
 * 
 * L1 -> Aztec flow:
 * 1. User burns tokens on L1 with a commitment
 * 2. Relayer bridges the local root to GigaBridge, which creates a gigaRoot
 * 3. GigaRoot is sent to Aztec WarpToad contract
 * 4. User can withdraw on Aztec by proving their commitment is in the tree
 * 
 * Aztec -> L1 flow:
 * 1. User burns tokens on Aztec with a commitment (stored as WarpToadNote)
 * 2. Relayer bridges the Aztec note hash tree root to L1 GigaBridge
 * 3. GigaRoot is updated on L1
 * 4. User generates ZK proof and claims on L1 (with optional auto-unwrap)
 */

import type { CommitmentPreImage } from '$lib/types/bridge';
import { createPublicClient, http, keccak256, toHex, type PublicClient } from 'viem';
import { getContractAddresses, CONTRACT_ADDRESSES } from '$lib/contracts/addresses';
import { GigaBridgeAbi } from '$lib/contracts/abis';
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite';
import { MerkleTree, type Element } from 'fixed-merkle-tree';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { AztecNode } from '@aztec/aztec.js/node';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../../../backend/contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import { AZTEC_CONTRACTS, AZTEC_CONFIG, L1_CONFIG } from '$lib/config/environment.js';
import { Fr } from '@aztec/aztec.js/fields';
import { MerkleTreeId } from '@aztec/stdlib/trees';
import { siloNullifier } from '@aztec/stdlib/hash';


// =============================================================================
// CONSTANTS
// =============================================================================

const EVM_TREE_DEPTH = 32;
const GIGA_TREE_DEPTH = 5;

// Environment configuration
const getAztecNodeUrl = () => AZTEC_CONFIG.nodeUrl;

/**
 * Get deployment block for a chain (fallback to recent blocks if not available)
 * This prevents scanning from block 0 which would timeout on testnets
 */
function getDeploymentBlock(chainId: number): bigint {
	const chainData = CONTRACT_ADDRESSES[chainId.toString()];
	if (chainData?.deploymentBlock) {
		return BigInt(chainData.deploymentBlock);
	}
	// Fallback: use 0 for localhost, recent blocks for others
	return chainId === 31337 ? 0n : 0n; // Will be replaced with current block - 10000 in actual calls
}

// =============================================================================
// TYPES
// =============================================================================

export interface EvmMerkleData {
	leaf_index: bigint;
	hash_path: bigint[];
}

export interface MerkleDataResult {
	blockNumber: number;
	originLocalRoot: bigint;
	gigaMerkleData: EvmMerkleData;
	evmMerkleData: EvmMerkleData;
}

interface LocalRootData {
	localRoot: bigint;
	localRootIndex: number;
	localRootBlockNumber: number;
	gigaRootBlockNumber: number;
}

/**
 * Aztec merkle data for proving commitment inclusion in note hash tree
 * Used for Aztec -> L1 withdrawals
 */
export interface AztecMerkleData {
	leaf_index: bigint;
	hash_path: bigint[];
	leaf_nonce: bigint;
	contract_address: bigint;
}

/**
 * Result of burning tokens on Aztec
 */
export interface AztecBurnResult {
	secret: bigint;
	nullifierPreimage: bigint;
	preCommitment: bigint;
	commitment: bigint;
	burnTxHash: string;
	blockNumber: number;
}

// Aztec tree depth for note hash tree
const AZTEC_TREE_DEPTH = 42;

// Generator indexes for Aztec note hashing (from Aztec protocol constants)
const GENERATOR_INDEX__NOTE_HASH_NONCE = 2n;
const GENERATOR_INDEX__UNIQUE_NOTE_HASH = 3n;
const GENERATOR_INDEX__SILOED_NOTE_HASH = 4n;

// =============================================================================
// AZTEC NODE CLIENT
// =============================================================================

let aztecNodeInstance: AztecNode | null = null;

/**
 * Get or create Aztec node client
 */
export async function getAztecNode(): Promise<AztecNode> {
	if (aztecNodeInstance) {
		return aztecNodeInstance;
	}

	const nodeUrl = getAztecNodeUrl();
	console.log('Creating Aztec Node Client at:', nodeUrl);

	aztecNodeInstance = createAztecNodeClient(nodeUrl);

	try {
		const nodeInfo = await aztecNodeInstance.getNodeInfo();
		console.log('Connected to Aztec sandbox version:', nodeInfo.nodeVersion);
		console.log('L1 Chain ID:', nodeInfo.l1ChainId);
	} catch (error) {
		console.error('Failed to connect to Aztec node:', error);
		aztecNodeInstance = null;
		throw new Error(
			`Cannot connect to Aztec node at ${nodeUrl}. ` +
			'Make sure the sandbox is running: aztec start --sandbox'
		);
	}

	return aztecNodeInstance;
}

// =============================================================================
// WARPTOAD CONTRACT
// =============================================================================

/**
 * Get WarpToadCore contract instance connected to wallet
 */
export async function getWarpToadContract(wallet: Wallet): Promise<WarpToadCoreContract> {
	const contract = await getContractInstanceFromInstantiationParams(
		WarpToadCoreContractArtifact,
		{
			constructorArgs: AZTEC_CONTRACTS.AztecWarpToad.constructorArgs,
			deployer: AztecAddress.fromString(AZTEC_CONTRACTS.AztecWarpToad.deployer),
			salt: Fr.fromHexString(AZTEC_CONTRACTS.AztecWarpToad.contractAddressSalt),
		}
	);

	const registeredContract = await wallet.registerContract(
		contract,
		WarpToadCoreContractArtifact
	);

	const warptoadContract = await WarpToadCoreContract.at(registeredContract.address, wallet);

	return warptoadContract;
}

// =============================================================================
// HASHING UTILITIES
// =============================================================================

/**
 * Hash pre-commitment: poseidon3(nullifier_preimage, secret, chain_id)
 */
export function hashPreCommitment(
	nullifierPreimage: bigint,
	secret: bigint,
	chainId: bigint
): bigint {
	return poseidon3([nullifierPreimage, secret, chainId]);
}

/**
 * Hash commitment: poseidon2(pre_commitment, amount)
 */
export function hashCommitment(preCommitment: bigint, amount: bigint): bigint {
	return poseidon2([preCommitment, amount]);
}

/**
 * Hash nullifier: poseidon1(nullifier_preimage)
 * This matches the Noir circuit: poseidon::bn254::hash_1([nullifier_preimage])
 */
export function hashNullifier(nullifierPreimage: bigint): bigint {
	return poseidon1([nullifierPreimage]);
}

// =============================================================================
// EVM CLIENT HELPERS
// =============================================================================

/**
 * Create a public client for the given chain
 */
function createEvmClient(chainId: number, rpcUrl?: string): PublicClient {
	// Use environment config for RPC URLs
	let defaultRpcUrl: string;
	if (chainId === L1_CONFIG.chainId || chainId === 31337) {
		defaultRpcUrl = L1_CONFIG.rpcUrl;
	} else if (chainId === 11155111) {
		defaultRpcUrl = 'https://sepolia.drpc.org';
	} else if (chainId === 534351) {
		defaultRpcUrl = 'https://sepolia-rpc.scroll.io';
	} else {
		defaultRpcUrl = 'http://localhost:8545';
	}

	return createPublicClient({
		chain: {
			id: chainId,
			name: chainId === 31337 ? 'Localhost' : chainId === 11155111 ? 'Sepolia' : `Chain ${chainId}`,
			nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
			rpcUrls: {
				default: { http: [rpcUrl || defaultRpcUrl] },
				public: { http: [rpcUrl || defaultRpcUrl] },
			},
		},
		transport: http()
	});
}

// =============================================================================
// MERKLE TREE HELPERS
// =============================================================================

/**
 * Poseidon2 hash function wrapper for fixed-merkle-tree
 * The library expects (left, right) => hash
 */
const poseidonHashFunction = (left: Element, right: Element): string => {
	const result = poseidon2([BigInt(left.toString()), BigInt(right.toString())]);
	return result.toString();
};

/**
 * Create a Poseidon merkle tree using fixed-merkle-tree library
 * This handles sparse trees efficiently without allocating 2^depth elements
 */
function createPoseidonMerkleTree(depth: number, leaves: bigint[]): MerkleTree {
	// Convert bigints to strings for the library
	const leavesAsStrings = leaves.map(l => l.toString());
	return new MerkleTree(depth, leavesAsStrings, { hashFunction: poseidonHashFunction });
}

/**
 * Get merkle proof from a tree
 * Returns the path elements and leaf index in the format expected by the contract
 */
function getMerkleProof(tree: MerkleTree, leafValue: bigint): { pathElements: bigint[]; leafIndex: number } {
	const proof = tree.proof(leafValue.toString() as Element);

	return {
		pathElements: proof.pathElements.map(e => BigInt(e.toString())),
		leafIndex: proof.pathIndices.reduce((acc, bit, i) => acc + (bit ? Math.pow(2, i) : 0), 0),
	};
}

// =============================================================================
// EVENT QUERYING
// =============================================================================

/**
 * Query Burn events from L1WarpToad to get all commitments
 */
async function getBurnEvents(
	publicClient: PublicClient,
	warpToadAddress: string,
	chainId: number,
	toBlock: bigint | 'latest' = 'latest'
): Promise<Array<{ commitment: bigint; amount: bigint; index: number }>> {
	const fromBlock = getDeploymentBlock(chainId);

	const logs = await publicClient.getLogs({
		address: warpToadAddress as `0x${string}`,
		event: {
			type: 'event',
			name: 'Burn',
			inputs: [
				{ type: 'uint256', name: 'commitment', indexed: true },
				{ type: 'uint256', name: 'amount', indexed: false },
				{ type: 'uint256', name: 'index', indexed: false },
			],
		},
		fromBlock,
		toBlock,
	});

	return logs.map((log:any) => ({
		commitment: log.args.commitment as bigint,
		amount: log.args.amount as bigint,
		index: Number(log.args.index),
	}));
}

/**
 * Query ReceivedNewLocalRoot events from GigaBridge
 * 
 * Event signature: ReceivedNewLocalRoot(uint256 indexed newLocalRoot, uint40 indexed localRootIndex, uint256 localRootBlockNumber)
 */
async function getLocalRootEvents(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	chainId: number,
	toBlock: bigint | 'latest' = 'latest'
): Promise<Array<{ localRoot: bigint; index: number; blockNumber: number; eventBlockNumber: bigint }>> {
	const fromBlock = getDeploymentBlock(chainId);

	const logs = await publicClient.getLogs({
		address: gigaBridgeAddress as `0x${string}`,
		event: {
			type: 'event',
			name: 'ReceivedNewLocalRoot',
			inputs: [
				{ type: 'uint256', name: 'newLocalRoot', indexed: true },
				{ type: 'uint40', name: 'localRootIndex', indexed: true },
				{ type: 'uint256', name: 'localRootBlockNumber', indexed: false },
			],
		},
		fromBlock,
		toBlock,
	});

	return logs.map((log:any) => ({
		localRoot: log.args.newLocalRoot as bigint,
		index: Number(log.args.localRootIndex),
		blockNumber: Number(log.args.localRootBlockNumber),
		eventBlockNumber: log.blockNumber,
	}));
}

/**
 * Query ConstructedNewGigaRoot events from GigaBridge
 * @param filterGigaRoot - If provided, only returns events for this specific gigaRoot value
 */
async function getGigaRootEvents(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	chainId: number,
	filterGigaRoot?: bigint
): Promise<Array<{ gigaRoot: bigint; blockNumber: bigint; transactionHash: `0x${string}` }>> {
	const fromBlock = getDeploymentBlock(chainId);

	const logs = await publicClient.getLogs({
		address: gigaBridgeAddress as `0x${string}`,
		event: {
			type: 'event',
			name: 'ConstructedNewGigaRoot',
			inputs: [
				{ type: 'uint256', name: 'newGigaRoot', indexed: true },
			],
		},
		// Filter by specific gigaRoot if provided (indexed parameter)
		args: filterGigaRoot ? { newGigaRoot: filterGigaRoot } : undefined,
		fromBlock,
		toBlock: 'latest',
	});

	return logs.map((log:any) => ({
		gigaRoot: log.args.newGigaRoot as bigint,
		blockNumber: log.blockNumber,
		transactionHash: log.transactionHash,
	}));
}

// =============================================================================
// MERKLE DATA GENERATION
// =============================================================================

/**
 * Get EVM merkle proof for a commitment in the L1WarpToad tree
 */
async function getEvmMerkleData(
	publicClient: PublicClient,
	warpToadAddress: string,
	commitment: bigint,
	chainId: number,
	localRootBlockNumber: number,
	expectedLocalRoot: bigint
): Promise<EvmMerkleData> {
	// Get all burn events up to the local root block
	const burnEvents = await getBurnEvents(
		publicClient,
		warpToadAddress,
		chainId,
		BigInt(localRootBlockNumber)
	);

	if (burnEvents.length === 0) {
		throw new Error('No burn events found');
	}

	// Build sorted leaves array by index
	const sortedLeaves: bigint[] = [];
	let commitmentIndex = -1;

	for (const event of burnEvents) {
		sortedLeaves[event.index] = event.commitment;
		if (event.commitment === commitment) {
			commitmentIndex = event.index;
		}
	}

	if (commitmentIndex === -1) {
		throw new Error(
			`Commitment ${commitment} not found in burn events up to block ${localRootBlockNumber}. ` +
			'Either the commitment has not been bridged yet, or an incorrect block number was used.'
		);
	}

	// Fill gaps with zeros
	for (let i = 0; i < sortedLeaves.length; i++) {
		if (sortedLeaves[i] === undefined) {
			sortedLeaves[i] = 0n;
		}
	}

	// Build merkle tree and get proof using fixed-merkle-tree
	const tree = createPoseidonMerkleTree(EVM_TREE_DEPTH, sortedLeaves);

	// Validate the recreated tree root matches the expected local root
	const computedRoot = BigInt(tree.root);
	console.log('EVM tree - computed root:', computedRoot.toString());
	console.log('EVM tree - expected local root:', expectedLocalRoot.toString());

	if (computedRoot !== expectedLocalRoot) {
		throw new Error(
			`Could not recreate the localRoot with events. ` +
			`Computed: ${computedRoot}, Expected: ${expectedLocalRoot}. ` +
			`This may indicate missing burn events or an incorrect block number.`
		);
	}

	const proof = getMerkleProof(tree, commitment);

	return {
		leaf_index: BigInt(proof.leafIndex),
		hash_path: proof.pathElements,
	};
}

/**
 * Get Giga merkle proof for a local root in the GigaBridge tree
 */
async function getGigaMerkleData(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	localRoot: bigint,
	localRootIndex: number,
	chainId: number,
	gigaRootBlockNumber: number,
	expectedGigaRoot: bigint
): Promise<EvmMerkleData> {
	// Get all local root events up to the giga root block
	const localRootEvents = await getLocalRootEvents(
		publicClient,
		gigaBridgeAddress,
		chainId,
		BigInt(gigaRootBlockNumber)
	);

	if (localRootEvents.length === 0) {
		throw new Error('No local root events found');
	}

	// Group events by index and get the latest for each
	const eventsPerIndex: Record<number, typeof localRootEvents> = {};
	const allIndexes = new Set<number>();

	for (const event of localRootEvents) {
		allIndexes.add(event.index);
		if (!eventsPerIndex[event.index]) {
			eventsPerIndex[event.index] = [];
		}
		eventsPerIndex[event.index].push(event);
	}

	// Build sorted leaves with latest root for each index
	const sortedLeaves: bigint[] = [];
	for (const index of Array.from(allIndexes).sort((a, b) => a - b)) {
		if (eventsPerIndex[index] && eventsPerIndex[index].length > 0) {
			// Get latest event for this index
			const latestEvent = eventsPerIndex[index].reduce((latest, ev) =>
				ev.eventBlockNumber > latest.eventBlockNumber ? ev : latest
			);
			sortedLeaves[index] = latestEvent.localRoot;
		} else {
			sortedLeaves[index] = 0n;
		}
	}

	// Verify local root is in tree
	if (!sortedLeaves.includes(localRoot)) {
		throw new Error(
			`Local root ${localRoot} not found in giga tree at block ${gigaRootBlockNumber}`
		);
	}

	// Build merkle tree and get proof using fixed-merkle-tree
	const tree = createPoseidonMerkleTree(GIGA_TREE_DEPTH, sortedLeaves);

	// Validate the recreated giga tree root matches the expected gigaRoot
	const computedGigaRoot = BigInt(tree.root);
	console.log('Giga tree - computed root:', computedGigaRoot.toString());
	console.log('Giga tree - expected gigaRoot:', expectedGigaRoot.toString());
	console.log('Giga tree - sorted leaves:', sortedLeaves.map(l => l.toString()));

	if (computedGigaRoot !== expectedGigaRoot) {
		throw new Error(
			`Could not recreate the gigaRoot with events. ` +
			`Computed: ${computedGigaRoot}, Expected: ${expectedGigaRoot}. ` +
			`This may indicate missing local root events or an incorrect block number.`
		);
	}

	const proof = getMerkleProof(tree, localRoot);

	return {
		leaf_index: BigInt(localRootIndex),
		hash_path: proof.pathElements,
	};
}

/**
 * Get local root data from GigaBridge events for a specific gigaRoot
 * 
 * This function finds the transaction where the specific gigaRoot was constructed,
 * then extracts the local root data from the ReceivedNewLocalRoot events in that transaction.
 * 
 * @param gigaRoot - The specific gigaRoot value to find (from the Aztec contract)
 */
async function getLocalRootData(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	warpToadL1Address: string,
	chainId: number,
	gigaRoot: bigint
): Promise<LocalRootData> {
	// Get local root index for L1WarpToad
	const localRootIndexRaw = await publicClient.readContract({
		address: gigaBridgeAddress as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'getLocalRootProvidersIndex',
		args: [warpToadL1Address as `0x${string}`], //@TODO warpToadL1Address change to be more ambigious for all potential evm chains.
	});
	const localRootIndex = Number(localRootIndexRaw);
	console.log('L1WarpToad local root index:', localRootIndex);

	// Get GigaRoot event for THIS SPECIFIC gigaRoot value
	// This ensures we find the exact transaction that created the gigaRoot stored on Aztec
	const gigaRootEvents = await getGigaRootEvents(publicClient, gigaBridgeAddress, chainId, gigaRoot);

	if (gigaRootEvents.length === 0) {
		console.error(`No ConstructedNewGigaRoot event found for gigaRoot: ${gigaRoot}`);
		throw new Error(
			`GigaRoot ${gigaRoot} not found in L1 events. ` +
			'The bridge state may be inconsistent, or the gigaRoot was constructed on a different chain.'
		);
	}

	// Get the event for this gigaRoot (should be the most recent one if there are duplicates)
	const gigaRootEvent = gigaRootEvents[gigaRootEvents.length - 1];
	const gigaRootBlockNumber = Number(gigaRootEvent.blockNumber);
	console.log(`Found ConstructedNewGigaRoot event at L1 block ${gigaRootBlockNumber}, tx: ${gigaRootEvent.transactionHash}`);

	// Get transaction receipt to find local root events in the same tx
	const receipt = await publicClient.getTransactionReceipt({
		hash: gigaRootEvent.transactionHash,
	});

	// Parse ReceivedNewLocalRoot events from the same transaction
	// Event: ReceivedNewLocalRoot(uint256 indexed newLocalRoot, uint40 indexed localRootIndex, uint256 localRootBlockNumber)
	// - topics[0]: event signature hash
	// - topics[1]: newLocalRoot (indexed, padded to 32 bytes)
	// - topics[2]: localRootIndex (indexed, uint40 padded to 32 bytes)
	// - data: localRootBlockNumber (not indexed)
	let localRoot: bigint | null = null;
	let localRootL2BlockNumber = 0;

	// Calculate event signature: keccak256("ReceivedNewLocalRoot(uint256,uint40,uint256)")
	const eventSignature = keccak256(toHex('ReceivedNewLocalRoot(uint256,uint40,uint256)'));

	for (const log of receipt.logs) {
		try {
			// Check if this is a ReceivedNewLocalRoot event by matching signature
			if (log.topics[0] === eventSignature && log.topics.length >= 3 && log.topics[1] && log.topics[2]) {
				// Indexed parameters are in topics (padded to 32 bytes)
				const decodedLocalRoot = BigInt(log.topics[1]);
				const decodedIndex = Number(BigInt(log.topics[2]));
				// Non-indexed parameter is in data
				const decodedBlockNumber = log.data ? BigInt(log.data) : 0n;

				console.log(`Found ReceivedNewLocalRoot: index=${decodedIndex}, localRoot=${decodedLocalRoot}, blockNumber=${decodedBlockNumber}`);

				if (decodedIndex === localRootIndex) {
					localRoot = decodedLocalRoot;
					localRootL2BlockNumber = Number(decodedBlockNumber);
					console.log(`Matched local root for L1WarpToad (index ${localRootIndex}): ${localRoot}`);
					break;
				}
			}
		} catch {
			continue;
		}
	}

	// If we couldn't find it in the transaction, query events directly as fallback
	if (!localRoot) {
		console.log('Local root not found in transaction logs, querying events directly...');
		const localRootEvents = await getLocalRootEvents(
			publicClient,
			gigaBridgeAddress,
			chainId,
			BigInt(gigaRootBlockNumber)
		);

		const matchingEvent = localRootEvents.find((e) => e.index === localRootIndex);
		if (matchingEvent) {
			localRoot = matchingEvent.localRoot;
			localRootL2BlockNumber = matchingEvent.blockNumber;
			console.log(`Found local root from events: ${localRoot} at block ${localRootL2BlockNumber}`);
		}
	}

	if (!localRoot) {
		console.error(`Local root for L1WarpToad (index ${localRootIndex}) not found in gigaRoot construction tx`);
		throw new Error(
			`Local root for L1WarpToad (index ${localRootIndex}) not found in giga root construction. ` +
			'The L1 local root may not have been included in this giga root.'
		);
	}

	return {
		localRoot,
		localRootIndex,
		localRootBlockNumber: localRootL2BlockNumber,
		gigaRootBlockNumber,
	};
}

// =============================================================================
// MAIN MERKLE DATA FUNCTION
// =============================================================================

/**
 * Get all merkle data needed for minting on Aztec
 * 
 * @param sourceChainId - The chain ID where the burn happened (e.g., 31337 for anvil)
 * @param commitment - The commitment hash from the burn
 * @param gigaRoot - The specific gigaRoot value from the Aztec contract (ensures consistency)
 * @returns Merkle data for the mint transaction
 */
export async function getMerkleData(
	sourceChainId: number,
	commitment: bigint,
	gigaRoot: bigint
): Promise<MerkleDataResult> {
	const addresses = getContractAddresses(sourceChainId);

	if (!addresses.L1WarpToad) {
		throw new Error(`L1WarpToad address not found for chain ${sourceChainId}`);
	}
	if (!addresses.GigaBridge) {
		throw new Error(`GigaBridge address not found for chain ${sourceChainId}`);
	}

	const publicClient = createEvmClient(sourceChainId);

	// Step 1: Get local root data from GigaBridge for THIS SPECIFIC gigaRoot
	// This ensures we build proofs against the exact gigaRoot stored on Aztec
	console.log('Getting local root data from GigaBridge for gigaRoot:', gigaRoot.toString());
	const localRootData = await getLocalRootData(
		publicClient,
		addresses.GigaBridge,
		addresses.L1WarpToad,
		sourceChainId,
		gigaRoot
	);
	console.log('Local root data:', localRootData);

	// Step 2: Get EVM merkle proof (commitment in local root)
	console.log('Building EVM merkle proof...');
	const evmMerkleData = await getEvmMerkleData(
		publicClient,
		addresses.L1WarpToad,
		commitment,
		sourceChainId,
		localRootData.localRootBlockNumber,
		localRootData.localRoot
	);
	console.log('EVM merkle proof built');

	// Step 3: Get Giga merkle proof (local root in giga root)
	console.log('Building Giga merkle proof...');
	const gigaMerkleData = await getGigaMerkleData(
		publicClient,
		addresses.GigaBridge,
		localRootData.localRoot,
		localRootData.localRootIndex,
		sourceChainId,
		localRootData.gigaRootBlockNumber,
		gigaRoot
	);
	console.log('Giga merkle proof built');

	// Step 4: Get Aztec block number for historical state read
	// Use current block number - the backend does this and it works
	// The gigaRoot should already be stored at or before this block
	const aztecNode = await getAztecNode();
	const blockNumber = await aztecNode.getBlockNumber();

	console.log(`Using Aztec block ${blockNumber} for historical read`);

	return {
		blockNumber,
		originLocalRoot: localRootData.localRoot,
		gigaMerkleData,
		evmMerkleData,
	};
}

// =============================================================================
// AZTEC BALANCE
// =============================================================================

/**
 * Get the WarpToad token balance for the connected Aztec wallet
 */
export async function getAztecWarpToadBalance(wallet: Wallet): Promise<bigint> {
	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const ownerAddress = accounts[0].item;

	// Call the unconstrained balance_of function
	const balance = await contract.methods.balance_of(ownerAddress).simulate({ from: ownerAddress });

	console.log('Aztec WarpToad Balance:', balance.toString());
	return BigInt(balance.toString());
}

/**
 * Get the WarpToad token decimals from the Aztec contract
 */
export async function getAztecWarpToadDecimals(wallet: Wallet): Promise<number> {
	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const from = accounts[0].item;

	const decimals = await contract.methods.get_decimals().simulate({ from });
	return Number(decimals);
}

// =============================================================================
// AZTEC CHAIN ID
// =============================================================================

/**
 * Get Aztec chain ID from the WarpToad contract
 * Aztec uses: poseidon2([salt, aztec_version]) where salt is "aztecPlsJustPickAChainId"
 */
export async function getAztecChainId(aztecWallet: Wallet): Promise<bigint> {
	const contract = await getWarpToadContract(aztecWallet);
	const accounts = await aztecWallet.getAccounts();
	const from = accounts[0].item;

	// Get the version from contract
	const version = await contract.methods.get_version().simulate({ from });

	// Get chain ID using the contract's unconstrained function
	const chainId = await contract.methods.get_chain_id_unconstrained(version).simulate({ from });

	return BigInt(chainId.toString());
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a commitment exists in the L1WarpToad burn events
 */
export async function validateCommitmentExists(
	commitment: bigint,
	sourceChainId: number
): Promise<boolean> {
	try {
		const addresses = getContractAddresses(sourceChainId);
		if (!addresses.L1WarpToad) {
			return false;
		}

		const publicClient = createEvmClient(sourceChainId);

		// Query for specific commitment
		const logs = await publicClient.getLogs({
			address: addresses.L1WarpToad as `0x${string}`,
			event: {
				type: 'event',
				name: 'Burn',
				inputs: [
					{ type: 'uint256', name: 'commitment', indexed: true },
					{ type: 'uint256', name: 'amount', indexed: false },
					{ type: 'uint256', name: 'index', indexed: false },
				],
			},
			args: {
				commitment,
			},
			fromBlock: 0n,
			toBlock: 'latest',
		});

		return logs.length > 0;
	} catch (error) {
		console.error('Error validating commitment:', error);
		return false;
	}
}

/**
 * Check if the GigaRoot has been synced to Aztec and return its value
 * @returns The gigaRoot value if synced (non-zero), null if not synced or error
 */
export async function getAztecGigaRoot(aztecWallet: Wallet): Promise<bigint | null> {
	try {
		const contract = await getWarpToadContract(aztecWallet);
		const accounts = await aztecWallet.getAccounts();
		const from = accounts[0].item;

		const gigaRoot = await contract.methods.get_giga_root().simulate({ from });

		// Convert Fr/Field object to bigint for proper comparison
		// Fr objects have a toBigInt() method or can be converted via toString()
		const gigaRootValue = typeof gigaRoot === 'bigint'
			? gigaRoot
			: BigInt(gigaRoot.toString());

		console.log('GigaRoot from Aztec contract:', gigaRootValue.toString());

		// Return null if gigaRoot is 0 (not synced)
		if (gigaRootValue === 0n) {
			return null;
		}

		return gigaRootValue;
	} catch (error) {
		console.error('Error getting giga root from Aztec:', error);
		return null;
	}
}

/**
 * Check if the GigaRoot has been synced to Aztec (convenience wrapper)
 */
export async function validateGigaRootSynced(aztecWallet: Wallet): Promise<boolean> {
	const gigaRoot = await getAztecGigaRoot(aztecWallet);
	return gigaRoot !== null;
}

/**
 * Result of nullifier check
 */
export interface NullifierCheckResult {
	/** Whether the nullifier has been spent */
	isSpent: boolean;
	/** Whether the check was successful (could connect to node) */
	success: boolean;
	/** Error message if check failed */
	error?: string;
}

/**
 * Check if a nullifier has been spent on Aztec
 * 
 * This queries the Aztec node's nullifier tree to check if a nullifier exists.
 * If the nullifier exists in the tree, it means the note has already been withdrawn.
 * 
 * IMPORTANT: Aztec siloes nullifiers before storing them in the tree.
 * The siloed nullifier = poseidon2([contract_address, inner_nullifier], GENERATOR_INDEX.OUTER_NULLIFIER)
 * 
 * @param siloedNullifier - The siloed nullifier (already processed with contract address)
 * @returns NullifierCheckResult with isSpent status and success/error info
 */
export async function isNullifierSpent(siloedNullifier: Fr): Promise<NullifierCheckResult> {
	try {
		const aztecNode = await getAztecNode();

		// Query the nullifier tree to check if this nullifier exists
		// Using findLeavesIndexes with NULLIFIER_TREE is the correct way to check existence
		// If the nullifier is found (index !== undefined), it has been spent
		const [nullifierIndex] = await aztecNode.findLeavesIndexes(
			'latest',
			MerkleTreeId.NULLIFIER_TREE,
			[siloedNullifier]
		);

		const isSpent = nullifierIndex !== undefined;
		console.log(`Siloed nullifier ${siloedNullifier.toString().slice(0, 20)}... spent: ${isSpent}`);

		return { isSpent, success: true };
	} catch (error) {
		console.error('Error checking nullifier status:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Check if it's a connection error
		if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
			return {
				isSpent: false,
				success: false,
				error: 'Could not connect to Aztec node. Make sure the sandbox is running.'
			};
		}

		return {
			isSpent: false,
			success: false,
			error: `Failed to check nullifier: ${errorMessage}`
		};
	}
}

/**
 * Check if a note has already been used/withdrawn on Aztec
 * 
 * This function:
 * 1. Computes the inner nullifier from the preimage: poseidon1([nullifier_preimage])
 * 2. Siloes it with the WarpToad contract address: poseidon2([contract, nullifier], OUTER_NULLIFIER)
 * 3. Looks up the siloed nullifier in the Aztec nullifier tree
 * 
 * @param nullifierPreimage - The nullifier preimage from the note data
 * @returns NullifierCheckResult with isSpent status and success/error info
 */
export async function isNoteUsed(nullifierPreimage: bigint): Promise<NullifierCheckResult> {
	try {
		// Step 1: Compute inner nullifier (same as Noir circuit)
		const innerNullifier = hashNullifier(nullifierPreimage);
		const innerNullifierFr = Fr.fromString(innerNullifier.toString());

		// Step 2: Get the WarpToad contract address
		const warpToadAddressStr = AZTEC_CONTRACTS.AztecWarpToad.address;
		if (!warpToadAddressStr) {
			return {
				isSpent: false,
				success: false,
				error: 'WarpToad contract address not configured'
			};
		}
		const warpToadAddress = AztecAddress.fromString(warpToadAddressStr);

		// Step 3: Silo the nullifier with the contract address
		// This matches what Aztec does internally when context.push_nullifier() is called
		const siloedNullifier = await siloNullifier(warpToadAddress, innerNullifierFr);

		console.log(`Inner nullifier: ${innerNullifier.toString().slice(0, 20)}...`);
		console.log(`WarpToad address: ${warpToadAddress.toString()}`);
		console.log(`Siloed nullifier: ${siloedNullifier.toString().slice(0, 20)}...`);

		// Step 4: Check if siloed nullifier exists in the tree
		return isNullifierSpent(siloedNullifier);
	} catch (error) {
		console.error('Error in isNoteUsed:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return {
			isSpent: false,
			success: false,
			error: `Failed to check note status: ${errorMessage}`
		};
	}
}

// =============================================================================
// MINT FROM EVM (MAIN WITHDRAW FUNCTION)
// =============================================================================


/**
 * Little sanity check for merkle root compute
 */
function computeMerkleRootFromPath(
	leaf: bigint,
	leafIndex: bigint,
	hashPath: bigint[],
): bigint {
	let acc = leaf;
	let index = leafIndex;

	for (const sibling of hashPath) {
		if ((index & 1n) === 0n) {
			// leaf is on the left

			acc = poseidon2([acc, sibling]); // same hash + ordering as Noir
		} else {
			// leaf is on the right
			acc = poseidon2([sibling, acc]);
		}
		index >>= 1n;
	}

	return acc;
}



/**
 * Mint tokens on Aztec from an L1 burn commitment
 * 
 * This is the main withdraw function that:
 * 1. Gets the current gigaRoot from Aztec to ensure proof consistency
 * 2. Builds merkle proofs for the commitment against that specific gigaRoot
 * 3. Calls mint_giga_root_evm on the Aztec WarpToad contract
 * 
 * @param wallet - Connected Aztec wallet (from Azguard)
 * @param commitmentData - The commitment pre-image (secret, nullifier_preimg, amount, chain_id)
 * @param sourceChainId - The L1 chain ID where the burn happened
 * @param recipientAddress - Aztec address to receive the tokens
 * @param gigaRoot - The gigaRoot value from Aztec contract (from getAztecGigaRoot)
 * @returns Transaction hash
 */
export async function mintFromEVM(
	wallet: Wallet,
	commitmentData: CommitmentPreImage,
	sourceChainId: number,
	recipientAddress: string,
	gigaRoot: bigint
): Promise<string> {
	console.log('Starting mintFromEVM...');
	console.log('Commitment data:', {
		amount: commitmentData.amount.toString(),
		destination_chain_id: commitmentData.destination_chain_id.toString(),
	});
	console.log('Using gigaRoot from Aztec:', gigaRoot.toString());

	// Get the WarpToad contract
	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const from = accounts[0].item;

	// Step 1: Calculate commitment hash
	const preCommitment = hashPreCommitment(
		commitmentData.nullifier_preimg,
		commitmentData.secret,
		commitmentData.destination_chain_id
	);
	const commitment = hashCommitment(preCommitment, commitmentData.amount);
	console.log('Calculated commitment:', commitment.toString());

	// Step 2: Get merkle data using the specific gigaRoot from Aztec
	// This ensures the proofs are built against the exact gigaRoot stored on Aztec
	console.log('Getting merkle data...');
	const merkleData = await getMerkleData(sourceChainId, commitment, gigaRoot);
	console.log('Merkle data retrieved:', merkleData);

	const evmRootFromPath = computeMerkleRootFromPath(
		commitment,
		BigInt(merkleData.evmMerkleData.leaf_index),
		merkleData.evmMerkleData.hash_path.map(BigInt),
	);

	console.log('[mintFromEVM] EVM path recomputed root matches? :', evmRootFromPath.toString() === merkleData.originLocalRoot.toString());

	const gigaRootFromPath = computeMerkleRootFromPath(
		merkleData.originLocalRoot,
		BigInt(merkleData.gigaMerkleData.leaf_index),
		merkleData.gigaMerkleData.hash_path.map(BigInt),
	);

	console.log('[mintFromEVM] Giga path recomputed root matches? :', gigaRootFromPath.toString() === gigaRoot.toString());

	console.log('[mintFromEVM] Raw merkleData:', {
		blockNumber: merkleData.blockNumber,
		originLocalRoot: merkleData.originLocalRoot.toString(),
		gigaMerkleData: {
			leaf_index: merkleData.gigaMerkleData.leaf_index.toString(),
			hash_path: merkleData.gigaMerkleData.hash_path.map(x => x.toString()),
		},
		evmMerkleData: {
			leaf_index: merkleData.evmMerkleData.leaf_index.toString(),
			hash_path: merkleData.evmMerkleData.hash_path.map(x => x.toString()),
		},
	});

	// Step 3: Prepare recipient address
	const recipient = AztecAddress.fromString(recipientAddress);

	// Step 4: Format merkle data for Aztec contract
	// The Aztec contract expects Evm_merkle_data<D> which has { leaf_index: Field, hash_path: [Field; D] }
	const gigaMerkleDataFormatted = {
		leaf_index: merkleData.gigaMerkleData.leaf_index,
		hash_path: merkleData.gigaMerkleData.hash_path,
	};

	const evmMerkleDataFormatted = {
		leaf_index: merkleData.evmMerkleData.leaf_index,
		hash_path: merkleData.evmMerkleData.hash_path,
	};

	console.log('Calling mint_giga_root_evm...');
	console.log('Parameters:', {
		amount: commitmentData.amount.toString(),
		secret: commitmentData.secret.toString().slice(0, 10) + '...',
		nullifier_preimage: commitmentData.nullifier_preimg.toString().slice(0, 10) + '...',
		recipient: recipient.toString(),
		block_number: merkleData.blockNumber,
		origin_local_root: merkleData.originLocalRoot.toString(),
	});

	console.log('[mintFromEVM] Expected relationships:', {
		// Noir checks: commit -> originLocalRoot
		commitment: commitment.toString(),
		originLocalRoot: merkleData.originLocalRoot.toString(),

		// Noir checks: originLocalRoot -> gigaRoot
		gigaRoot: gigaRoot.toString(),

		// Historical read in Noir:
		aztecBlockNumber: merkleData.blockNumber,
	});


	console.log("\n")

	// Step 5: Call mint_giga_root_evm
	// Function signature from Noir:
	// fn mint_giga_root_evm(
	//     amount: u64,
	//     secret: Field,
	//     nullifier_preimage: Field,
	//     recipient: AztecAddress,
	//     block_number: u32,
	//     origin_local_root: Field,
	//     giga_merkle_data: Evm_merkle_data<GIGA_TREE_DEPTH>,
	//     evm_merkle_data: Evm_merkle_data<EVM_TREE_DEPTH>,
	// )
	const tx = await contract.methods.mint_giga_root_evm(
		commitmentData.amount,           // amount: u64
		commitmentData.secret,           // secret: Field
		commitmentData.nullifier_preimg, // nullifier_preimage: Field
		recipient,                       // recipient: AztecAddress
		merkleData.blockNumber,          // block_number: u32
		merkleData.originLocalRoot,      // origin_local_root: Field
		gigaMerkleDataFormatted,         // giga_merkle_data
		evmMerkleDataFormatted,          // evm_merkle_data
	).send({ from }).wait();

	console.log('Mint transaction completed:', tx.txHash.toString());
	return tx.txHash.toString();
}

// =============================================================================
// BALANCE CHECKING
// =============================================================================

/**
 * Get token balance on Aztec WarpToad
 */
export async function getAztecBalance(
	wallet: Wallet,
	ownerAddress?: string
): Promise<bigint> {
	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const from = accounts[0].item;

	const owner = ownerAddress
		? AztecAddress.fromString(ownerAddress)
		: from;

	// Note: balance_of is an unconstrained function, uses 'from' for simulation context
	const balance = await contract.methods.balance_of(owner).simulate({ from });
	return BigInt(balance.toString());
}

// =============================================================================
// AZTEC -> L1 BRIDGING (BURN ON AZTEC)
// =============================================================================

// Field size for BN254 curve (used by Aztec)
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Generate cryptographically secure random field element
 */
function generateRandomField(): bigint {
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);

	let value = 0n;
	for (let i = 0; i < randomBytes.length; i++) {
		value = (value << 8n) | BigInt(randomBytes[i]);
	}

	return value % FIELD_MODULUS;
}

/**
 * Burn tokens on Aztec to initiate a withdrawal to L1
 * 
 * This function:
 * 1. Generates random secret and nullifier preimage
 * 2. Computes the commitment hash
 * 3. Calls the Aztec WarpToadCore.burn() function
 * 4. Returns the commitment data needed for L1 withdrawal
 * 
 * @param wallet - Connected Aztec wallet
 * @param amount - Amount to burn (in token's smallest units)
 * @param destinationChainId - The L1 chain ID where tokens will be claimed
 * @returns Burn result with commitment data
 */
export async function burnOnAztec(
	wallet: Wallet,
	amount: bigint,
	destinationChainId: bigint
): Promise<AztecBurnResult> {
	console.log('Starting burnOnAztec...');
	console.log('Amount:', amount.toString());
	console.log('Destination chain ID:', destinationChainId.toString());

	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const from = accounts[0].item;

	// Step 1: Generate random secret and nullifier preimage
	const secret = generateRandomField();
	const nullifierPreimage = generateRandomField();
	console.log('Generated secret and nullifier preimage');

	// Step 2: Compute pre-commitment hash
	// preCommitment = poseidon3([nullifier_preimage, secret, destination_chain_id])
	const preCommitment = hashPreCommitment(nullifierPreimage, secret, destinationChainId);
	console.log('Pre-commitment:', preCommitment.toString().slice(0, 20) + '...');

	// Step 3: Compute full commitment hash
	// commitment = poseidon2([pre_commitment, amount])
	const commitment = hashCommitment(preCommitment, amount);
	console.log('Commitment:', commitment.toString().slice(0, 20) + '...');

	// Step 4: Call Aztec burn function
	// fn burn(amount: u64, destination_chain_id: Field, secret: Field, nullifier_preimage: Field)
	console.log('Calling WarpToadCore.burn()...');
	const tx = await contract.methods.burn(
		amount,                    // amount: u64
		destinationChainId,        // destination_chain_id: Field
		secret,                    // secret: Field
		nullifierPreimage          // nullifier_preimage: Field
	).send({ from }).wait();

	console.log('Burn transaction completed:', tx.txHash.toString());

	// Get the block number when the burn was included
	const aztecNode = await getAztecNode();
	const blockNumber = await aztecNode.getBlockNumber();
	console.log('Burn included at Aztec block:', blockNumber);

	return {
		secret,
		nullifierPreimage,
		preCommitment,
		commitment,
		burnTxHash: tx.txHash.toString(),
		blockNumber,
	};
}

/**
 * Encode note for Aztec -> L1 bridge
 * Includes Aztec-specific metadata (blockNumber) for merkle proof generation
 */
export function encodeAztecNote(
	burnResult: AztecBurnResult,
	sourceChainId: bigint,
	destinationChainId: bigint,
	amount: bigint
): string {
	const noteData = {
		version: '1.0',
		protocol: 'warptoad',
		sourceChainId: sourceChainId.toString(),
		destinationChainId: destinationChainId.toString(),
		amount: amount.toString(),
		secret: burnResult.secret.toString(),
		nullifier_preimg: burnResult.nullifierPreimage.toString(),
		preCommitment: burnResult.preCommitment.toString(),
		commitment: burnResult.commitment.toString(),
		// Aztec-specific fields
		aztecBlockNumber: burnResult.blockNumber,
		burnTxHash: burnResult.burnTxHash,
	};

	const jsonStr = JSON.stringify(noteData);
	const base64 = btoa(jsonStr);

	return `warptoad-note-${base64}`;
}

// =============================================================================
// AZTEC MERKLE PROOF GENERATION (FOR AZTEC -> L1)
// =============================================================================

/**
 * Poseidon2 hash with separator (for Aztec note hashing)
 * Uses @zkpassport/poseidon2 which is compatible with Aztec's poseidon2
 */
async function poseidon2HashWithSeparator(inputs: bigint[], separator: bigint): Promise<bigint> {
	// Import dynamically since it's an async module
	//@ts-ignore
	const { poseidon2Hash } = await import('@zkpassport/poseidon2');
	const inputsWithSeparator = [separator, ...inputs];
	return poseidon2Hash(inputsWithSeparator);
}

/**
 * Compute note hash nonce (for Aztec note siloing)
 */
async function hashNoteHashNonce(firstNullifierInTx: bigint, noteIndexInTx: bigint): Promise<bigint> {
	return poseidon2HashWithSeparator([firstNullifierInTx, noteIndexInTx], GENERATOR_INDEX__NOTE_HASH_NONCE);
}

/**
 * Compute siloed note hash (contract address + plain note hash)
 */
async function hashSiloedNoteHash(contractAddress: bigint, plainNoteHash: bigint): Promise<bigint> {
	return poseidon2HashWithSeparator([contractAddress, plainNoteHash], GENERATOR_INDEX__SILOED_NOTE_HASH);
}

/**
 * Compute unique note hash (nonce + siloed note hash)
 */
async function hashUniqueNoteHash(nonce: bigint, siloedNoteHash: bigint): Promise<bigint> {
	return poseidon2HashWithSeparator([nonce, siloedNoteHash], GENERATOR_INDEX__UNIQUE_NOTE_HASH);
}

/**
 * Get Aztec merkle data for a commitment
 * 
 * This is needed for Aztec -> L1 withdrawals. The function:
 * 1. Queries the contract to find the note with matching commitment
 * 2. Gets the note's nonce from metadata
 * 3. Computes the siloed and unique note hash (as Aztec does)
 * 4. Gets the merkle proof from the note hash tree
 * 
 * @param wallet - Connected Aztec wallet
 * @param commitment - The commitment hash (plain note hash before siloing)
 * @param blockNumber - Aztec block number when the commitment was created
 * @returns Merkle data for the withdraw circuit
 */
export async function getAztecMerkleData(
	wallet: Wallet,
	commitment: bigint,
	blockNumber: number
): Promise<AztecMerkleData> {
	console.log('Getting Aztec merkle data for commitment:', commitment.toString().slice(0, 20) + '...');
	console.log('Block number:', blockNumber);

	const contract = await getWarpToadContract(wallet);
	const accounts = await wallet.getAccounts();
	const from = accounts[0].item;

	// Step 1: Get notes from the contract to find the note nonce
	// The contract has a utility function that returns notes from the commitments storage
	console.log('Fetching notes from contract...');
	const contractNotes = await contract.methods
		.get_notes_util(contract.artifact.storageLayout.commitments.slot)
		.simulate({ from });

	console.log('Retrieved', contractNotes.storage.length, 'notes');

	// Step 2: Find the note with matching commitment
	// Notes contain: nullifier_preimage, secret, chain_id, amount
	// We need to hash these to find the matching commitment
	let noteNonce: bigint | null = null;

	for (const note of contractNotes.storage) {
		const noteCommitment = hashCommitment(
			hashPreCommitment(
				BigInt(note.note.nullifier_preimage.toString()),
				BigInt(note.note.secret.toString()),
				BigInt(note.note.chain_id.toString())
			),
			BigInt(note.note.amount.toString())
		);

		if (noteCommitment === commitment) {
			// Found matching note - get its nonce from metadata
			noteNonce = BigInt(note.metadata.maybe_note_nonce.toString());
			console.log('Found matching note with nonce:', noteNonce.toString().slice(0, 20) + '...');
			break;
		}
	}

	if (noteNonce === null) {
		throw new Error(
			`Could not find note with commitment ${commitment.toString().slice(0, 20)}... ` +
			'The note may not be synced to this wallet yet, or the commitment data is incorrect.'
		);
	}

	// Step 3: Compute the siloed and unique note hash
	const warpToadAddressStr = AZTEC_CONTRACTS.AztecWarpToad.address;
	const contractAddressBigInt = BigInt(AztecAddress.fromString(warpToadAddressStr).toBigInt());

	const siloedNoteHash = await hashSiloedNoteHash(contractAddressBigInt, commitment);
	console.log('Siloed note hash:', siloedNoteHash.toString().slice(0, 20) + '...');

	const uniqueNoteHash = await hashUniqueNoteHash(noteNonce, siloedNoteHash);
	console.log('Unique note hash:', uniqueNoteHash.toString().slice(0, 20) + '...');

	// Step 4: Get merkle proof from the contract
	// The contract has a utility function: get_note_proof(block_number, note_hash) -> MembershipWitness
	console.log('Fetching merkle proof from contract...');
	const witness = await contract.methods
		.get_note_proof(blockNumber, uniqueNoteHash)
		.simulate({ from });

	console.log('Retrieved merkle witness with index:', witness.index.toString());

	// Step 5: Format the merkle data for the circuit
	const merkleData: AztecMerkleData = {
		leaf_index: BigInt(witness.index.toString()),
		hash_path: witness.path.map((h: bigint) => BigInt(h.toString())),
		leaf_nonce: noteNonce,
		contract_address: contractAddressBigInt,
	};

	console.log('Aztec merkle data generated successfully');
	return merkleData;
}

/**
 * Get empty Aztec merkle data (used when bridging FROM EVM, not from Aztec)
 */
export function getEmptyAztecMerkleData(): AztecMerkleData {
	return {
		leaf_index: 0n,
		hash_path: new Array(AZTEC_TREE_DEPTH).fill(0n),
		leaf_nonce: 0n,
		contract_address: 0n,
	};
}

/**
 * Get empty EVM merkle data (used when bridging FROM Aztec, not from EVM)
 */
export function getEmptyEvmMerkleData(): EvmMerkleData {
	return {
		leaf_index: 0n,
		hash_path: new Array(EVM_TREE_DEPTH).fill(0n),
	};
}

/**
 * Get empty Giga merkle data (used when withdrawing on same chain as deposit)
 */
export function getEmptyGigaMerkleData(): EvmMerkleData {
	return {
		leaf_index: 0n,
		hash_path: new Array(GIGA_TREE_DEPTH).fill(0n),
	};
}

// =============================================================================
// AZTEC -> L1 MERKLE DATA
// =============================================================================

/**
 * Result of getting merkle data for Aztec -> L1 withdrawal
 */
export interface AztecToL1MerkleDataResult {
	/** The Aztec note hash tree root that was included in the gigaRoot */
	aztecLocalRoot: bigint;
	/** The Aztec block number this root came from */
	aztecLocalRootBlockNumber: number;
	/** L1AztecBridgeAdapter's index in the GigaBridge tree */
	aztecLocalRootIndex: number;
	/** Merkle proof that aztecLocalRoot is in gigaRoot */
	gigaMerkleData: EvmMerkleData;
	/** The L1 block where the gigaRoot was constructed */
	gigaRootBlockNumber: number;
}

/**
 * Get Aztec's local root data from GigaBridge events for a specific gigaRoot
 * 
 * This is similar to getLocalRootData but specifically for the L1AztecBridgeAdapter.
 * It finds the transaction where the specific gigaRoot was constructed,
 * then extracts the Aztec local root from the ReceivedNewLocalRoot events.
 * 
 * @param publicClient - Viem public client for L1
 * @param gigaBridgeAddress - GigaBridge contract address
 * @param aztecBridgeAdapterAddress - L1AztecBridgeAdapter contract address
 * @param gigaRoot - The specific gigaRoot value to find
 */
async function getAztecLocalRootData(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	aztecBridgeAdapterAddress: string,
	chainId: number,
	gigaRoot: bigint
): Promise<{
	aztecLocalRoot: bigint;
	aztecLocalRootBlockNumber: number;
	aztecLocalRootIndex: number;
	gigaRootBlockNumber: number;
}> {
	// Get local root index for L1AztecBridgeAdapter
	const localRootIndexRaw = await publicClient.readContract({
		address: gigaBridgeAddress as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'getLocalRootProvidersIndex',
		args: [aztecBridgeAdapterAddress as `0x${string}`],
	});
	const aztecLocalRootIndex = Number(localRootIndexRaw);
	console.log('L1AztecBridgeAdapter local root index:', aztecLocalRootIndex);

	// Get GigaRoot event for THIS SPECIFIC gigaRoot value
	const gigaRootEvents = await getGigaRootEvents(publicClient, gigaBridgeAddress, chainId, gigaRoot);

	if (gigaRootEvents.length === 0) {
		console.error(`No ConstructedNewGigaRoot event found for gigaRoot: ${gigaRoot}`);
		throw new Error(
			`GigaRoot ${gigaRoot} not found in L1 events. ` +
			'The bridge state may be inconsistent, or the gigaRoot was constructed on a different chain.'
		);
	}

	// Get the most recent event for this gigaRoot
	const gigaRootEvent = gigaRootEvents[gigaRootEvents.length - 1];
	const gigaRootBlockNumber = Number(gigaRootEvent.blockNumber);
	console.log(`Found ConstructedNewGigaRoot event at L1 block ${gigaRootBlockNumber}, tx: ${gigaRootEvent.transactionHash}`);

	// Get transaction receipt to find local root events in the same tx
	const receipt = await publicClient.getTransactionReceipt({
		hash: gigaRootEvent.transactionHash,
	});

	// Parse ReceivedNewLocalRoot events from the same transaction
	let aztecLocalRoot: bigint | null = null;
	let aztecLocalRootBlockNumber = 0;

	// Calculate event signature: keccak256("ReceivedNewLocalRoot(uint256,uint40,uint256)")
	const eventSignature = keccak256(toHex('ReceivedNewLocalRoot(uint256,uint40,uint256)'));

	for (const log of receipt.logs) {
		try {
			if (log.topics[0] === eventSignature && log.topics.length >= 3 && log.topics[1] && log.topics[2]) {
				const decodedLocalRoot = BigInt(log.topics[1]);
				const decodedIndex = Number(BigInt(log.topics[2]));
				const decodedBlockNumber = log.data ? BigInt(log.data) : 0n;

				console.log(`Found ReceivedNewLocalRoot: index=${decodedIndex}, localRoot=${decodedLocalRoot.toString().slice(0, 20)}..., blockNumber=${decodedBlockNumber}`);

				if (decodedIndex === aztecLocalRootIndex) {
					aztecLocalRoot = decodedLocalRoot;
					aztecLocalRootBlockNumber = Number(decodedBlockNumber);
					console.log(`Matched Aztec local root (index ${aztecLocalRootIndex}): ${aztecLocalRoot.toString().slice(0, 20)}...`);
					break;
				}
			}
		} catch {
			continue;
		}
	}

	// Fallback: query events directly if not found in transaction logs
	if (!aztecLocalRoot) {
		console.log('Aztec local root not found in transaction logs, querying events directly...');
		const localRootEvents = await getLocalRootEvents(
			publicClient,
			gigaBridgeAddress,
			chainId,
			BigInt(gigaRootBlockNumber)
		);

		const matchingEvent = localRootEvents.find((e) => e.index === aztecLocalRootIndex);
		if (matchingEvent) {
			aztecLocalRoot = matchingEvent.localRoot;
			aztecLocalRootBlockNumber = matchingEvent.blockNumber;
			console.log(`Found Aztec local root from events: ${aztecLocalRoot.toString().slice(0, 20)}... at block ${aztecLocalRootBlockNumber}`);
		}
	}

	if (!aztecLocalRoot) {
		throw new Error(
			`Aztec local root (index ${aztecLocalRootIndex}) not found in giga root construction. ` +
			'The Aztec state may not have been bridged to L1 for this gigaRoot, or L1AztecBridgeAdapter is not registered.'
		);
	}

	return {
		aztecLocalRoot,
		aztecLocalRootBlockNumber,
		aztecLocalRootIndex,
		gigaRootBlockNumber,
	};
}

/**
 * Build Giga merkle proof for Aztec -> L1 withdrawal
 * 
 * This function builds a merkle proof that the Aztec local root is included
 * in the GigaBridge tree that produced the given gigaRoot.
 * 
 * Based on backend/scripts/lib/proving.ts getGigaMerkleData()
 * 
 * @param publicClient - Viem public client for L1
 * @param gigaBridgeAddress - GigaBridge contract address
 * @param aztecLocalRoot - The Aztec note hash tree root to prove
 * @param aztecLocalRootIndex - L1AztecBridgeAdapter's index in GigaBridge
 * @param gigaRootBlockNumber - L1 block where gigaRoot was constructed
 * @param expectedGigaRoot - The expected gigaRoot (for validation)
 */
async function buildGigaMerkleProofForAztec(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	aztecLocalRoot: bigint,
	aztecLocalRootIndex: number,
	chainId: number,
	gigaRootBlockNumber: number,
	expectedGigaRoot: bigint
): Promise<EvmMerkleData> {
	// Get the number of local root providers from GigaBridge
	const amountOfLocalRoots = await publicClient.readContract({
		address: gigaBridgeAddress as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'amountOfLocalRoots',
	});
	console.log('Amount of local roots in GigaBridge:', amountOfLocalRoots);

	// Get all local root events up to the giga root block
	const localRootEvents = await getLocalRootEvents(
		publicClient,
		gigaBridgeAddress,
		chainId,
		BigInt(gigaRootBlockNumber)
	);

	if (localRootEvents.length === 0) {
		throw new Error('No local root events found in GigaBridge');
	}

	// Group events by index and get the latest for each
	const eventsPerIndex: Record<number, typeof localRootEvents> = {};
	const allIndexes = new Set<number>();

	for (const event of localRootEvents) {
		allIndexes.add(event.index);
		if (!eventsPerIndex[event.index]) {
			eventsPerIndex[event.index] = [];
		}
		eventsPerIndex[event.index].push(event);
	}

	// Build sorted leaves with latest root for each index
	// This matches the backend logic in getGigaMerkleData
	const sortedLeaves: bigint[] = [];
	for (let i = 0; i < Number(amountOfLocalRoots); i++) {
		if (eventsPerIndex[i] && eventsPerIndex[i].length > 0) {
			// Get latest event for this index (by event block number)
			const latestEvent = eventsPerIndex[i].reduce((latest, ev) =>
				ev.eventBlockNumber > latest.eventBlockNumber ? ev : latest
			);
			sortedLeaves[i] = latestEvent.localRoot;
		} else {
			// No events for this index - use 0 (default value in tree)
			sortedLeaves[i] = 0n;
		}
	}

	console.log('Giga tree sorted leaves:', sortedLeaves.map((l, i) => `[${i}]: ${l.toString().slice(0, 15)}...`));

	// Verify Aztec local root is in tree at the expected index
	if (sortedLeaves[aztecLocalRootIndex] !== aztecLocalRoot) {
		console.error('Mismatch:', {
			expected: aztecLocalRoot.toString(),
			actual: sortedLeaves[aztecLocalRootIndex]?.toString() || 'undefined',
			index: aztecLocalRootIndex
		});
		throw new Error(
			`Aztec local root at index ${aztecLocalRootIndex} does not match expected value. ` +
			`Expected: ${aztecLocalRoot.toString().slice(0, 20)}..., ` +
			`Got: ${sortedLeaves[aztecLocalRootIndex]?.toString().slice(0, 20) || 'undefined'}...`
		);
	}

	// Build merkle tree and get proof using fixed-merkle-tree
	const tree = createPoseidonMerkleTree(GIGA_TREE_DEPTH, sortedLeaves);

	// Validate the recreated giga tree root matches the expected gigaRoot
	const computedGigaRoot = BigInt(tree.root);
	console.log('Giga tree - computed root:', computedGigaRoot.toString());
	console.log('Giga tree - expected gigaRoot:', expectedGigaRoot.toString());

	if (computedGigaRoot !== expectedGigaRoot) {
		throw new Error(
			`Could not recreate the gigaRoot with events. ` +
			`Computed: ${computedGigaRoot}, Expected: ${expectedGigaRoot}. ` +
			`This may indicate missing local root events or timing issues.`
		);
	}

	const proof = getMerkleProof(tree, aztecLocalRoot);

	return {
		leaf_index: BigInt(aztecLocalRootIndex),
		hash_path: proof.pathElements,
	};
}

/**
 * Get all merkle data needed for Aztec -> L1 withdrawal
 * 
 * This function retrieves:
 * 1. The Aztec local root (note hash tree root) that was bridged to L1
 * 2. The Aztec block number this root came from (needed for getAztecMerkleData)
 * 3. The Giga merkle proof (proof that Aztec local root is in gigaRoot)
 * 
 * Usage:
 * ```typescript
 * const { aztecLocalRoot, aztecLocalRootBlockNumber, gigaMerkleData } = 
 *   await getMerkleDataForAztecToL1(chainId, gigaRoot);
 * 
 * // Then get Aztec merkle data using the correct block number
 * const aztecMerkleData = await getAztecMerkleData(wallet, commitment, aztecLocalRootBlockNumber);
 * ```
 * 
 * @param destinationChainId - The L1 chain ID (e.g., 31337 for localhost, 1 for mainnet)
 * @param gigaRoot - The gigaRoot from L1 WarpToad contract
 * @returns Aztec local root data and Giga merkle proof
 */
export async function getMerkleDataForAztecToL1(
	destinationChainId: number,
	gigaRoot: bigint
): Promise<AztecToL1MerkleDataResult> {
	console.log('Getting merkle data for Aztec -> L1 withdrawal');
	console.log('Destination chain ID:', destinationChainId);
	console.log('GigaRoot:', gigaRoot.toString().slice(0, 20) + '...');

	// Get contract addresses
	const addresses = getContractAddresses(destinationChainId);
	if (!addresses.GigaBridge) {
		throw new Error(`GigaBridge address not found for chain ${destinationChainId}`);
	}
	if (!addresses.L1AztecBridgeAdapter) {
		throw new Error(`L1AztecBridgeAdapter address not found for chain ${destinationChainId}`);
	}

	console.log('GigaBridge:', addresses.GigaBridge);
	console.log('L1AztecBridgeAdapter:', addresses.L1AztecBridgeAdapter);

	// Create public client for L1
	const publicClient = createEvmClient(destinationChainId);

	// Step 1: Get Aztec's local root data from the gigaRoot construction event
	const {
		aztecLocalRoot,
		aztecLocalRootBlockNumber,
		aztecLocalRootIndex,
		gigaRootBlockNumber,
	} = await getAztecLocalRootData(
		publicClient,
		addresses.GigaBridge,
		addresses.L1AztecBridgeAdapter,
		destinationChainId,
		gigaRoot
	);

	console.log('Aztec local root:', aztecLocalRoot.toString().slice(0, 20) + '...');
	console.log('Aztec local root block number:', aztecLocalRootBlockNumber);
	console.log('Aztec local root index in GigaBridge:', aztecLocalRootIndex);

	// Step 2: Build Giga merkle proof
	const gigaMerkleData = await buildGigaMerkleProofForAztec(
		publicClient,
		addresses.GigaBridge,
		aztecLocalRoot,
		aztecLocalRootIndex,
		destinationChainId,
		gigaRootBlockNumber,
		gigaRoot
	);

	console.log('Giga merkle proof generated successfully');
	console.log('Leaf index:', gigaMerkleData.leaf_index.toString());
	console.log('Hash path length:', gigaMerkleData.hash_path.length);

	return {
		aztecLocalRoot,
		aztecLocalRootBlockNumber,
		aztecLocalRootIndex,
		gigaMerkleData,
		gigaRootBlockNumber,
	};
}
