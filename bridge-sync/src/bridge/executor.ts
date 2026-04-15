/**
 * In-process bridge executor.
 *
 * Replaces the previous child-process / `pnpm tsx scripts/bridge.ts` shell-out
 * with direct, in-process calls to the backend's bridging library. The flow
 * mirrors `backend/scripts/syncLocal.ts` and `backend/scripts/syncLocalFromAztec.ts`,
 * which are the known-working post-viem-migration sandbox sync scripts.
 *
 * Why we don't import from `@warp-toad/backend/*`:
 * - The published `dist/` is stale (pre-viem-migration). The live source under
 *   `backend/` is the source of truth. Cross-workspace imports below resolve
 *   to `.ts` files at runtime via tsx.
 * - `backend/scripts/deployment.ts` and `backend/scripts/utils.ts` transitively
 *   import `hardhat`, which boots the Hardhat runtime in cwd. We bypass them
 *   entirely and use our local `contractLoader.ts` for L1/L2-Scroll handles.
 */
import { createPublicClient, createWalletClient, http, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { getInitialTestAccountsData } from '@aztec/accounts/testing';

// Direct relative source imports (resolved by tsx at runtime). These modules
// only depend on viem + @aztec/* and do NOT pull in hardhat.
// @ts-ignore
import {
  bridgeBetweenL1AndL2,
  updateGigaRoot,
  sendGigaRoot,
  receiveGigaRootOnAztec,
  receiveGigaRootOnEvmL2,
  getPayableGigaRootRecipients,
  getLocalRootProviders,
} from '../../../backend/lib/bridging.js';
// @ts-ignore
import { initPXE, getAztecWallet } from '../../../backend/deploy/utils/aztecUtilsNoEnv.js';
// @ts-ignore
import {
  WarpToadCoreContract,
  WarpToadCoreContractArtifact,
} from '../../../backend/aztec/WarpToadCore/src/artifacts/WarpToadCore.js';
// @ts-ignore
import {
  L2AztecBridgeAdapterContract,
  L2AztecBridgeAdapterContractArtifact,
} from '../../../backend/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js';

import {
  loadL1Contracts,
  loadScrollContracts,
  loadAztecContractMetadata,
  loadL1AdapterByType,
} from './contractLoader.js';
import { getChainConfig } from './chainMapper.js';
import type { ChainId, BridgeResult } from '../types/index.js';

/**
 * Module-level Aztec wallet cache.
 *
 * Deploying an Aztec account (even via the sponsored FPC) takes several
 * seconds and burns DA bandwidth, so we do it exactly once per (l1ChainId,
 * nodeUrl) pair and reuse the wallet + sponsoredPaymentMethod across all
 * subsequent bridge operations.
 *
 * On testnet we generate a fresh random ephemeral wallet on first use; the
 * SponsoredFPC pays the gas so the service needs zero funded ETH-side
 * Aztec credentials. On sandbox we keep using deterministic test account #0
 * because the sandbox ships them pre-funded.
 */
interface CachedAztecWallet {
  wallet: any;
  sponsoredPaymentMethod: any;
  pxe: any;
  node: any;
}
const aztecWalletCache = new Map<string, Promise<CachedAztecWallet>>();

async function getOrCreateAztecWallet(
  l1ChainId: bigint,
  nodeUrl: string,
): Promise<CachedAztecWallet> {
  const cacheKey = `${l1ChainId}@${nodeUrl}`;
  const cached = aztecWalletCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const isSandbox = l1ChainId === 31337n;
    const node = createAztecNodeClient(nodeUrl);

    let secrets: { secret: Fr; salt: Fr; signingKey: GrumpkinScalar };
    if (isSandbox) {
      // Sandbox: use the deterministic pre-funded test account #0.
      const [alice] = await getInitialTestAccountsData();
      secrets = alice;
      console.log('[bridge-sync] using sandbox test account #0 as Aztec wallet');
    } else {
      // Testnet/mainnet: generate a fresh ephemeral wallet. The SponsoredFPC
      // pays for the deploy and all subsequent bridge txs, so the service
      // needs zero pre-funded Aztec credentials.
      secrets = {
        secret: Fr.random(),
        salt: Fr.random(),
        signingKey: GrumpkinScalar.random(),
      };
      console.log('[bridge-sync] generated random ephemeral Aztec wallet (sponsored FPC)');
    }

    const { wallet, sponsoredPaymentMethod } = await getAztecWallet(nodeUrl, secrets, isSandbox);
    const pxe = await initPXE(node, l1ChainId);
    return { wallet, sponsoredPaymentMethod, pxe, node };
  })();

  aztecWalletCache.set(cacheKey, promise);
  // If init fails, drop the cache entry so the next call retries instead of
  // serving the rejected promise forever.
  promise.catch(() => aztecWalletCache.delete(cacheKey));
  return promise;
}

interface BridgeRoute {
  l1Rpc: string;
  aztecRpc?: string;
  scrollRpc?: string;
  isFromAztec: boolean;
  isToAztec: boolean;
  fromIsScroll: boolean;
  toIsScroll: boolean;
  isMultiHop: boolean;
  fromIsL1: boolean;
  toIsL1: boolean;
}

function resolveRoute(fromChainId: ChainId, toChainId: ChainId): BridgeRoute {
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);

  const isFromAztec = fromChain.isAztec;
  const isToAztec = toChain.isAztec;
  const fromIsScroll = fromChain.type === 'L2' && !isFromAztec;
  const toIsScroll = toChain.type === 'L2' && !isToAztec;
  const fromIsL1 = fromChain.type === 'L1';
  const toIsL1 = toChain.type === 'L1';
  const isMultiHop = (isFromAztec && toIsScroll) || (fromIsScroll && isToAztec);

  let l1Rpc: string;
  if (isMultiHop) {
    // aztec↔scroll: L1 hub is Sepolia (testnet) since no local scroll exists.
    const hub = getChainConfig('11155111');
    l1Rpc = hub.rpcUrl;
    if (!l1Rpc) throw new Error('SEPOLIA_RPC_URL must be set for aztec↔scroll multi-hop routes');
  } else if (fromIsL1) {
    l1Rpc = fromChain.rpcUrl;
  } else if (toIsL1) {
    l1Rpc = toChain.rpcUrl;
  } else {
    // aztec↔L1 or scroll↔L1 handled above; fallback shouldn't hit.
    l1Rpc = isFromAztec ? toChain.rpcUrl : fromChain.rpcUrl;
  }

  const aztecRpc = isFromAztec ? fromChain.rpcUrl : isToAztec ? toChain.rpcUrl : undefined;
  const scrollRpc = fromIsScroll ? fromChain.rpcUrl : toIsScroll ? toChain.rpcUrl : undefined;

  return { l1Rpc, aztecRpc, scrollRpc, isFromAztec, isToAztec, fromIsScroll, toIsScroll, isMultiHop, fromIsL1, toIsL1 };
}

/**
 * Reconstruct an Aztec WarpToad + L2AztecBridgeAdapter contract handle from
 * the saved deployment metadata. Mirrors syncLocal.ts:108-129.
 */
async function reconstructAztecContracts(
  l1ChainId: bigint,
  aztecWallet: any,
) {
  const aztecAddrs = loadAztecContractMetadata(l1ChainId);

  // Last constructor arg (decimals) needs to be a bigint; rest are strings.
  const warpToadCtorArgs = aztecAddrs.AztecWarpToad.constructorArgs.map(
    (v: any, i: number, arr: any[]) => (i === arr.length - 1 ? BigInt(v) : v),
  );
  const warpToadInstance = await getContractInstanceFromInstantiationParams(
    WarpToadCoreContractArtifact,
    {
      constructorArgs: warpToadCtorArgs,
      deployer: AztecAddress.fromString(aztecAddrs.AztecWarpToad.deployer),
      salt: Fr.fromHexString(aztecAddrs.AztecWarpToad.salt),
    },
  );
  await aztecWallet.registerContract(warpToadInstance, WarpToadCoreContractArtifact);
  const aztecWarpToad = await WarpToadCoreContract.at(warpToadInstance.address, aztecWallet);

  const adapterInstance = await getContractInstanceFromInstantiationParams(
    L2AztecBridgeAdapterContractArtifact,
    {
      constructorArgs: aztecAddrs.L2AztecBridgeAdapter.constructorArgs,
      deployer: AztecAddress.fromString(aztecAddrs.L2AztecBridgeAdapter.deployer),
      salt: Fr.fromHexString(aztecAddrs.L2AztecBridgeAdapter.salt),
    },
  );
  await aztecWallet.registerContract(adapterInstance, L2AztecBridgeAdapterContractArtifact);
  const aztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(
    adapterInstance.address,
    aztecWallet,
  );

  return { aztecWarpToad, aztecBridgeAdapter };
}

/**
 * Execute a bridge run between an L1 and an L2 (Aztec or Scroll EVM).
 *
 * Returns the relevant tx hashes for caller-side tracking.
 */
export async function executeBridge(
  operationId: string,
  fromChainId: ChainId,
  toChainId: ChainId,
  privateKey: string,
  _confirmations?: number,
): Promise<BridgeResult> {
  console.log(`[${operationId}] starting bridge: ${fromChainId} -> ${toChainId}`);

  const route = resolveRoute(fromChainId, toChainId);

  // ----- L1 clients -----
  const l1Account = privateKeyToAccount(privateKey as Hex);
  const l1PublicClient = createPublicClient({ transport: http(route.l1Rpc) });
  const l1WalletClient = createWalletClient({ account: l1Account, transport: http(route.l1Rpc) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());
  const isSandbox = l1ChainId === 31337n;
  const confirmations = isSandbox ? 1 : 3;
  console.log(`[${operationId}] L1 chainId=${l1ChainId} rpc=${route.l1Rpc}`);

  // GigaBridge + L1 WarpToad are chain-level, not adapter-specific.
  // Load the "primary" L1Adapter based on source/dest semantics:
  //   - if source is non-L1, primary matches source kind
  //   - else primary matches dest kind (L1→L2 direction)
  const primaryIsAztec = route.isFromAztec || (route.fromIsL1 && route.isToAztec);
  const { gigaBridge, L1Adapter: primaryL1Adapter } =
    loadL1Contracts(l1ChainId, l1PublicClient as any, l1WalletClient as any, primaryIsAztec);

  // `localRootProviders` pulls all three (L1WarpToad + both adapters) from the
  // deployment JSON so updateGigaRoot folds in every known local root.
  // `updateGigaRoot` itself skips providers whose mostRecentL2Root is still 0.
  const localRootProviders: Address[] = await getLocalRootProviders(l1ChainId);
  const payableLocalRootProviders: Address[] = await getPayableGigaRootRecipients(l1ChainId);

  // ----- Aztec state (lazy) -----
  let aztec: { wallet: any; pxe: any; node: any; sponsoredPaymentMethod: any; L2Adapter: any; L2WarpToad: any; } | null = null;
  if (route.isFromAztec || route.isToAztec) {
    if (!route.aztecRpc) throw new Error('aztecRpc missing for route');
    console.log(`[${operationId}] acquiring Aztec wallet for ${route.aztecRpc}`);
    const cached = await getOrCreateAztecWallet(l1ChainId, route.aztecRpc);
    const { aztecWarpToad, aztecBridgeAdapter } = await reconstructAztecContracts(l1ChainId, cached.wallet);
    aztec = {
      wallet: cached.wallet,
      pxe: cached.pxe,
      node: cached.node,
      sponsoredPaymentMethod: cached.sponsoredPaymentMethod,
      L2Adapter: aztecBridgeAdapter,
      L2WarpToad: aztecWarpToad,
    };
  }

  // ----- Scroll state (lazy) -----
  let scroll: { l2PublicClient: any; l2WalletClient: any; l2ChainId: bigint; L2Adapter: any; L2WarpToad: any; } | null = null;
  if (route.fromIsScroll || route.toIsScroll) {
    if (!route.scrollRpc) throw new Error('scrollRpc missing for route');
    const l2Account = privateKeyToAccount(privateKey as Hex);
    const l2PublicClient = createPublicClient({ transport: http(route.scrollRpc) });
    const l2WalletClient = createWalletClient({ account: l2Account, transport: http(route.scrollRpc) });
    const l2ChainId = BigInt(await l2PublicClient.getChainId());
    console.log(`[${operationId}] Scroll L2 chainId=${l2ChainId} rpc=${route.scrollRpc}`);
    const { L2WarpToad, L2Adapter } = loadScrollContracts(
      l2ChainId,
      l2PublicClient as any,
      l2WalletClient as any,
    );
    scroll = { l2PublicClient, l2WalletClient, l2ChainId, L2Adapter, L2WarpToad };
  }

  // ============================================================================
  // Route dispatch.
  //   Cases covered:
  //     L1 → Aztec          (light: skip L2→L1 root push)
  //     L1 → Scroll         (light: skip L2→L1 root push)
  //     Aztec → L1          (full: bridgeBetweenL1AndL2 aztec leg)
  //     Scroll → L1         (full: bridgeBetweenL1AndL2 scroll leg)
  //     Aztec → Scroll      (aztec leg, then await Scroll NewGigaRoot)
  //     Scroll → Aztec      (scroll leg, then receiveGigaRootOnAztec)
  // ============================================================================

  // --- L1 → Aztec (light) ---
  if (route.fromIsL1 && route.isToAztec) {
    if (!aztec) throw new Error('aztec state not initialized');
    console.log(`[${operationId}] L1 → Aztec light flow`);
    const { gigaRootUpdateTxHash } = await updateGigaRoot(
      l1PublicClient as any, l1WalletClient as any, gigaBridge, localRootProviders, confirmations,
    );
    const { sendGigaRootTx, sendGigaRootTxHash } = await sendGigaRoot(
      l1PublicClient as any, l1WalletClient as any, gigaBridge, localRootProviders, payableLocalRootProviders, confirmations,
    );
    await receiveGigaRootOnAztec(
      aztec.L2Adapter, primaryL1Adapter, aztec.L2WarpToad, l1PublicClient as any,
      sendGigaRootTx, aztec.node, isSandbox, aztec.sponsoredPaymentMethod, aztec.wallet,
    );
    return { sendRootToL1TxHash: undefined, updateGigaRootTxHash: gigaRootUpdateTxHash, sendGigaRootTxHash };
  }

  // --- L1 → Scroll (light) ---
  if (route.fromIsL1 && route.toIsScroll) {
    if (!scroll) throw new Error('scroll state not initialized');
    console.log(`[${operationId}] L1 → Scroll light flow`);
    const { gigaRootUpdateTxHash } = await updateGigaRoot(
      l1PublicClient as any, l1WalletClient as any, gigaBridge, localRootProviders, confirmations,
    );
    const { sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
      l1PublicClient as any, l1WalletClient as any, gigaBridge, localRootProviders, payableLocalRootProviders, confirmations,
    );
    console.log(`[${operationId}] awaiting NewGigaRoot(${gigaRootSent}) on Scroll L2...`);
    await receiveGigaRootOnEvmL2(scroll.l2PublicClient, scroll.L2Adapter, BigInt(gigaRootSent));
    return { sendRootToL1TxHash: undefined, updateGigaRootTxHash: gigaRootUpdateTxHash, sendGigaRootTxHash };
  }

  // --- Aztec → L1 (full) ---
  if (route.isFromAztec && route.toIsL1) {
    if (!aztec) throw new Error('aztec state not initialized');
    console.log(`[${operationId}] Aztec → L1 full flow`);
    const result = await bridgeBetweenL1AndL2(
      l1PublicClient as any, l1WalletClient as any, primaryL1Adapter, gigaBridge,
      aztec.L2Adapter, aztec.L2WarpToad,
      localRootProviders, payableLocalRootProviders,
      { isAztec: true, PXE: aztec.pxe, sponsoredPaymentMethod: aztec.sponsoredPaymentMethod, aztecNode: aztec.node, aztecWallet: aztec.wallet },
    );
    return {
      sendRootToL1TxHash: result.txHashes.sendRootToL1TxHash,
      updateGigaRootTxHash: result.txHashes.gigaRootUpdateTxHash,
      sendGigaRootTxHash: result.txHashes.sendGigaRootTxHash,
    };
  }

  // --- Scroll → L1 (full) ---
  if (route.fromIsScroll && route.toIsL1) {
    if (!scroll) throw new Error('scroll state not initialized');
    console.log(`[${operationId}] Scroll → L1 full flow`);
    const result = await bridgeBetweenL1AndL2(
      l1PublicClient as any, l1WalletClient as any, primaryL1Adapter, gigaBridge,
      scroll.L2Adapter, scroll.L2WarpToad,
      localRootProviders, payableLocalRootProviders,
      undefined,
      { l2PublicClient: scroll.l2PublicClient, l2WalletClient: scroll.l2WalletClient },
    );
    return {
      sendRootToL1TxHash: result.txHashes.sendRootToL1TxHash,
      updateGigaRootTxHash: result.txHashes.gigaRootUpdateTxHash,
      sendGigaRootTxHash: result.txHashes.sendGigaRootTxHash,
    };
  }

  // --- Aztec → Scroll (multi-hop) ---
  // Aztec leg does local-root push + updateGigaRoot + sendGigaRoot (which fans
  // out to Scroll since L1ScrollAdapter is a payable recipient). Then we poll
  // Scroll for the gigaRoot arrival.
  if (route.isFromAztec && route.toIsScroll) {
    if (!aztec || !scroll) throw new Error('aztec+scroll state not initialized');
    console.log(`[${operationId}] Aztec → Scroll multi-hop`);
    const result = await bridgeBetweenL1AndL2(
      l1PublicClient as any, l1WalletClient as any, primaryL1Adapter, gigaBridge,
      aztec.L2Adapter, aztec.L2WarpToad,
      localRootProviders, payableLocalRootProviders,
      { isAztec: true, PXE: aztec.pxe, sponsoredPaymentMethod: aztec.sponsoredPaymentMethod, aztecNode: aztec.node, aztecWallet: aztec.wallet },
    );
    console.log(`[${operationId}] awaiting NewGigaRoot(${result.roots.gigaRootSent}) on Scroll L2...`);
    await receiveGigaRootOnEvmL2(scroll.l2PublicClient, scroll.L2Adapter, BigInt(result.roots.gigaRootSent));
    return {
      sendRootToL1TxHash: result.txHashes.sendRootToL1TxHash,
      updateGigaRootTxHash: result.txHashes.gigaRootUpdateTxHash,
      sendGigaRootTxHash: result.txHashes.sendGigaRootTxHash,
    };
  }

  // --- Scroll → Aztec (multi-hop) ---
  // Scroll leg does L2→L1 claim + updateGigaRoot + sendGigaRoot. The Scroll leg
  // receives the round-trip gigaRoot on Scroll. We additionally finalize the
  // L1→Aztec leg via receiveGigaRootOnAztec, using the L1AztecAdapter handle.
  if (route.fromIsScroll && route.isToAztec) {
    if (!aztec || !scroll) throw new Error('aztec+scroll state not initialized');
    console.log(`[${operationId}] Scroll → Aztec multi-hop`);
    const result = await bridgeBetweenL1AndL2(
      l1PublicClient as any, l1WalletClient as any, primaryL1Adapter, gigaBridge,
      scroll.L2Adapter, scroll.L2WarpToad,
      localRootProviders, payableLocalRootProviders,
      undefined,
      { l2PublicClient: scroll.l2PublicClient, l2WalletClient: scroll.l2WalletClient },
    );
    // Finalize Aztec leg: use the L1AztecAdapter handle (different from primary scroll adapter).
    const { adapter: L1AztecAdapter } = loadL1AdapterByType(
      l1ChainId, l1PublicClient as any, l1WalletClient as any, 'aztec',
    );
    console.log(`[${operationId}] finalizing L1 → Aztec leg (receiveGigaRootOnAztec)...`);
    await receiveGigaRootOnAztec(
      aztec.L2Adapter, L1AztecAdapter, aztec.L2WarpToad, l1PublicClient as any,
      result.txObjects.sendGigaRootTx, aztec.node, isSandbox, aztec.sponsoredPaymentMethod, aztec.wallet,
    );
    return {
      sendRootToL1TxHash: result.txHashes.sendRootToL1TxHash,
      updateGigaRootTxHash: result.txHashes.gigaRootUpdateTxHash,
      sendGigaRootTxHash: result.txHashes.sendGigaRootTxHash,
    };
  }

  throw new Error(`Unsupported route: ${fromChainId} → ${toChainId}`);
}
