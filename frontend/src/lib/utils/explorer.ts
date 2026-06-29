/**
 * Block explorer links.
 *
 * EVM explorers come for free from viem's chain definitions
 * (`blockExplorers.default`): Etherscan for Sepolia, Scrollscan for Scroll.
 * The local anvil chain has none, so those calls return null.
 *
 * Aztec uses Aztecscan. The base URL is overridable via
 * `VITE_AZTEC_EXPLORER_URL`; the default targets the testnet instance. There is
 * no public explorer for the local sandbox, so Aztec links return null there.
 */
import type { Chain } from '$lib/types/bridge.js';
import { getEVMChain, getAztecChain } from '$lib/config/chains.js';

export interface ExplorerTxLink {
	url: string;
	/** Display name of the explorer, e.g. "Etherscan", "Scrollscan", "Aztecscan". */
	name: string;
}

// Strip trailing slashes so we can safely append a path.
const AZTEC_EXPLORER_BASE = (
	(import.meta.env.VITE_AZTEC_EXPLORER_URL as string | undefined) ||
	'https://testnet.aztecscan.xyz'
).replace(/\/+$/, '');

function withHexPrefix(txHash: string): string {
	return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
}

/** Explorer link for an EVM tx on `chain`. Null for chains without an explorer (anvil/local). */
export function getEvmExplorerTxLink(chain: Chain, txHash: string): ExplorerTxLink | null {
	const explorer = getEVMChain(chain)?.viemChain.blockExplorers?.default;
	if (!explorer?.url) return null;
	return {
		url: `${explorer.url.replace(/\/+$/, '')}/tx/${withHexPrefix(txHash)}`,
		name: explorer.name,
	};
}

/** Explorer link for an Aztec tx. Null in sandbox/local mode (no public explorer). */
export function getAztecExplorerTxLink(txHash: string): ExplorerTxLink | null {
	if (getAztecChain('Aztec')?.network === 'sandbox') return null;
	return {
		// Aztecscan indexes transactions under /tx-effects/<hash>.
		url: `${AZTEC_EXPLORER_BASE}/tx-effects/${withHexPrefix(txHash)}`,
		name: 'Aztecscan',
	};
}

/** Explorer link for a tx on any supported chain. Null when the hash is missing or the chain has no explorer. */
export function getExplorerTxLink(chain: Chain, txHash: string | null | undefined): ExplorerTxLink | null {
	if (!txHash) return null;
	return chain === 'Aztec' ? getAztecExplorerTxLink(txHash) : getEvmExplorerTxLink(chain, txHash);
}
