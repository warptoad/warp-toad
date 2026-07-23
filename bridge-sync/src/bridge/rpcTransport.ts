/**
 * Shared viem HTTP transport with a timeout that suits L2 RPCs.
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
 */
import { http } from 'viem';

/** Response timeout for every RPC the keeper makes. */
export const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 60_000);

/** `http()` with {@link RPC_TIMEOUT_MS} applied. Use instead of a bare `http(url)`. */
export function rpcTransport(url: string) {
  return http(url, { timeout: RPC_TIMEOUT_MS });
}
