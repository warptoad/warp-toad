// SVG imports for icons
import usdcSvg from '../../assets/tokens/usdc.svg';
import daiSvg from '../../assets/tokens/dai.svg';
import wbtcSvg from '../../assets/tokens/wbtc.svg';
import ethereumSvg from '../../assets/chains/ethereum.svg';
import zksyncSvg from '../../assets/chains/zksync.svg';
import aztecSvg from '../../assets/chains/aztec.svg';

export type Token = 'USDC' | 'DAI' | 'WBTC';
export type ChainType = 'EVM' | 'Aztec';

export interface ChainDisplay {
	/** Human-readable label. Chain ids are also shown directly in places, so keep
	 *  the id itself presentable. */
	label: string;
	type: ChainType;
	/** Placeholder circle colour. */
	color: string;
	style: { bg: string; glow: string; textDark?: boolean; logo: string };
}

/**
 * THE list of chains the UI knows about.
 *
 * Everything below is derived from it, so adding a chain is one entry here plus a
 * definition in `config/chains.ts`. It used to be a closed union keyed into five
 * separate `Record<Chain, ...>` maps that all had to be edited in lockstep, and
 * missing one failed at runtime rather than at compile time.
 *
 * Chain ids are persisted inside saved notes (`Proof.sourceChain` / `targetChain`) and
 * in localStorage, so renaming one orphans existing notes. Add, don't rename.
 *
 * The ZK Stack entries must stay in step with `backend/lib/zkStackChains.ts`, which is
 * the deploy-side source of truth.
 */
export const CHAIN_DISPLAY = {
	Ethereum: {
		label: 'Ethereum',
		type: 'EVM',
		color: 'bg-purple-500',
		style: { bg: 'linear-gradient(135deg, #627EEA, #3c4a9e)', glow: 'rgba(98,126,234,0.4)', logo: ethereumSvg },
	},
	ZKsync: {
		label: 'ZKsync Era',
		type: 'EVM',
		color: 'bg-blue-500',
		style: { bg: 'linear-gradient(135deg, #1E69FF, #1547b8)', glow: 'rgba(30,105,255,0.4)', logo: zksyncSvg },
	},
	Aztec: {
		label: 'Aztec',
		type: 'Aztec',
		color: 'bg-indigo-500',
		style: { bg: 'linear-gradient(135deg, #9061F9, #6b3fd4)', glow: 'rgba(144,97,249,0.4)', logo: aztecSvg },
	},
} as const satisfies Record<string, ChainDisplay>;

export type Chain = keyof typeof CHAIN_DISPLAY;

export const ALL_CHAINS = Object.keys(CHAIN_DISPLAY) as Chain[];

const displayEntries = Object.entries(CHAIN_DISPLAY) as [Chain, ChainDisplay][];

export interface Wallets {
	evm: string | null;
	aztec: string | null;
}

/** Chain label for display. Falls back to the id for unknown values coming out of
 *  persisted notes, so an orphaned note renders instead of crashing. */
export function chainLabel(chain: Chain | string): string {
	return (CHAIN_DISPLAY as Record<string, ChainDisplay>)[chain]?.label ?? String(chain);
}

// Chain type mapping (for wallet connection logic)
export const CHAIN_TYPES: Record<Chain, ChainType> = Object.fromEntries(
	displayEntries.map(([id, d]) => [id, d.type]),
) as Record<Chain, ChainType>;

// Token icon colors (placeholder circles)
export const TOKEN_COLORS: Record<Token, string> = {
	USDC: 'bg-green-500',
	DAI: 'bg-yellow-500',
	WBTC: 'bg-orange-500'
};

// Chain icon colors (placeholder circles)
export const CHAIN_COLORS: Record<Chain, string> = Object.fromEntries(
	displayEntries.map(([id, d]) => [id, d.color]),
) as Record<Chain, string>;

// Themed token styles for swamp UI
export const TOKEN_STYLES: Record<Token, { bg: string; glow: string; logo: string }> = {
	USDC: { bg: 'linear-gradient(135deg, #2775CA, #1a5490)', glow: 'rgba(39,117,202,0.4)', logo: usdcSvg },
	DAI: { bg: 'linear-gradient(135deg, #F5AC37, #d4912d)', glow: 'rgba(245,172,55,0.4)', logo: daiSvg },
	WBTC: { bg: 'linear-gradient(135deg, #F09242, #d47a2d)', glow: 'rgba(240,146,66,0.4)', logo: wbtcSvg }
};

// Themed chain styles for swamp UI
export const CHAIN_STYLES: Record<Chain, { bg: string; glow: string; textDark?: boolean; logo: string }> =
	Object.fromEntries(displayEntries.map(([id, d]) => [id, d.style])) as Record<
		Chain,
		{ bg: string; glow: string; textDark?: boolean; logo: string }
	>;

// Token names for display
export const TOKEN_NAMES: Record<Token, string> = {
	USDC: 'USD Coin',
	DAI: 'Dai Stablecoin',
	WBTC: 'Wrapped Bitcoin'
};

export interface MockTokenBalance {
	token: Token;
	/** Per-chain display balance. Keyed by Chain id, not a field per chain. */
	balances: Partial<Record<Chain, string>>;
}

/**
 * Token addresses per chain.
 *
 * `addresses` is keyed by Chain id. The previous shape was a field per chain
 * (`ethereumAddress`/`scrollAddress`/...) which callers indexed by building the key
 * with `chain.toLowerCase() + "Address"`. That silently returned `undefined` for any
 * chain whose id didn't happen to lowercase into an existing field, so a new chain
 * looked like "no balance" instead of failing.
 */
export interface TokenContract {
	token: Token;
	addresses: Partial<Record<Chain, string>>;
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

/**
 * Per-proof bridge-sync tracking. The bridge keeper takes hours to push an
 * L2 local root through L1 to Aztec; with this field we can resume the
 * UX after the user closes the tab. The withdraw page polls /status/:opId
 * and shows progress instead of surfacing BridgeSyncStaleError as a fresh
 * problem on every visit.
 *
 * - operationId: returned by POST /bridge/:from/:to. The keeper persists
 *   these now (operationsStore), so a 404 means the op truly expired (48h
 *   on the server) and the field can be cleared.
 * - fromChainId / toChainId: keeper-convention strings. EVM chains are the
 *   numeric chain id ("11155111", "300"), Aztec is the literal "aztec".
 * - lastStatus: 'noop' is a successful no-work outcome (bridge state was
 *   already fresh); treat it as completed for UX.
 */
export interface ProofBridgeSync {
	operationId: string;
	fromChainId: string;
	toChainId: string;
	startedAtMs: number;
	expectedDuration: string;
	lastStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'noop';
	lastPolledAtMs?: number;
	lastError?: string;
	txHashes?: Record<string, string>;
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
	/** Source-chain tx hash of the deposit/burn that created this note. */
	burnTxHash?: string;
	/** Dest-chain tx hash of the mint/withdraw that consumed this note. Set when
	 * the proof is marked used, so the history can deep-link to the withdraw tx. */
	mintTxHash?: string;
	/** Bridge-sync tracking (post-burn). Null/undefined when no sync was
	 * triggered yet, or when one completed and was cleared. */
	bridgeSync?: ProofBridgeSync | null;
}

export interface ProofGenerationStatus {
	active: boolean;
	step: 'idle' | 'preparing' | 'generating' | 'complete';
	message: string;
}
