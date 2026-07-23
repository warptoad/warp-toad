/**
 * Upstream selection and failover for the browser-facing `/rpc/:chain` proxy.
 *
 * Lives outside server.ts so it can be exercised without booting the server.
 */
import { parseRpcUrls } from './rpcTransport.js';

/**
 * Upstream statuses worth retrying on the next provider. A 429 or a 5xx is the
 * provider's problem; a 400/403 is the request's, and retrying it just burns
 * the backup provider's quota too.
 */
export const RETRYABLE_UPSTREAM_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Give browser traffic its own upstream, separate from the keeper's.
 *
 * Prefix any RPC env var with `PROXY_` and the proxy uses it instead of the
 * keeper's, e.g. `PROXY_SEPOLIA_RPC_URL`. Both accept a comma-separated list.
 *
 * Why it matters: these used to be the same key. A withdraw that can't find its
 * gigaRoot drops the frontend into a client-side event scan, and that scan's
 * getLogs/eth_call storm (multiplied by viem's retries) rate-limits the shared
 * provider. The keeper then gets 429s on its own sync work, falls further
 * behind, and more users drop into the scan. Splitting the keys means user
 * traffic can degrade itself but not the keeper.
 *
 * Falls back to the keeper's URL when unset, so existing deployments keep
 * working unchanged (with the old shared-quota behaviour).
 */
export function proxyUpstreams(envNames: string[], keeperUrl: string | undefined): string[] {
  for (const name of envNames) {
    const override = parseRpcUrls(process.env[`PROXY_${name}`]);
    if (override.length > 0) return override;
  }
  return parseRpcUrls(keeperUrl);
}

export interface UpstreamResponse {
  status: number;
  /** Raw upstream body, or null when every attempt failed before responding. */
  text: string | null;
}

/**
 * POST `body` to each upstream in order, moving on only when one is
 * rate-limited, down, or unreachable.
 *
 * The last failure is what the caller returns to the client, so an exhausted
 * list still surfaces a real 429 (viem respects Retry-After) rather than a
 * synthetic error.
 *
 * `onError` receives already-scrubbed messages: undici puts the upstream URL,
 * and therefore the API key, into its error text.
 */
export async function forwardToUpstreams(
  upstreams: string[],
  body: unknown,
  onError?: (message: string) => void,
): Promise<UpstreamResponse> {
  let last: UpstreamResponse = { status: 502, text: null };

  for (const upstream of upstreams) {
    try {
      const res = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!RETRYABLE_UPSTREAM_STATUS.has(res.status)) {
        return { status: res.status, text };
      }
      last = { status: res.status, text };
    } catch (err: any) {
      const raw = typeof err?.message === 'string' ? err.message : 'upstream fetch failed';
      onError?.(raw.replace(/https?:\/\/\S+/g, '<upstream>'));
      last = { status: 502, text: null };
    }
  }

  return last;
}
