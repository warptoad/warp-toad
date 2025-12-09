export type Chain = 'Ethereum' | 'Scroll' | 'Aztec';
export type Token = 'USDC' | 'DAI' | 'WBTC';
export type ChainType = 'EVM' | 'Aztec';

export interface Wallets {
	evm: string | null;
	aztec: string | null;
}

// Chain type mapping (for wallet connection logic)
export const CHAIN_TYPES: Record<Chain, ChainType> = {
	Ethereum: 'EVM',
	Scroll: 'EVM',
	Aztec: 'Aztec'
};

// Token icon colors (placeholder circles)
export const TOKEN_COLORS: Record<Token, string> = {
	USDC: 'bg-green-500',
	DAI: 'bg-yellow-500',
	WBTC: 'bg-orange-500'
};

// Chain icon colors (placeholder circles)
export const CHAIN_COLORS: Record<Chain, string> = {
	Ethereum: 'bg-purple-500',
	Scroll: 'bg-amber-500',
	Aztec: 'bg-indigo-500'
};

// Token names for display
export const TOKEN_NAMES: Record<Token, string> = {
	USDC: 'USD Coin',
	DAI: 'Dai Stablecoin',
	WBTC: 'Wrapped Bitcoin'
};

export interface MockTokenBalance {
	token: Token;
	ethereum: string;
	scroll: string;
	aztec: string;
}

export interface TokenContract {
	token: Token;
	ethereumAddress?: string;
	scrollAddress?: string;
	aztecAddress?: string;
}


export interface CommitmentPreImage {
	amount: bigint;
	destination_chain_id: bigint;
	secret: bigint;
	nullifier_preimg: bigint;
}

export interface Proof {
	id: string;
	amount: string;
	token: Token;
	sourceChain: Chain;
	targetChain: Chain;
	note: string;
	used: boolean;
	timestamp: number;
	// Commitment data for bridging
	commitmentData?: CommitmentPreImage;
	preCommitment?: string;
	commitment?: string;
	burnTxHash?: string;
}

export interface ProofGenerationStatus {
	active: boolean;
	step: 'idle' | 'preparing' | 'generating' | 'complete';
	message: string;
}
