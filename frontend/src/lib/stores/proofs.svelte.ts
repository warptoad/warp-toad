import { abi } from '$lib/contracts/abis/TestTokenAbi';
import type { Proof, Token, Chain, MockTokenBalance, TokenContract } from '$lib/types/bridge.js';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

const STORAGE_KEY = 'warptoad:proofs';


// Mock token balances
const MOCK_BALANCES: MockTokenBalance[] = [
	{ token: 'ETH', ethereum: '5.234', scroll: '2.500', aztec: '0.000' },
	{ token: 'USDC', ethereum: '1000.00', scroll: '500.00', aztec: '0.00' },
	{ token: 'DAI', ethereum: '500.00', scroll: '250.00', aztec: '0.00' },
	{ token: 'WBTC', ethereum: '0.152', scroll: '0.075', aztec: '0.000' }
];

export const TOKEN_CONTRACTS: TokenContract[] = [
	{ token: 'ETH', ethereumAddress: '0x95401dc811bb5740090279Ba06cfA8fcF6113778' }
]

// Load from localStorage
function loadProofs(): Proof[] {
	if (typeof window === 'undefined') return [];

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch {
			return [];
		}
	}
	return [];
}

// Save to localStorage
function saveProofs(proofs: Proof[]) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
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

	async getBalance(token: Token, chain: Chain): Promise<string> {
		const balance = TOKEN_CONTRACTS.find(b => b.token === token);
		if (!balance) return '0.00';

		// Map chain to address property
		const chainKey = chain.toLowerCase() + "Address" as 'ethereumAddress' | 'scrollAddress' | 'aztecAddress';
		// viem 

		const publicClient = createPublicClient({
			chain: anvil,
			transport: http()
		})
		const data = await publicClient.readContract({
			address: balance[chainKey] as `0x${string}`,
			abi: abi,
			functionName: 'balanceOf',
			args: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
		})

		console.log(data)

		return String(balance) || '0.00';
	}

	addProof(
		amount: string,
		token: Token,
		sourceChain: Chain,
		targetChain: Chain
	): Proof {
		const proof: Proof = {
			id: generateProofId(),
			amount,
			token,
			sourceChain,
			targetChain,
			note: generateNote(),
			used: false,
			timestamp: Date.now()
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
		const noteMatch = content.match(/note-0x[0-9a-f]{64}/);
		if (noteMatch) {
			return { note: noteMatch[0] };
		}
		return null;
	}
}

export const proofStore = new ProofStore();
