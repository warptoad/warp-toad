/**
 * Bridge sync executor.
 *
 * Exports `runSyncCycle` - the single unit of work that `syncOrchestrator`
 * queues and batches. Each cycle is route-aware: given a `SyncRequirements`
 * flag set (the union of every attached waiter's needs), it runs only the
 * sub-tasks needed to satisfy the batch.
 *
 * Pattern mirrors the working `backend/scripts/syncTestnetToAztec.ts`:
 * - L2→L1 local-root pushes only run when a waiter's source chain is that L2.
 * - L1→L2 dispatches (updateGigaRoot + sendGigaRoot → specific adapter) only
 *   run when a waiter's destination chain is that L2.
 * - Step 5 receive polling is best-effort (messenger auto-relays anyway).
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

// @ts-ignore
import {
  bridgeAZTECLocalRootToL1,
  bridgeEVMLocalRootToL1,
  updateGigaRoot,
  sendGigaRoot,
  receiveGigaRootOnAztec,
  receiveGigaRootOnEvmL2,
  getPayableGigaRootRecipients,
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
import type { SyncRequirements } from './syncRequirements.js';

/**
 * Module-level Aztec wallet cache.
 *
 * Deploying an Aztec account (even via the sponsored FPC) takes several
 * seconds and burns DA bandwidth, so we do it exactly once per (l1ChainId,
 * nodeUrl) pair and reuse the wallet + sponsoredPaymentMethod across all
 * subsequent sync cycles.
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
      const [alice] = await getInitialTestAccountsData();
      secrets = alice;
      console.log('[bridge-sync] using sandbox test account #0 as Aztec wallet');
    } else {
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
  promise.catch(() => aztecWalletCache.delete(cacheKey));
  return promise;
}

async function reconstructAztecContracts(l1ChainId: bigint, aztecWallet: any) {
  const aztecAddrs = loadAztecContractMetadata(l1ChainId);
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

export interface FullSyncResult {
  aztec: {
    sendRootToL1TxHash: string;
    refreshRootTxHash: string;
    receiveGigaRootTxHash: string;
  } | null;
  scroll: {
    sendRootToL1TxHash: string;
    receiveGigaRootTxHash: string;
  } | null;
  updateGigaRootTxHash: string;
  sendGigaRootTxHash: string;
  gigaRootSent: string;
}

// Safety-net ceilings so a stuck leg can't block the cycle indefinitely.
// These only kick in if a step exceeds normal testnet latency; success on
// the happy path is much faster.
const AZTEC_LEG_TIMEOUT_MS = 75 * 60_000;    // step 1
const SCROLL_LEG_TIMEOUT_MS = 3 * 60 * 60_000; // step 2
const AZTEC_RECV_TIMEOUT_MS = 45 * 60_000;   // step 5 Aztec
const SCROLL_RECV_TIMEOUT_MS = 90 * 60_000;  // step 5 Scroll

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => { if (timer) clearTimeout(timer); }) as Promise<T>;
}

/**
 * Run a route-aware sync cycle. `requirements` is the OR-union of all waiters
 * batched into this cycle; each sub-task runs only if its flag is set.
 *
 * Flag → step mapping:
 *   needAztecL2ToL1   → step 1 (bridgeAZTECLocalRootToL1)
 *   needScrollL2ToL1  → step 2 (bridgeEVMLocalRootToL1)
 *   any flag          → step 3 (updateGigaRoot) with the minimal provider list
 *   dispatchTo*       → step 4 (sendGigaRoot) with flagged recipients
 *   dispatchTo*       → step 5 (receive on that L2, best-effort)
 *
 * Steps 3 and 4 throw on failure (orchestrator retries). Steps 1, 2, 5 also
 * throw on failure if their flag was set; the orchestrator's retry kicks in,
 * and an eventual second failure rejects the waiters so they can surface the
 * error. Step 5 is bounded so a stuck messenger doesn't block forever.
 */
export async function runSyncCycle(
  privateKey: string,
  confirmations: number,
  requirements: SyncRequirements,
): Promise<FullSyncResult> {
  const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
  const l1ChainConfig = getChainConfig(l1ChainIdStr);
  const l1Account = privateKeyToAccount(privateKey as Hex);
  const l1PublicClient = createPublicClient({ transport: http(l1ChainConfig.rpcUrl) });
  const l1WalletClient = createWalletClient({ account: l1Account, transport: http(l1ChainConfig.rpcUrl) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());
  const isSandbox = l1ChainId === 31337n;
  const conf = isSandbox ? 1 : confirmations;
  console.log(`[sync] cycle starting on L1 chainId=${l1ChainId} requirements=${JSON.stringify(requirements)}`);

  const l1Contracts = loadL1Contracts(l1ChainId, l1PublicClient as any, l1WalletClient as any, true);
  const { gigaBridge, l1WarpToadAddress } = l1Contracts;

  const touchesAztec = requirements.needAztecL2ToL1 || requirements.dispatchToAztec;
  const touchesScroll = requirements.needScrollL2ToL1 || requirements.dispatchToScroll;

  // L1 adapter handles + addresses. Only resolved for legs we'll touch.
  const aztecAdapter = touchesAztec
    ? loadL1AdapterByType(l1ChainId, l1PublicClient as any, l1WalletClient as any, 'aztec')
    : null;
  const scrollAdapter = touchesScroll
    ? loadL1AdapterByType(l1ChainId, l1PublicClient as any, l1WalletClient as any, 'scroll')
    : null;

  // Aztec-side state (wallet + contracts) - needed for any Aztec-touching flag.
  let aztecState: { wallet: any; pxe: any; node: any; sponsoredPaymentMethod: any; aztecWarpToad: any; aztecBridgeAdapter: any } | null = null;
  if (touchesAztec) {
    const aztecRpc = process.env.AZTEC_NODE_URL;
    if (!aztecRpc) throw new Error('AZTEC_NODE_URL required for Aztec legs');
    const cached = await getOrCreateAztecWallet(l1ChainId, aztecRpc);
    const { aztecWarpToad, aztecBridgeAdapter } = await reconstructAztecContracts(l1ChainId, cached.wallet);
    aztecState = { ...cached, aztecWarpToad, aztecBridgeAdapter };
  }

  // Scroll-side state - needed for any Scroll-touching flag.
  let scrollState: { l2PublicClient: any; l2WalletClient: any; L2WarpToad: any; L2Adapter: any } | null = null;
  if (touchesScroll) {
    const scrollRpc = process.env.SCROLL_RPC_URL;
    if (!scrollRpc) throw new Error('SCROLL_RPC_URL required for Scroll legs');
    const l2Account = privateKeyToAccount(privateKey as Hex);
    const l2PublicClient = createPublicClient({ transport: http(scrollRpc) });
    const l2WalletClient = createWalletClient({ account: l2Account, transport: http(scrollRpc) });
    const l2ChainId = BigInt(await l2PublicClient.getChainId());
    const { L2WarpToad, L2Adapter } = loadScrollContracts(
      l2ChainId, l2PublicClient as any, l2WalletClient as any,
    );
    scrollState = { l2PublicClient, l2WalletClient, L2WarpToad, L2Adapter };
  }

  // === Step 1: Aztec L2→L1 push ===
  let aztecLeg: FullSyncResult['aztec'] = null;
  if (requirements.needAztecL2ToL1) {
    console.log('[sync] step 1: pushing Aztec local root → L1');
    const r = await withTimeout(
      bridgeAZTECLocalRootToL1(
        aztecState!.node,
        aztecState!.aztecBridgeAdapter,
        aztecAdapter!.adapter,
        l1PublicClient as any,
        l1WalletClient as any,
        aztecState!.wallet,
        aztecState!.sponsoredPaymentMethod,
        conf,
      ),
      AZTEC_LEG_TIMEOUT_MS,
      'Aztec L2→L1',
    );
    aztecLeg = {
      sendRootToL1TxHash: r.sendRootToL1Tx.receipt.txHash.toString(),
      refreshRootTxHash: r.refreshRootTx.transactionHash,
      receiveGigaRootTxHash: '',
    };
  }

  // === Step 2: Scroll L2→L1 push ===
  let scrollLeg: FullSyncResult['scroll'] = null;
  if (requirements.needScrollL2ToL1) {
    console.log('[sync] step 2: pushing Scroll local root → L1');
    const r = await withTimeout(
      bridgeEVMLocalRootToL1(
        l1PublicClient as any,
        l1WalletClient as any,
        scrollState!.l2PublicClient,
        scrollState!.l2WalletClient,
        scrollState!.L2Adapter,
        conf,
      ),
      SCROLL_LEG_TIMEOUT_MS,
      'Scroll L2→L1',
    );
    scrollLeg = {
      sendRootToL1TxHash: r.sendRootToL1TxHash,
      receiveGigaRootTxHash: '',
    };
  }

  // Build the minimal provider/recipient list from flags. L1WarpToad is always
  // in the list (its own local root updates on L1 deposits, and it's a valid
  // self-recipient per the old working syncTestnetToAztec.ts pattern).
  const recipients: Address[] = [l1WarpToadAddress];
  if (aztecAdapter) recipients.push(aztecAdapter.address);
  if (scrollAdapter) recipients.push(scrollAdapter.address);

  // === Step 3: updateGigaRoot ===
  console.log(`[sync] step 3: updateGigaRoot (${recipients.length} providers)`);
  const { gigaRootUpdateTxHash } = await updateGigaRoot(
    l1PublicClient as any,
    l1WalletClient as any,
    gigaBridge,
    recipients,
    conf,
  );

  // === Step 4: sendGigaRoot (skip when no dispatch is flagged) ===
  let sendGigaRootTx: any = null;
  let sendGigaRootTxHash = 'N/A';
  let gigaRootSent = '';
  const anyDispatch = requirements.dispatchToAztec || requirements.dispatchToScroll;
  if (anyDispatch) {
    const payable = await getPayableGigaRootRecipients(l1ChainId);
    console.log(`[sync] step 4: sendGigaRoot to ${recipients.length} recipients`);
    const r = await sendGigaRoot(
      l1PublicClient as any,
      l1WalletClient as any,
      gigaBridge,
      recipients,
      payable,
      conf,
    );
    sendGigaRootTx = r.sendGigaRootTx;
    sendGigaRootTxHash = r.sendGigaRootTxHash;
    gigaRootSent = r.gigaRootSent;
  } else {
    console.log('[sync] step 4: skipped (no dispatch flagged)');
  }

  // === Step 5: receive on each flagged L2 (best-effort, parallel) ===
  if (sendGigaRootTx) {
    console.log('[sync] step 5: awaiting GigaRoot arrival on flagged L2s (best-effort)');
    const [aztecRecv, scrollRecv] = await Promise.allSettled([
      requirements.dispatchToAztec && aztecState
        ? withTimeout(
            receiveGigaRootOnAztec(
              aztecState.aztecBridgeAdapter,
              aztecAdapter!.adapter,
              aztecState.aztecWarpToad,
              l1PublicClient as any,
              sendGigaRootTx,
              aztecState.node,
              isSandbox,
              aztecState.sponsoredPaymentMethod,
              aztecState.wallet,
            ),
            AZTEC_RECV_TIMEOUT_MS,
            'Aztec L1→L2 receive',
          )
        : Promise.resolve(null),
      requirements.dispatchToScroll && scrollState
        ? withTimeout(
            receiveGigaRootOnEvmL2(scrollState.l2PublicClient, scrollState.L2Adapter, BigInt(gigaRootSent)),
            SCROLL_RECV_TIMEOUT_MS,
            'Scroll L1→L2 receive',
          )
        : Promise.resolve(null),
    ]);

    if (aztecRecv.status === 'fulfilled' && aztecRecv.value) {
      if (!aztecLeg) aztecLeg = { sendRootToL1TxHash: 'N/A', refreshRootTxHash: 'N/A', receiveGigaRootTxHash: '' };
      aztecLeg.receiveGigaRootTxHash = (aztecRecv.value as any).receiveGigaRootTx.receipt.txHash.toString();
    } else if (aztecRecv.status === 'rejected') {
      console.warn('[sync] step 5 Aztec receive failed:', (aztecRecv.reason as Error).message || aztecRecv.reason);
    }
    if (scrollRecv.status === 'fulfilled' && scrollRecv.value) {
      if (!scrollLeg) scrollLeg = { sendRootToL1TxHash: 'N/A', receiveGigaRootTxHash: '' };
      scrollLeg.receiveGigaRootTxHash = (scrollRecv.value as any).receiveGigaRootTxHash;
    } else if (scrollRecv.status === 'rejected') {
      console.warn('[sync] step 5 Scroll receive failed:', (scrollRecv.reason as Error).message || scrollRecv.reason);
    }
  }

  console.log(`[sync] cycle complete (gigaRootSent=${gigaRootSent || 'N/A'})`);
  return {
    aztec: aztecLeg,
    scroll: scrollLeg,
    updateGigaRootTxHash: gigaRootUpdateTxHash,
    sendGigaRootTxHash,
    gigaRootSent,
  };
}
