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
 *   entirely and use our local `contractLoader.ts` for L1/L2 contract handles.
 */
import { createPublicClient, createWalletClient, type Hex, type Address } from 'viem';
import { rpcTransport } from './rpcTransport.js';
import { privateKeyToAccount } from 'viem/accounts';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { TxHash } from '@aztec/stdlib/tx';
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
  loadZkStackContracts,
  loadAztecContractMetadata,
  loadL1AdapterForLeg,
} from './contractLoader.js';
import { getChainConfig } from './chainMapper.js';
import { describeRequirements, type SyncRequirements } from './syncRequirements.js';
import { AZTEC_LEG, LEGS, getLeg, legRpcUrl, type LegKey } from './legRegistry.js';
import { loadPending, savePending, clearPending } from './aztecPending.js';
import {
  loadPending as loadZkStackPending,
  savePending as saveZkStackPending,
  clearPending as clearZkStackPending,
} from './zkStackPending.js';

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
      deployer: AztecAddress.fromStringUnsafe(aztecAddrs.AztecWarpToad.deployer),
      salt: Fr.fromHexString(aztecAddrs.AztecWarpToad.salt),
    },
  );
  await aztecWallet.registerContract(warpToadInstance, WarpToadCoreContractArtifact);
  const aztecWarpToad = await WarpToadCoreContract.at(warpToadInstance.address, aztecWallet);

  const adapterInstance = await getContractInstanceFromInstantiationParams(
    L2AztecBridgeAdapterContractArtifact,
    {
      constructorArgs: aztecAddrs.L2AztecBridgeAdapter.constructorArgs,
      deployer: AztecAddress.fromStringUnsafe(aztecAddrs.L2AztecBridgeAdapter.deployer),
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

export interface LegSyncResult {
  sendRootToL1TxHash: string;
  /** Aztec only: the separate L1-side getNewRootFromL2 tx. */
  refreshRootTxHash?: string;
  receiveGigaRootTxHash: string;
}

export interface FullSyncResult {
  /** Per-leg outcome, keyed by LegKey ('aztec', '300', ...). Null = leg not run. */
  legs: Record<LegKey, LegSyncResult | null>;
  updateGigaRootTxHash: string;
  sendGigaRootTxHash: string;
  gigaRootSent: string;
}

/** A cycle that did nothing, with every leg present and null. */
export function emptySyncResult(): FullSyncResult {
  return {
    legs: Object.fromEntries(LEGS.map((l) => [l.key, null])),
    updateGigaRootTxHash: 'N/A',
    sendGigaRootTxHash: 'N/A',
    gigaRootSent: '',
  };
}

// Safety-net ceilings so a stuck leg can't block the cycle indefinitely. These only
// kick in if a step exceeds normal latency; the happy path is much faster. The L2->L1
// bound comes from the leg registry because it differs by an order of magnitude
// between chains (Era ~2h, a timeout-sealing chain ~8h).
const AZTEC_RECV_TIMEOUT_MS = 45 * 60_000;    // step 5 Aztec
const ZKSTACK_RECV_TIMEOUT_MS = 90 * 60_000;  // step 5 ZK Stack (L1->L2 is fast)

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
 * Requirement → step mapping:
 *   needL2ToL1[]  → step 1, one push per leg (Aztec or ZK Stack)
 *   always        → step 2 (updateGigaRoot) over every claimed provider
 *   always        → step 3 (sendGigaRoot) to every adapter
 *   dispatchTo[]  → step 4 (receive on that leg, best-effort)
 *
 * Steps 2 and 3 throw on failure (orchestrator retries). Steps 1 and 4 also throw on
 * failure if requested; the orchestrator's retry kicks in, and an eventual second
 * failure rejects the waiters so they can surface the error. Step 4 is bounded so a
 * stuck messenger doesn't block forever.
 */
export async function runSyncCycle(
  privateKey: string,
  confirmations: number,
  requirements: SyncRequirements,
): Promise<FullSyncResult> {
  const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
  const l1ChainConfig = getChainConfig(l1ChainIdStr);
  const l1Account = privateKeyToAccount(privateKey as Hex);
  const l1PublicClient = createPublicClient({ transport: rpcTransport(l1ChainConfig.rpcUrl) });
  const l1WalletClient = createWalletClient({ account: l1Account, transport: rpcTransport(l1ChainConfig.rpcUrl) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());
  const isSandbox = l1ChainId === 31337n;
  const conf = isSandbox ? 1 : confirmations;
  console.log(`[sync] cycle starting on L1 chainId=${l1ChainId} requirements: ${describeRequirements(requirements)}`);

  const l1Contracts = loadL1Contracts(l1ChainId, l1PublicClient as any, l1WalletClient as any, AZTEC_LEG);
  const { gigaBridge, l1WarpToadAddress } = l1Contracts;

  const touched = (key: LegKey) =>
    requirements.needL2ToL1.includes(key) || requirements.dispatchTo.includes(key);

  // L1 adapter handles for EVERY leg, not just the ones this cycle was triggered by.
  // Cheap (a deployment-file read plus a viem instance) and load-bearing: every cycle
  // includes them all as sendGigaRoot recipients. Without that, an aztec→L1 cycle
  // refreshes the L1 giga tree but leaves the other L2s pinned to whatever root they
  // last received, which is exactly how aztec→L2 used to break silently.
  //
  // Loaded optionally because local/dev deploys omit the ZK Stack adapters; a
  // leg whose adapter is absent simply isn't a recipient.
  const legAdapters = new Map<LegKey, { adapter: any; address: Address }>();
  for (const leg of LEGS) {
    const handle = loadL1AdapterForLeg(
      l1ChainId, l1PublicClient as any, l1WalletClient as any, leg.key, true,
    );
    if (handle) legAdapters.set(leg.key, handle);
    else if (touched(leg.key)) {
      throw new Error(`leg '${leg.key}' (${leg.label}) is required by this cycle but its L1 adapter is not deployed on chain ${l1ChainId}`);
    }
  }

  // Aztec-side state (wallet + contracts) - needed for any Aztec-touching requirement.
  let aztecState: { wallet: any; pxe: any; node: any; sponsoredPaymentMethod: any; aztecWarpToad: any; aztecBridgeAdapter: any } | null = null;
  if (touched(AZTEC_LEG)) {
    const aztecRpc = process.env.AZTEC_NODE_URL;
    if (!aztecRpc) throw new Error('AZTEC_NODE_URL required for Aztec legs');
    const cached = await getOrCreateAztecWallet(l1ChainId, aztecRpc);
    const { aztecWarpToad, aztecBridgeAdapter } = await reconstructAztecContracts(l1ChainId, cached.wallet);
    aztecState = { ...cached, aztecWarpToad, aztecBridgeAdapter };
  }

  // One client pair + handle set per touched ZK Stack leg.
  interface ZkStackLegState {
    l2PublicClient: any;
    l2WalletClient: any;
    L2WarpToad: any;
    L2Adapter: any;
  }
  const zkStackStates = new Map<LegKey, ZkStackLegState>();
  for (const leg of LEGS) {
    if (leg.kind !== 'zkstack' || !touched(leg.key)) continue;
    const rpc = legRpcUrl(leg);
    const l2Account = privateKeyToAccount(privateKey as Hex);
    const l2PublicClient = createPublicClient({ transport: rpcTransport(rpc) });
    const l2WalletClient = createWalletClient({ account: l2Account, transport: rpcTransport(rpc) });
    const onChainId = BigInt(await l2PublicClient.getChainId());
    if (onChainId !== leg.chainId) {
      throw new Error(`leg '${leg.key}' RPC reports chainId ${onChainId}, expected ${leg.chainId}`);
    }
    const { L2WarpToad, L2Adapter } = loadZkStackContracts(
      onChainId, l2PublicClient as any, l2WalletClient as any,
    );
    zkStackStates.set(leg.key, { l2PublicClient, l2WalletClient, L2WarpToad, L2Adapter });
  }

  const legResults: Record<LegKey, LegSyncResult | null> = Object.fromEntries(
    LEGS.map((l) => [l.key, null]),
  );

  // === Step 1: L2→L1 local-root pushes, one per requested leg ===
  //
  // Runs sequentially rather than in parallel: these all send L1 transactions from the
  // same key, and concurrent sends race the nonce. Slow legs are isolated into their
  // own cycle upstream by splitRequirements, so this loop is normally 0 or 1 legs.
  for (const legKey of requirements.needL2ToL1) {
    const leg = getLeg(legKey);
    console.log(`[sync] step 1: pushing ${leg.label} local root → L1`);

    if (leg.kind === 'aztec') {
      // Resume-from-disk support: if a previous cycle sent a root message but
      // crashed/restarted before it landed on L1, we have its state in the db volume.
      // Hand it to the bridging lib so it skips the costly resend and picks up the
      // epoch scan where the last container left off. If the tx is unfetchable (e.g.
      // Aztec node rolled state, stale entry), fall through to a fresh send.
      let resumeFrom: { aztecTxHashHex: string; blockNumberOfRoot: number; pxeL2RootHex: string } | undefined;
      const pending = loadPending(l1ChainId);
      if (pending) {
        try {
          const txHash = TxHash.fromString(pending.aztecTxHashHex);
          const effect = await aztecState!.node.getTxEffect(txHash);
          if (effect) {
            resumeFrom = {
              aztecTxHashHex: pending.aztecTxHashHex,
              blockNumberOfRoot: pending.blockNumberOfRoot,
              pxeL2RootHex: pending.pxeL2RootHex,
            };
            console.log(`[sync] resuming aztec leg from pending tx ${pending.aztecTxHashHex}`);
          } else {
            console.log(`[sync] pending aztec tx ${pending.aztecTxHashHex} not found on node, dropping and starting fresh`);
            clearPending(l1ChainId);
          }
        } catch (e) {
          console.warn('[sync] could not verify pending aztec tx, starting fresh:', e);
          clearPending(l1ChainId);
        }
      }

      const r = await withTimeout(
        bridgeAZTECLocalRootToL1(
          aztecState!.node,
          aztecState!.aztecBridgeAdapter,
          legAdapters.get(AZTEC_LEG)!.adapter,
          l1PublicClient as any,
          l1WalletClient as any,
          aztecState!.wallet,
          aztecState!.sponsoredPaymentMethod,
          conf,
          resumeFrom,
          async (state) => {
            savePending(l1ChainId, { ...state, createdAtMs: Date.now() });
          },
        ),
        leg.l2ToL1TimeoutMs,
        'Aztec L2→L1',
      );
      // Leg succeeded; clear the pending marker so the next cycle starts fresh.
      clearPending(l1ChainId);
      legResults[legKey] = {
        sendRootToL1TxHash: r.aztecTxHash.toString(),
        refreshRootTxHash: r.refreshRootTx.transactionHash,
        receiveGigaRootTxHash: '',
      };
      continue;
    }

    // ZK Stack leg. Resume-from-disk: if a previous cycle sent the L2 tx but crashed
    // before the batch was provable, the saved hash lets us pick up at the proof poll
    // instead of restarting the multi-hour finalization clock.
    const state = zkStackStates.get(legKey)!;
    let resumeFrom: { l2TxHashHex: Hex } | undefined;
    const pending = loadZkStackPending(l1ChainId, legKey);
    if (pending) {
      try {
        const receipt = await state.l2PublicClient.getTransactionReceipt({
          hash: pending.l2TxHashHex as Hex,
        });
        if (receipt && receipt.status === 'success') {
          resumeFrom = { l2TxHashHex: pending.l2TxHashHex as Hex };
          console.log(`[sync] resuming ${leg.label} leg from pending L2 tx ${pending.l2TxHashHex}`);
        } else {
          console.log(`[sync] pending ${leg.label} L2 tx ${pending.l2TxHashHex} not found or failed, dropping and starting fresh`);
          clearZkStackPending(l1ChainId, legKey);
        }
      } catch (e) {
        console.warn(`[sync] could not verify pending ${leg.label} L2 tx, starting fresh:`, e);
        clearZkStackPending(l1ChainId, legKey);
      }
    }

    const r = await withTimeout(
      bridgeEVMLocalRootToL1(
        l1PublicClient as any,
        l1WalletClient as any,
        state.l2PublicClient,
        state.l2WalletClient,
        state.L2Adapter,
        legAdapters.get(legKey)!.address,
        conf,
        resumeFrom,
        async (sent: { l2TxHashHex: Hex }) => {
          saveZkStackPending(l1ChainId, legKey, { ...sent, createdAtMs: Date.now() });
        },
      ),
      leg.l2ToL1TimeoutMs,
      `${leg.label} L2→L1`,
    );
    clearZkStackPending(l1ChainId, legKey);
    legResults[legKey] = { sendRootToL1TxHash: r.sendRootToL1TxHash, receiveGigaRootTxHash: '' };
  }

  // Providers/recipients: L1WarpToad plus every deployed adapter. L1WarpToad is always
  // included (its own local root updates on L1 deposits, and it's a valid
  // self-recipient per the old working syncTestnetToAztec.ts pattern).
  //
  // Only adapters in `legAdapters` are used. That matters: L1Infra deploys spare
  // L1ZkStackBridgeAdapter slots for future chains, and an unclaimed spare is
  // uninitialized and REVERTS on getLocalRootAndBlock(). Passing one to
  // updateGigaRoot would fail the whole cycle. legAdapters only ever contains legs the
  // registry declares, so spares are structurally excluded.
  const adapterAddresses = LEGS
    .map((l) => legAdapters.get(l.key)?.address)
    .filter((a): a is Address => Boolean(a));
  const recipients: Address[] = [l1WarpToadAddress, ...adapterAddresses];

  // === Step 2: updateGigaRoot ===
  console.log(`[sync] step 2: updateGigaRoot (${recipients.length} providers)`);
  const { gigaRootUpdateTxHash } = await updateGigaRoot(
    l1PublicClient as any,
    l1WalletClient as any,
    gigaBridge,
    recipients,
    conf,
  );

  // === Step 3: sendGigaRoot ===
  //
  // Every cycle dispatches to L1WarpToad AND every L2 adapter. Reasoning:
  //
  //  - L1WarpToad: its `gigaRoot` / `gigaRootHistory` only update via receiveGigaRoot;
  //    both the frontend gigaRoot read and L1WarpToad.mint's validity check depend on
  //    those. Missing it breaks L1 withdraws.
  //  - L2 adapters: the withdraw flow on an L2 reads that L2's stored gigaRoot and
  //    expects the L1 event trail to back it up. If we only dispatch to an L2 when its
  //    route is requested, any sync that doesn't touch that L2 leaves it pinned to
  //    whatever stale root it last received. That's exactly why aztec→L2 was
  //    silently broken: aztec→L1 cycles refreshed the L1 tree but never pushed to the
  //    other L2, so it kept serving a root that pre-dated any aztec leaf.
  //
  // Step 4 still gates the *receive* on the dispatch list (we don't want to wait for an
  // L2 receive on cycles the user doesn't care about), but the dispatch itself is cheap
  // and keeps everyone in sync.
  const payable = await getPayableGigaRootRecipients(l1ChainId);
  console.log(`[sync] step 3: sendGigaRoot to ${recipients.length} recipients`);
  const { sendGigaRootTx, sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
    l1PublicClient as any,
    l1WalletClient as any,
    gigaBridge,
    recipients,
    payable,
    conf,
  );

  // === Step 4: receive on each requested leg (best-effort, parallel) ===
  if (sendGigaRootTx) {
    console.log('[sync] step 4: awaiting GigaRoot arrival on requested legs (best-effort)');

    const waits = requirements.dispatchTo.map(async (legKey) => {
      const leg = getLeg(legKey);
      if (leg.kind === 'aztec') {
        if (!aztecState) return { legKey, value: null };
        const value = await withTimeout(
          receiveGigaRootOnAztec(
            aztecState.aztecBridgeAdapter,
            legAdapters.get(AZTEC_LEG)!.adapter,
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
        );
        return { legKey, value };
      }
      const state = zkStackStates.get(legKey);
      if (!state) return { legKey, value: null };
      const value = await withTimeout(
        receiveGigaRootOnEvmL2(state.l2PublicClient, state.L2Adapter, BigInt(gigaRootSent)),
        ZKSTACK_RECV_TIMEOUT_MS,
        `${leg.label} L1→L2 receive`,
      );
      return { legKey, value };
    });

    const settled = await Promise.allSettled(waits);
    for (const [i, outcome] of settled.entries()) {
      const legKey = requirements.dispatchTo[i];
      if (outcome.status === 'rejected') {
        console.warn(`[sync] step 4 ${legKey} receive failed:`, (outcome.reason as Error)?.message ?? outcome.reason);
        continue;
      }
      const { value } = outcome.value;
      if (!value) continue;
      if (!legResults[legKey]) {
        legResults[legKey] = { sendRootToL1TxHash: 'N/A', receiveGigaRootTxHash: '' };
      }
      legResults[legKey]!.receiveGigaRootTxHash =
        getLeg(legKey).kind === 'aztec'
          ? (value as any).receiveGigaRootTx.receipt.txHash.toString()
          : (value as any).receiveGigaRootTxHash;
    }
  }

  console.log(`[sync] cycle complete (gigaRootSent=${gigaRootSent || 'N/A'})`);
  return {
    legs: legResults,
    updateGigaRootTxHash: gigaRootUpdateTxHash,
    sendGigaRootTxHash,
    gigaRootSent,
  };
}
