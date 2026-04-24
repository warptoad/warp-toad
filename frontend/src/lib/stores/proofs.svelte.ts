import { USDcoinAbi } from '$lib/contracts/abis';
import type { Proof, Token, Chain, MockTokenBalance, TokenContract, CommitmentPreImage } from '$lib/types/bridge.js';
import { createPublicClient, http } from 'viem';
import { walletStore } from './wallets.svelte';
import { decodeNote } from '$lib/utils/evm-interactions';
import { getWalletInstance } from '$lib/utils/aztec-wallet';
import { getAztecWarpToadBalance, getAztecWarpToadDecimals } from '$lib/utils/aztec-interactions';
import { getEVMChain } from '$lib/config/chains';

const STORAGE_KEY = 'warptoad:proofs';


// Mock token balances
const MOCK_BALANCES: MockTokenBalance[] = [
	{ token: 'USDC', ethereum: '1000.00', scroll: '500.00', aztec: '0.00' },
	{ token: 'DAI', ethereum: '500.00', scroll: '250.00', aztec: '0.00' },
	{ token: 'WBTC', ethereum: '0.152', scroll: '0.075', aztec: '0.000' }
];
// Per-environment USDC addresses, sourced from the chain registry (which itself
// reads from the static deployment files in `frontend/src/lib/contracts/addresses.ts`).
// In dev mode this resolves to the local anvil USDcoin; in testnet mode it resolves
// to Sepolia USDcoin. Either way, callers don't need to think about the active mode.
//
// Caveats from the original design comments:
// - "ethereum" address is L1 native USDC (the wrappable underlying token)
// - "scroll" address is currently the L2 wrptd-USDC (the WarpToad-issued wrapped token)
// - L1 -> wrap -> bridge -> unwrap on L1 only
const ethereumChain = getEVMChain('Ethereum');
const scrollChain = getEVMChain('Scroll');
export const TOKEN_CONTRACTS: TokenContract[] = [
	{
		token: 'USDC',
		ethereumAddress: ethereumChain?.contracts.nativeToken ?? '',
		// Scroll's "USDC" in this app is actually the L2 WarpToad wrapper.
		scrollAddress: scrollChain?.contracts.warpToad ?? '',
	},
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
		
		// EVM chains (Ethereum, Scroll)
		const token = TOKEN_CONTRACTS.find(b => b.token === tokenInput);
		if (!token) return '0.00';

		// Map chain to address property
		const chainKey = chain.toLowerCase() + "Address" as 'ethereumAddress' | 'scrollAddress';
		const tokenAddress = token[chainKey];
		
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
		const chainName = chain === 'Scroll' ? 'Scroll' : 'Ethereum';
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
		burnTxHash?: string
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
			burnTxHash
		};

		this._proofs.push(proof);
		saveProofs(this._proofs);
		return proof;
	}

	markProofAsUsed(proofId: string) {
		const proof = this._proofs.find(p => p.id === proofId);
		if (proof) {
			proof.used = true;
			saveProofs(this._proofs);
		}
	}

	findProofByNote(note: string): Proof | undefined {
		return this._proofs.find(p => p.note === note);
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
