/**
 * Per-chain RPC override store.
 *
 * Two pieces of state:
 *   - `custom[chainId]` (persisted in localStorage): user-supplied RPC URL.
 *     Empty / missing means "use the baked-in default" (= the bridge.warptoad
 *     proxy in production builds).
 *   - `useCustom[chainId]` (session only): withdraw-page toggle state.
 *     Defaults to `true` when a custom URL is configured, `false` otherwise.
 *
 * Callers go through `resolve(chainId, defaultUrl)` to pick up the effective
 * URL. The toggle on the withdraw page flips `useCustom`; the manage-wallet
 * modal edits `custom`.
 */

const STORAGE_KEY = "warptoad.customRpc";

// Chain IDs the frontend actually lets users override. Anything else falls
// straight through to the default.
const SUPPORTED_CHAIN_IDS = new Set<number>([11155111, 534351]);

function readCustom(): Record<number, string> {
	if (typeof localStorage === "undefined") return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};
		const out: Record<number, string> = {};
		for (const [k, v] of Object.entries(parsed)) {
			const id = Number(k);
			if (SUPPORTED_CHAIN_IDS.has(id) && typeof v === "string" && v.length > 0) {
				out[id] = v;
			}
		}
		return out;
	} catch {
		return {};
	}
}

function writeCustom(custom: Record<number, string>) {
	if (typeof localStorage === "undefined") return;
	const hasAny = Object.values(custom).some((v) => v && v.length > 0);
	if (!hasAny) localStorage.removeItem(STORAGE_KEY);
	else localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

function createRpcSettingsStore() {
	const initial = readCustom();
	const custom = $state<Record<number, string>>({ ...initial });
	// Session-only preference. Starts true for chains that already have a
	// configured override, false otherwise - matches the UX spec: if you set
	// a custom RPC, the toggle defaults to "use mine".
	const useCustom = $state<Record<number, boolean>>(
		Object.fromEntries(Array.from(SUPPORTED_CHAIN_IDS).map((id) => [id, !!initial[id]])),
	);

	function getCustom(chainId: number): string | undefined {
		return custom[chainId];
	}

	function hasCustom(chainId: number): boolean {
		return !!custom[chainId];
	}

	function isUsingCustom(chainId: number): boolean {
		return !!useCustom[chainId] && !!custom[chainId];
	}

	function setCustom(chainId: number, url: string) {
		if (!SUPPORTED_CHAIN_IDS.has(chainId)) return;
		const trimmed = url.trim();
		if (!trimmed) {
			clearCustom(chainId);
			return;
		}
		custom[chainId] = trimmed;
		// Saving a URL for the first time implies the user wants to use it; this
		// matches the behaviour we promised (toggle defaults to "use mine" once
		// an override exists).
		useCustom[chainId] = true;
		writeCustom(custom);
	}

	function clearCustom(chainId: number) {
		delete custom[chainId];
		useCustom[chainId] = false;
		writeCustom(custom);
	}

	function setUseCustom(chainId: number, next: boolean) {
		useCustom[chainId] = next;
	}

	/**
	 * Pick the effective URL for reads on `chainId`. Returns the user's
	 * override when they've both configured one AND have the toggle on;
	 * otherwise returns the caller's default (usually the proxy).
	 */
	function resolve(chainId: number, defaultUrl: string | undefined): string | undefined {
		if (isUsingCustom(chainId)) return custom[chainId];
		return defaultUrl;
	}

	/**
	 * Quick health check: POST an eth_blockNumber call and require a hex
	 * result back. Throws a caller-friendly string on failure.
	 */
	async function probe(url: string): Promise<bigint> {
		const trimmed = url.trim();
		if (!trimmed) throw new Error("Empty URL");
		let res: Response;
		try {
			res = await fetch(trimmed, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
			});
		} catch {
			throw new Error("Could not reach endpoint");
		}
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		let data: any;
		try { data = await res.json(); } catch { throw new Error("Non-JSON response"); }
		if (data?.error) throw new Error(data.error.message || "RPC error");
		const hex = data?.result;
		if (typeof hex !== "string" || !hex.startsWith("0x")) throw new Error("Unexpected response shape");
		return BigInt(hex);
	}

	return {
		get custom() { return custom; },
		get useCustom() { return useCustom; },
		getCustom,
		hasCustom,
		isUsingCustom,
		setCustom,
		clearCustom,
		setUseCustom,
		resolve,
		probe,
	};
}

export const rpcSettings = createRpcSettingsStore();

export const RPC_OVERRIDE_CHAINS: Array<{ chainId: number; label: string }> = [
	{ chainId: 11155111, label: "Sepolia (L1)" },
	{ chainId: 534351, label: "Scroll Sepolia (L2)" },
];
