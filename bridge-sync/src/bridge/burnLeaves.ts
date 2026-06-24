/**
 * Burn-leaf snapshot indexer (TESTNET CONVENIENCE, not a production dependency).
 *
 * The frontend's getEvmMerkleData rebuilds a commitment's merkle path by
 * scanning every `Burn` event from the WarpToad deployment block to the local
 * root block - dozens of getLogs calls per withdraw, per user. This serves the
 * same ordered leaf set from a single cached server-side scan, so N users share
 * one scan instead of each replaying it (the testnet RPC-cost win).
 *
 * Privacy: we return the FULL leaf set for a block range; the client picks its
 * own leaf and builds the path locally, so the server never learns which
 * commitment a user is withdrawing.
 *
 * Safety: the client recomputes the tree root and checks it against the
 * on-chain local root before proving, and falls back to its own scan on any
 * mismatch. So this endpoint is never trusted for correctness, only for
 * availability, and the whole thing can be deleted without breaking withdraws.
 */
import { createPublicClient, http, type Address, type AbiEvent } from 'viem';
import { getChainConfig } from './chainMapper.js';
import { L1_WARPTOAD_ABI } from './contractLoader.js';

export interface BurnLeaf {
  index: number;
  commitment: string;
  amount: string;
}

export interface BurnLeavesSnapshot {
  chainId: string;
  warpToadAddress: string;
  fromBlock: string;
  toBlock: string;
  leaves: BurnLeaf[];
  fetchedAtMs: number;
}

// Leaves up to a fixed toBlock are immutable; the TTL only bounds how long an
// entry lingers in memory. Keep it modest.
const CACHE_TTL_MS = 60_000;
// Guardrail so a bad request can't ask us to scan an absurd range.
const MAX_BLOCK_SPAN = 5_000_000n;
const CHUNK = 10_000n;

const cache = new Map<string, { snap: BurnLeavesSnapshot; expiresAtMs: number }>();

let burnEventCache: AbiEvent | undefined;
function burnEvent(): AbiEvent {
  if (!burnEventCache) {
    const ev = L1_WARPTOAD_ABI().find((x: any) => x.type === 'event' && x.name === 'Burn');
    if (!ev) throw new Error('Burn event not found in L1WarpToad ABI');
    burnEventCache = ev as AbiEvent;
  }
  return burnEventCache;
}

export async function fetchBurnLeaves(
  chainIdStr: string,
  warpToadAddress: string,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<BurnLeavesSnapshot> {
  if (toBlock < fromBlock) throw new Error(`toBlock (${toBlock}) < fromBlock (${fromBlock})`);
  if (toBlock - fromBlock > MAX_BLOCK_SPAN) throw new Error(`Block span too large (> ${MAX_BLOCK_SPAN})`);

  const addr = warpToadAddress.toLowerCase() as Address;
  const key = `${chainIdStr}:${addr}:${fromBlock}:${toBlock}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAtMs > Date.now()) return hit.snap;

  const cfg = getChainConfig(chainIdStr as any);
  if (!cfg.rpcUrl) throw new Error(`No RPC URL configured for chain ${chainIdStr}`);
  const client = createPublicClient({ transport: http(cfg.rpcUrl) });
  const ev = burnEvent();

  const leaves: BurnLeaf[] = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    let end = start + CHUNK - 1n;
    if (end > toBlock) end = toBlock;
    const logs = await client.getLogs({ address: addr, event: ev, fromBlock: start, toBlock: end });
    for (const log of logs as any[]) {
      leaves.push({
        index: Number(log.args.index),
        commitment: (log.args.commitment as bigint).toString(),
        amount: (log.args.amount as bigint).toString(),
      });
    }
  }
  // Order by tree index so the client can drop them straight into its leaf array.
  leaves.sort((a, b) => a.index - b.index);

  const snap: BurnLeavesSnapshot = {
    chainId: chainIdStr,
    warpToadAddress: addr,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    leaves,
    fetchedAtMs: Date.now(),
  };
  cache.set(key, { snap, expiresAtMs: Date.now() + CACHE_TTL_MS });
  return snap;
}
