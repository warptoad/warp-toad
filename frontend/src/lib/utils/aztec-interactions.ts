/**
 * Aztec interactions for L1 -> Aztec withdraw flow
 * 
 * This module handles the withdrawal of tokens from L1 (EVM) to Aztec L2.
 * The flow is:
 * 1. User burns tokens on L1 with a commitment
 * 2. Relayer bridges the local root to GigaBridge, which creates a gigaRoot
 * 3. GigaRoot is sent to Aztec WarpToad contract
 * 4. User can withdraw on Aztec by proving their commitment is in the tree
 */

import type { CommitmentPreImage } from '$lib/types/bridge';
import { createPublicClient, http, walletActions, type PublicClient } from 'viem';
import { getContractAddresses } from '$lib/contracts/addresses';
import { GigaBridgeAbi } from '$lib/contracts/abis';
import { poseidon2, poseidon3 } from 'poseidon-lite';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { AztecNode } from '@aztec/aztec.js/node';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../../../backend/contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from '@aztec/aztec.js/contracts';
import { AztecWarpToad } from '../../../../backend/scripts/deploy/aztec/aztecDeployments/31337/deployed_addresses.json'
import { Fr } from '@aztec/aztec.js/fields';


// =============================================================================
// CONSTANTS
// =============================================================================

const EVM_TREE_DEPTH = 32;
const GIGA_TREE_DEPTH = 5;

// Environment configuration
const getAztecNodeUrl = () => import.meta.env.VITE_AZTEC_NODE_URL || 'http://localhost:8080';

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
			constructorArgs: AztecWarpToad.constructorArgs,
			deployer: AztecAddress.fromString(AztecWarpToad.deployer),
			salt: Fr.fromHexString(AztecWarpToad.contractAddressSalt),
		}
	);

	const registeredContract = await wallet.registerContract(
		{
			artifact: WarpToadCoreContractArtifact,
			instance: contract
		}
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

// =============================================================================
// EVM CLIENT HELPERS
// =============================================================================

/**
 * Create a public client for the given chain
 */
function createEvmClient(chainId: number, rpcUrl?: string): PublicClient {
	const defaultRpcUrl = chainId === 31337
		? 'http://localhost:8545'
		: chainId === 11155111
			? 'https://sepolia.infura.io/v3/YOUR_KEY'
			: 'http://localhost:8545';

	return createPublicClient({
		chain: {
			id: chainId,
			name: chainId === 31337 ? 'Localhost' : `Chain ${chainId}`,
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
// MERKLE TREE IMPLEMENTATION
// =============================================================================

/**
 * Simple Merkle Tree using poseidon2 hash
 * Used to reconstruct trees from events and generate proofs
 */
class PoseidonMerkleTree {
	private depth: number;
	private leaves: bigint[];
	private tree: bigint[][];

	constructor(depth: number, leaves: bigint[]) {
		this.depth = depth;
		this.leaves = [...leaves];
		this.tree = this.buildTree();
	}

	private buildTree(): bigint[][] {
		const tree: bigint[][] = [];

		// Level 0: leaves padded to full tree size
		const fullSize = 2 ** this.depth;
		tree[0] = [...this.leaves];
		while (tree[0].length < fullSize) {
			tree[0].push(0n);
		}

		// Build parent levels
		for (let level = 0; level < this.depth; level++) {
			const currentLevel = tree[level];
			const nextLevel: bigint[] = [];

			for (let i = 0; i < currentLevel.length; i += 2) {
				const left = currentLevel[i] || 0n;
				const right = currentLevel[i + 1] || 0n;
				nextLevel.push(poseidon2([left, right]));
			}

			tree[level + 1] = nextLevel;
		}

		return tree;
	}

	getRoot(): bigint {
		return this.tree[this.depth][0];
	}

	getProof(leafValue: bigint): { pathElements: bigint[]; leafIndex: number } {
		// Find leaf index
		let leafIndex = -1;
		for (let i = 0; i < this.leaves.length; i++) {
			if (this.leaves[i] === leafValue) {
				leafIndex = i;
				break;
			}
		}

		if (leafIndex === -1) {
			throw new Error(`Leaf ${leafValue} not found in tree`);
		}

		const pathElements: bigint[] = [];
		let currentIndex = leafIndex;

		for (let level = 0; level < this.depth; level++) {
			const isLeft = currentIndex % 2 === 0;
			const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

			const sibling = this.tree[level][siblingIndex] || 0n;
			pathElements.push(sibling);

			currentIndex = Math.floor(currentIndex / 2);
		}

		return { pathElements, leafIndex };
	}
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
	toBlock: bigint | 'latest' = 'latest'
): Promise<Array<{ commitment: bigint; amount: bigint; index: number }>> {
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
		fromBlock: 0n,
		toBlock,
	});

	return logs.map((log) => ({
		commitment: log.args.commitment as bigint,
		amount: log.args.amount as bigint,
		index: Number(log.args.index),
	}));
}

/**
 * Query ReceivedNewLocalRoot events from GigaBridge
 */
async function getLocalRootEvents(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	toBlock: bigint | 'latest' = 'latest'
): Promise<Array<{ localRoot: bigint; index: number; blockNumber: number; eventBlockNumber: bigint }>> {
	const logs = await publicClient.getLogs({
		address: gigaBridgeAddress as `0x${string}`,
		event: {
			type: 'event',
			name: 'ReceivedNewLocalRoot',
			inputs: [
				{ type: 'uint256', name: 'localRoot', indexed: false },
				{ type: 'uint256', name: 'index', indexed: false },
				{ type: 'uint256', name: 'blockNumber', indexed: false },
			],
		},
		fromBlock: 0n,
		toBlock,
	});

	return logs.map((log) => ({
		localRoot: log.args.localRoot as bigint,
		index: Number(log.args.index),
		blockNumber: Number(log.args.blockNumber),
		eventBlockNumber: log.blockNumber,
	}));
}

/**
 * Query ConstructedNewGigaRoot events from GigaBridge
 */
async function getGigaRootEvents(
	publicClient: PublicClient,
	gigaBridgeAddress: string
): Promise<Array<{ gigaRoot: bigint; blockNumber: bigint; transactionHash: `0x${string}` }>> {
	const logs = await publicClient.getLogs({
		address: gigaBridgeAddress as `0x${string}`,
		event: {
			type: 'event',
			name: 'ConstructedNewGigaRoot',
			inputs: [
				{ type: 'uint256', name: 'gigaRoot', indexed: true },
			],
		},
		fromBlock: 0n,
		toBlock: 'latest',
	});

	return logs.map((log) => ({
		gigaRoot: log.args.gigaRoot as bigint,
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
	localRootBlockNumber: number
): Promise<EvmMerkleData> {
	// Get all burn events up to the local root block
	const burnEvents = await getBurnEvents(
		publicClient,
		warpToadAddress,
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

	// Build merkle tree and get proof
	const tree = new PoseidonMerkleTree(EVM_TREE_DEPTH, sortedLeaves);
	const proof = tree.getProof(commitment);

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
	gigaRootBlockNumber: number
): Promise<EvmMerkleData> {
	// Get all local root events up to the giga root block
	const localRootEvents = await getLocalRootEvents(
		publicClient,
		gigaBridgeAddress,
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

	// Build merkle tree and get proof
	const tree = new PoseidonMerkleTree(GIGA_TREE_DEPTH, sortedLeaves);
	const proof = tree.getProof(localRoot);

	return {
		leaf_index: BigInt(localRootIndex),
		hash_path: proof.pathElements,
	};
}

/**
 * Get local root data from GigaBridge events
 */
async function getLocalRootData(
	publicClient: PublicClient,
	gigaBridgeAddress: string,
	warpToadL1Address: string
): Promise<LocalRootData> {
	// Get local root index for L1WarpToad
	const localRootIndexRaw = await publicClient.readContract({
		address: gigaBridgeAddress as `0x${string}`,
		abi: GigaBridgeAbi,
		functionName: 'getLocalRootProvidersIndex',
		args: [warpToadL1Address as `0x${string}`],
	});
	const localRootIndex = Number(localRootIndexRaw);

	// Get latest GigaRoot event
	const gigaRootEvents = await getGigaRootEvents(publicClient, gigaBridgeAddress);

	if (gigaRootEvents.length === 0) {
		throw new Error(
			'No giga root events found. The bridge may not have been synced yet. ' +
			'Please ensure the bridging process has completed.'
		);
	}

	// Get most recent giga root event
	const latestGigaRootEvent = gigaRootEvents[gigaRootEvents.length - 1];
	const gigaRootBlockNumber = Number(latestGigaRootEvent.blockNumber);

	// Get transaction receipt to find local root events in the same tx
	const receipt = await publicClient.getTransactionReceipt({
		hash: latestGigaRootEvent.transactionHash,
	});

	// Parse ReceivedNewLocalRoot events from the same transaction
	let localRoot: bigint | null = null;
	let localRootL2BlockNumber = 0;

	for (const log of receipt.logs) {
		try {
			// Check if this is a ReceivedNewLocalRoot event
			if (log.topics[0] === '0x' + 'ReceivedNewLocalRoot event signature') {
				// Manual decoding since we can't use parseLog easily
				continue;
			}

			// Try to match by checking if log has the right structure
			// ReceivedNewLocalRoot(uint256 localRoot, uint256 index, uint256 blockNumber)
			if (log.data && log.data.length >= 194) { // 0x + 3 * 64 hex chars
				const data = log.data.slice(2); // Remove 0x
				const decodedLocalRoot = BigInt('0x' + data.slice(0, 64));
				const decodedIndex = BigInt('0x' + data.slice(64, 128));
				const decodedBlockNumber = BigInt('0x' + data.slice(128, 192));

				if (Number(decodedIndex) === localRootIndex) {
					localRoot = decodedLocalRoot;
					localRootL2BlockNumber = Number(decodedBlockNumber);
					break;
				}
			}
		} catch {
			continue;
		}
	}

	// If we couldn't find it in the transaction, query events directly
	if (!localRoot) {
		const localRootEvents = await getLocalRootEvents(
			publicClient,
			gigaBridgeAddress,
			BigInt(gigaRootBlockNumber)
		);

		const matchingEvent = localRootEvents.find((e) => e.index === localRootIndex);
		if (matchingEvent) {
			localRoot = matchingEvent.localRoot;
			localRootL2BlockNumber = matchingEvent.blockNumber;
		}
	}

	if (!localRoot) {
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
 * @param aztecWallet - Connected Aztec wallet
 * @returns Merkle data for the mint transaction
 */
export async function getMerkleData(
	sourceChainId: number,
	commitment: bigint,
	_aztecWallet: Wallet // Currently unused, but kept for future Aztec-specific merkle data
): Promise<MerkleDataResult> {
	const addresses = getContractAddresses(sourceChainId);

	if (!addresses.L1WarpToad) {
		throw new Error(`L1WarpToad address not found for chain ${sourceChainId}`);
	}
	if (!addresses.GigaBridge) {
		throw new Error(`GigaBridge address not found for chain ${sourceChainId}`);
	}

	const publicClient = createEvmClient(sourceChainId);

	// Step 1: Get local root data from GigaBridge
	console.log('Getting local root data from GigaBridge...');
	const localRootData = await getLocalRootData(
		publicClient,
		addresses.GigaBridge,
		addresses.L1WarpToad
	);
	console.log('Local root data:', localRootData);

	// Step 2: Get EVM merkle proof (commitment in local root)
	console.log('Building EVM merkle proof...');
	const evmMerkleData = await getEvmMerkleData(
		publicClient,
		addresses.L1WarpToad,
		commitment,
		localRootData.localRootBlockNumber
	);
	console.log('EVM merkle proof built');

	// Step 3: Get Giga merkle proof (local root in giga root)
	console.log('Building Giga merkle proof...');
	const gigaMerkleData = await getGigaMerkleData(
		publicClient,
		addresses.GigaBridge,
		localRootData.localRoot,
		localRootData.localRootIndex,
		localRootData.gigaRootBlockNumber
	);
	console.log('Giga merkle proof built');

	// Step 4: Get current Aztec block number for historical state read
	const aztecNode = await getAztecNode();
	const blockNumber = await aztecNode.getBlockNumber();

	return {
		blockNumber,
		originLocalRoot: localRootData.localRoot,
		gigaMerkleData,
		evmMerkleData,
	};
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
 * Check if the GigaRoot has been synced to Aztec
 */
export async function validateGigaRootSynced(aztecWallet: Wallet): Promise<boolean> {
	try {
		const contract = await getWarpToadContract(aztecWallet);
		const accounts = await aztecWallet.getAccounts();
		const from = accounts[0].item;

		console.log(accounts)

		const gigaRoot = await contract.methods.get_giga_root().simulate({ from });
		return gigaRoot !== 0n;
	} catch (error) {
		console.error('Error checking giga root:', error);
		return false;
	}
}

// =============================================================================
// MINT FROM EVM (MAIN WITHDRAW FUNCTION)
// =============================================================================

/**
 * Mint tokens on Aztec from an L1 burn commitment
 * 
 * This is the main withdraw function that:
 * 1. Validates the commitment exists on L1
 * 2. Builds merkle proofs for the commitment
 * 3. Calls mint_giga_root_evm on the Aztec WarpToad contract
 * 
 * @param wallet - Connected Aztec wallet (from Azguard)
 * @param commitmentData - The commitment pre-image (secret, nullifier_preimg, amount, chain_id)
 * @param sourceChainId - The L1 chain ID where the burn happened
 * @param recipientAddress - Aztec address to receive the tokens
 * @returns Transaction hash
 */
export async function mintFromEVM(
	wallet: Wallet,
	commitmentData: CommitmentPreImage,
	sourceChainId: number,
	recipientAddress: string
): Promise<string> {
	console.log('Starting mintFromEVM...');
	console.log('Commitment data:', {
		amount: commitmentData.amount.toString(),
		destination_chain_id: commitmentData.destination_chain_id.toString(),
	});

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

	// Step 2: Get merkle data
	console.log('Getting merkle data...');
	const merkleData = await getMerkleData(sourceChainId, commitment, wallet);
	console.log('Merkle data retrieved:', {
		blockNumber: merkleData.blockNumber,
		originLocalRoot: merkleData.originLocalRoot.toString(),
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
