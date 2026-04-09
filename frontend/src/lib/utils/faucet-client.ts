/**
 * Faucet Service API Client
 *
 * Client for the testnet ETH faucet (Sepolia + Scroll Sepolia).
 */

const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
const FAUCET_SERVICE_URL =
	import.meta.env.VITE_FAUCET_SERVICE_URL ||
	(isTestMode ? 'http://localhost:8888' : 'https://faucet.warptoad.xyz');

export interface FaucetChainStatus {
	claimed: boolean;
	txHash?: string;
	timestamp?: number;
}

export interface FaucetInfo {
	ok: true;
	address: string;
	dripAmountWei: string;
	chains: Record<string, FaucetChainStatus>;
}

export interface FaucetClaimResponse {
	ok: true;
	txHash: string;
	chainId: number;
	address: string;
	amountWei: string;
}

/** Returns null if the faucet service is unreachable. */
export async function getFaucetInfo(address: string): Promise<FaucetInfo | null> {
	try {
		const res = await fetch(`${FAUCET_SERVICE_URL}/faucet/info?address=${address}`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data.ok ? (data as FaucetInfo) : null;
	} catch (err) {
		console.warn('[faucet] /info failed:', err);
		return null;
	}
}

/**
 * Claim a drip on `chainId`. Returns the tx hash on success, throws on error.
 */
export async function claimFaucet(
	address: string,
	chainId: number,
): Promise<FaucetClaimResponse> {
	const res = await fetch(`${FAUCET_SERVICE_URL}/faucet/claim`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chainId, address }),
	});
	const data = await res.json();
	if (!res.ok || !data.ok) {
		throw new Error(data.error || `Faucet claim failed: ${res.statusText}`);
	}
	return data as FaucetClaimResponse;
}

/** Quick reachability probe; used to hide the faucet UI when the service is down. */
export async function isFaucetServiceAvailable(): Promise<boolean> {
	try {
		const res = await fetch(`${FAUCET_SERVICE_URL}/health`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000),
		});
		return res.ok;
	} catch {
		return false;
	}
}
