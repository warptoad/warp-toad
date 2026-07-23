/**
 * Shared viem HTTP transport: generous timeout, plus multi-provider failover.
 *
 * TIMEOUT
 *
 * viem's `http()` defaults to a 10 second timeout. That is far too tight for
 * ZKsync Era: `eth_estimateGas` there runs a full VM simulation including
 * pubdata accounting, and for the pubdata-heavy `sentLocalRootToL1()` on
 * L2ZkStackBridgeAdapter it measures at roughly 21 seconds against
 * https://sepolia.era.zksync.dev.
 *
 * The result was a keeper that looked healthy and did nothing: every Era L2→L1
 * local-root push died at
 *
 *     ContractFunctionExecutionError: The request took too long to respond.
 *     URL: https://sepolia.era.zksync.dev/
 *     Request body: {"method":"eth_estimateGas", ... "sentLocalRootToL1()"}
 *
 * before the node ever answered. The outer `withTimeout(..., leg.l2ToL1TimeoutMs)`
 * budget in executor.ts is measured in hours, so it never got a chance to matter.
 * Downstream, L1 kept anchoring a stale Era local root, and every withdraw that
 * needed a fresh one failed with "Could not find a gigaRoot containing your
 * commitment".
 *
 * Note this is a *response* timeout, so raising it does not slow down failures
 * that come back as an immediate HTTP error (a 429 from a rate-limited
 * provider still returns straight away).
 *
 * Override with RPC_TIMEOUT_MS if a chain turns out to need even longer.
 *
 * FAILOVER
 *
 * Any RPC env var accepts a comma-separated list of URLs. With more than one,
 * the clients get a viem `fallback()` transport that moves to the next provider
 * when the current one errors, so a single provider's rate limit or outage no
 * longer stops the keeper:
 *
 *     SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/KEY,https://ethereum-sepolia-rpc.publicnode.com
 *
 * A single URL keeps a plain `http()` transport, so existing configs behave
 * exactly as before.
 *
 * Caveat for wallet clients: providers can disagree about the pending nonce, so
 * a mid-send failover can produce "nonce too low". viem only moves to the next
 * provider when the current one actually errors, so this is confined to the
 * outage case it exists to survive, and a re-broadcast of an already-signed tx
 * is idempotent. Ordering matters: put the most reliable provider first.
 */
import { http, fallback } from 'viem';

/** Response timeout for every RPC the keeper makes. */
export const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 60_000);

/**
 * Split a comma-separated RPC env var into URLs. Tolerates stray whitespace and
 * trailing commas. Returns [] for undefined/empty so callers can decide whether
 * a missing URL is fatal.
 */
export function parseRpcUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * `http()` with {@link RPC_TIMEOUT_MS} applied, and `fallback()` across every
 * URL when the value lists more than one. Use instead of a bare `http(url)`.
 */
export function rpcTransport(urls: string) {
  const list = parseRpcUrls(urls);
  if (list.length === 0) {
    throw new Error('rpcTransport: no RPC URL configured');
  }
  const transports = list.map((url) => http(url, { timeout: RPC_TIMEOUT_MS }));
  return transports.length === 1 ? transports[0] : fallback(transports);
}
