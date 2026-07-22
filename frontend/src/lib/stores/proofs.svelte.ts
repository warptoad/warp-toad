import { USDcoinAbi } from '$lib/contracts/abis';
import { ALL_CHAINS, type Proof, type Token, type Chain, type MockTokenBalance, type TokenContract, type CommitmentPreImage, type ProofBridgeSync } from '$lib/types/bridge.js';
import { createPublicClient, http } from 'viem';
import { walletStore } from './wallets.svelte';
import { decodeNote } from '$lib/utils/evm-interactions';
import { getWalletInstance } from '$lib/utils/aztec-wallet';
import { getAztecWarpToadBalance, getAztecWarpToadDecimals } from '$lib/utils/aztec-interactions';
import { getEVMChain } from '$lib/config/chains';

const STORAGE_KEY = 'warptoad:proofs';


// Mock token balances
const MOCK_BALANCES: MockTokenBalance[] = [
	{ token: 'USDC', balances: { Ethereum: '1000.00', ZKsync: '500.00', Aztec: '0.00' } },
	{ token: 'DAI', balances: { Ethereum: '500.00', ZKsync: '250.00', Aztec: '0.00' } },
	{ token: 'WBTC', balances: { Ethereum: '0.152', ZKsync: '0.075', Aztec: '0.000' } }
];
// Per-environment USDC addresses, sourced from the chain registry (which itself
// reads from the static deployment files in `frontend/src/lib/contracts/addresses.ts`).
// In dev mode this resolves to the local anvil USDcoin; in testnet mode it resolves
// to Sepolia USDcoin. Either way, callers don't need to think about the active mode.
//
// Caveats from the original design comments:
// - the L1 address is native USDC (the wrappable underlying token)
// - an L2 address is the wrptd-USDC (the WarpToad-issued wrapped token), NOT a real
//   USDC deployment, because on an L2 the app only ever touches the wrapper
// - L1 -> wrap -> bridge -> unwrap on L1 only
//
// Built by iterating the registry so a new L2 is picked up without editing this.
const usdcAddresses: Partial<Record<Chain, string>> = {};
for (const chain of ALL_CHAINS) {
	const def = getEVMChain(chain);
	if (!def) continue;
	const address = def.role === 'L1' ? def.contracts.nativeToken : def.contracts.warpToad;
	if (address) usdcAddresses[chain] = address;
}

export const TOKEN_CONTRACTS: TokenContract[] = [
	{ token: 'USDC', addresses: usdcAddresses },
]

// Custom JSON serialization for BigInt
function bigIntReplacer(key: string, value: any): any {
	if (typeof value === 'bigint') {
		return { __type: 'bigint', value: value.toString() };
	}
	return value;
}

// Custom JSON deserialization for BigInt
function bigIntReviver(key: string, value: any): any {
	if (value && typeof value === 'object' && value.__type === 'bigint') {
		return BigInt(value.value);
	}
	return value;
}

// Load from localStorage
function loadProofs(): Proof[] {
	if (typeof window === 'undefined') return [];

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return JSON.parse(stored, bigIntReviver);
		} catch {
			return [];
		}
	}
	return [];
}

// Save to localStorage
function saveProofs(proofs: Proof[]) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs, bigIntReplacer));
}

// Generate mock note (tornado-style secret)
function generateNote(): string {
	const chars = '0123456789abcdef';
	let note = 'note-0x';
	for (let i = 0; i < 64; i++) {
		note += chars[Math.floor(Math.random() * chars.length)];
	}
	return note;
}

// Generate proof ID
function generateProofId(): string {
	const chars = '0123456789abcdef';
	let id = '';
	for (let i = 0; i < 16; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

class ProofStore {
	private _proofs = $state<Proof[]>(loadProofs());

	get proofs(): Proof[] {
		return this._proofs;
	}

	get unusedProofs(): Proof[] {
		return this._proofs.filter(p => !p.used);
	}

	get allProofs(): Proof[] {
		return [...this._proofs].sort((a, b) => b.timestamp - a.timestamp);
	}

	async getBalance(tokenInput: Token, chain: Chain): Promise<string> {
		// Handle Aztec chain separately
		if (chain === 'Aztec') {
			return this.getAztecBalance();
		}
		
		// EVM chains
		const token = TOKEN_CONTRACTS.find(b => b.token === tokenInput);
		if (!token) return '0.00';

		const tokenAddress = token.addresses[chain];
		
		// Guard against missing address
		if (!tokenAddress) {
			console.log(`No token address configured for ${tokenInput} on ${chain}`);
			return '0.00';
		}
		
		// Check if EVM wallet is connected
		if (!walletStore.wallets.evm) {
			return 'Connect wallet';
		}

		// Resolve the active chain config (Sepolia/Scroll in prod, Anvil in test mode).
		// Defaulting to viem's `anvil` chain with `http()` silently pins RPC to
		// localhost:8545 in production builds, so always go through the registry.
		const chainName = chain === 'ZKsync' ? 'ZKsync' : 'Ethereum';
		const chainDef = getEVMChain(chainName);
		if (!chainDef) {
			console.warn(`[getBalance] Chain ${chainName} not configured`);
			return '0.00';
		}

		const publicClient = createPublicClient({
			chain: chainDef.viemChain,
			transport: http(chainDef.rpcUrl),
		});

		const decimals = await publicClient.readContract({
			address: tokenAddress as `0x${string}`,
			abi: USDcoinAbi,
			functionName: 'decimals'
		})

		const data = await publicClient.readContract({
			address: tokenAddress as `0x${string}`,
			abi: USDcoinAbi,
			functionName: 'balanceOf',
			args: [walletStore.wallets.evm as `0x${string}`]
		})

		const balance = Number(data) / 10 ** decimals

		return String(balance) || '0.00';
	}
	
	private async getAztecBalance(): Promise<string> {
		const wallet = getWalletInstance();
		if (!wallet) {
			return 'Connect wallet';
		}
		
		try {
			const [balance, decimals] = await Promise.all([
				getAztecWarpToadBalance(wallet),
				getAztecWarpToadDecimals(wallet)
			]);
			
			const formatted = Number(balance) / 10 ** decimals;
			return formatted.toString();
		} catch (error) {
			console.error('Failed to get Aztec balance:', error);
			return '0.00';
		}
	}

	addProof(
		amount: string,
		token: Token,
		sourceChain: Chain,
		targetChain: Chain,
		note?: string,
		commitmentData?: CommitmentPreImage,
		preCommitment?: string,
		commitment?: string,
		burnTxHash?: string,
		bridgeSync?: ProofBridgeSync | null
	): Proof {
		const proof: Proof = {
			id: generateProofId(),
			amount,
			token,
			sourceChain,
			targetChain,
			note: note || generateNote(),
			used: false,
			timestamp: Date.now(),
			commitmentData,
			preCommitment,
			commitment,
			burnTxHash,
			bridgeSync: bridgeSync ?? null
		};

		this._proofs.push(proof);
		saveProofs(this._proofs);
		return proof;
	}

	markProofAsUsed(proofId: string, mintTxHash?: string) {
		const proof = this._proofs.find(p => p.id === proofId);
		if (proof) {
			proof.used = true;
			if (mintTxHash) proof.mintTxHash = mintTxHash;
			saveProofs(this._proofs);
		}
	}

	findProofByNote(note: string): Proof | undefined {
		return this._proofs.find(p => p.note === note);
	}

	/** Look up a proof by its commitment hash (decimal string). Used by the
	 * WithdrawForm catch path to attach a fresh operationId to the proof
	 * record on BridgeSyncStaleError, so a returning user sees progress. */
	findProofByCommitment(commitment: string): Proof | undefined {
		return this._proofs.find(p => p.commitment === commitment);
	}

	/** Attach a fresh bridge-sync record to a proof. Replaces any existing
	 * record (e.g. when a stale-root catch fires another trigger). */
	attachBridgeSync(proofId: string, sync: ProofBridgeSync) {
		const proof = this._proofs.find(p => p.id === proofId);
		if (!proof) return;
		proof.bridgeSync = sync;
		saveProofs(this._proofs);
	}

	/** Merge a partial status update into an existing bridge-sync record.
	 * No-op if the proof has no bridgeSync field set (i.e. nothing to update).
	 * Uses Object.assign so the bridgeSync reference stays stable; this matters
	 * for the WithdrawForm's $effect, which would otherwise re-run (and
	 * restart the poll loop) on every status update. */
	updateBridgeSyncStatus(proofId: string, partial: Partial<ProofBridgeSync>) {
		const proof = this._proofs.find(p => p.id === proofId);
		if (!proof || !proof.bridgeSync) return;
		Object.assign(proof.bridgeSync, partial);
		saveProofs(this._proofs);
	}

	/** Drop the bridge-sync record (e.g. on successful withdraw, or after
	 * a 404 from /status/:opId indicating the keeper expired the op). */
	clearBridgeSync(proofId: string) {
		const proof = this._proofs.find(p => p.id === proofId);
		if (!proof) return;
		proof.bridgeSync = null;
		saveProofs(this._proofs);
	}

	deleteProof(proofId: string) {
		this._proofs = this._proofs.filter(p => p.id !== proofId);
		saveProofs(this._proofs);
	}

	// Download proof as .txt file
	downloadProof(proof: Proof) {
		const content = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WARPTOAD BRIDGE PROOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proof ID: ${proof.id}
Amount: ${proof.amount} ${proof.token}
From: ${proof.sourceChain}
To: ${proof.targetChain}
Date: ${new Date(proof.timestamp).toLocaleString()}

SECRET NOTE (Keep this safe!):
${proof.note}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Save this note to withdraw your funds.
Do not share this note with anyone!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `warptoad_note_${proof.id}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Parse uploaded proof file
	parseProofFile(content: string): { note: string } | null {
		// Try to match new warptoad note format
		const warptoadNoteMatch = content.match(/warptoad-note-[A-Za-z0-9+/=]+/);
		if (warptoadNoteMatch) {
			return { note: warptoadNoteMatch[0] };
		}
		
		// Fall back to legacy note format
		const noteMatch = content.match(/note-0x[0-9a-f]{64}/);
		if (noteMatch) {
			return { note: noteMatch[0] };
		}
		
		return null;
	}
}

export const proofStore = new ProofStore();
