// SVG imports for icons
import usdcSvg from '../../assets/tokens/usdc.svg';
import daiSvg from '../../assets/tokens/dai.svg';
import wbtcSvg from '../../assets/tokens/wbtc.svg';
import ethereumSvg from '../../assets/chains/ethereum.svg';
import scrollSvg from '../../assets/chains/scroll.svg';
import aztecSvg from '../../assets/chains/aztec.svg';

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

// Themed token styles for swamp UI
export const TOKEN_STYLES: Record<Token, { bg: string; glow: string; logo: string }> = {
	USDC: { bg: 'linear-gradient(135deg, #2775CA, #1a5490)', glow: 'rgba(39,117,202,0.4)', logo: usdcSvg },
	DAI: { bg: 'linear-gradient(135deg, #F5AC37, #d4912d)', glow: 'rgba(245,172,55,0.4)', logo: daiSvg },
	WBTC: { bg: 'linear-gradient(135deg, #F09242, #d47a2d)', glow: 'rgba(240,146,66,0.4)', logo: wbtcSvg }
};

// Themed chain styles for swamp UI
export const CHAIN_STYLES: Record<Chain, { bg: string; glow: string; textDark?: boolean; logo: string }> = {
	Ethereum: { bg: 'linear-gradient(135deg, #627EEA, #3c4a9e)', glow: 'rgba(98,126,234,0.4)', logo: ethereumSvg },
	Scroll: { bg: 'linear-gradient(135deg, #FFEEDA, #d4a574)', glow: 'rgba(212,165,116,0.4)', textDark: true, logo: scrollSvg },
	Aztec: { bg: 'linear-gradient(135deg, #9061F9, #6b3fd4)', glow: 'rgba(144,97,249,0.4)', logo: aztecSvg }
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
	/**
	 * Aztec-source notes only: the note hash nonce captured from PXE at burn
	 * time. Lets us re-derive the unique note hash on a fresh wallet / different
	 * machine without needing PXE to have decrypted the note. Optional for
	 * backwards-compat: notes issued before this field was added fall back to
	 * the PXE lookup path in `getAztecMerkleData`.
	 */
	noteNonce?: bigint;
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
