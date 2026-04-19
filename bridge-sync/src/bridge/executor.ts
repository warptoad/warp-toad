/**
 * Bridge sync executor.
 *
 * Exports `runFullSyncCycle` - the single unit of work that
 * `syncOrchestrator` queues and batches. One cycle:
 *   1. pushes Aztec local root → L1
 *   2. pushes Scroll local root → L1
 *   3. updates the L1 GigaRoot (folds in both fresh roots)
 *   4. sends the new GigaRoot to all L2 adapters
 *   5. waits for receipt on each L2
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
  bridgeAZTECLocalRootToL1,
  bridgeEVMLocalRootToL1,
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

/**
 * Module-level Aztec wallet cache.
 *
 * Deploying an Aztec account (even via the sponsored FPC) takes several
 * seconds and burns DA bandwidth, so we do it exactly once per (l1ChainId,
 * nodeUrl) pair and reuse the wallet + sponsoredPaymentMethod across all
 * subsequent sync cycles.
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
  // Drop the cache entry on init failure so the next call retries.
  promise.catch(() => aztecWalletCache.delete(cacheKey));
  return promise;
}

/**
 * Reconstruct an Aztec WarpToad + L2AztecBridgeAdapter contract handle from
 * the saved deployment metadata. Mirrors syncLocal.ts:108-129.
 */
async function reconstructAztecContracts(l1ChainId: bigint, aztecWallet: any) {
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

/**
 * Run one complete cross-chain root sync cycle. Sequential order:
 *   1. push Aztec local root → L1   (~30-60 min on testnet)
 *   2. push Scroll local root → L1  (~2-3 hours on testnet)
 *   3. updateGigaRoot on L1          (seconds)
 *   4. sendGigaRoot to all L2 adapters (seconds)
 *   5. await receipt on each L2 in parallel (~10-30 min for Aztec L1->L2)
 *
 * A leg is skipped when its env RPC isn't configured. Throws on any failure
 * so the orchestrator can retry.
 */
export async function runFullSyncCycle(
  privateKey: string,
  confirmations: number,
): Promise<FullSyncResult> {
  // The orchestrator's EVM_PRIVATE_KEY signs against this single L1 throughout
  // the cycle. SYNC_L1_CHAIN_ID lets dev override (default Sepolia).
  const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
  const l1ChainConfig = getChainConfig(l1ChainIdStr);
  const l1Account = privateKeyToAccount(privateKey as Hex);
  const l1PublicClient = createPublicClient({ transport: http(l1ChainConfig.rpcUrl) });
  const l1WalletClient = createWalletClient({ account: l1Account, transport: http(l1ChainConfig.rpcUrl) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());
  const isSandbox = l1ChainId === 31337n;
  const conf = isSandbox ? 1 : confirmations;
  console.log(`[sync] cycle starting on L1 chainId=${l1ChainId}`);

  const { gigaBridge } = loadL1Contracts(
    l1ChainId, l1PublicClient as any, l1WalletClient as any, true,
  );
  const { adapter: L1AztecAdapter } = loadL1AdapterByType(
    l1ChainId, l1PublicClient as any, l1WalletClient as any, 'aztec',
  );

  const localRootProviders: Address[] = await getLocalRootProviders(l1ChainId);
  const payableLocalRootProviders: Address[] = await getPayableGigaRootRecipients(l1ChainId);

  // A leg runs only if its RPC env is set. README requires both for prod
  // testnet; the skip path exists so local-sandbox dev can run partial cycles.
  const aztecRpc = process.env.AZTEC_NODE_URL;
  const scrollRpc = process.env.SCROLL_RPC_URL;

  // === Step 1/5: Aztec local root → L1 ===
  let aztecLeg: FullSyncResult['aztec'] = null;
  let aztecState: { wallet: any; pxe: any; node: any; sponsoredPaymentMethod: any; aztecWarpToad: any; aztecBridgeAdapter: any } | null = null;
  if (aztecRpc) {
    console.log('[sync] step 1/5: pushing Aztec local root to L1');
    const cached = await getOrCreateAztecWallet(l1ChainId, aztecRpc);
    const { aztecWarpToad, aztecBridgeAdapter } = await reconstructAztecContracts(l1ChainId, cached.wallet);
    aztecState = { ...cached, aztecWarpToad, aztecBridgeAdapter };
    const r = await bridgeAZTECLocalRootToL1(
      cached.node,
      aztecBridgeAdapter,
      L1AztecAdapter,
      l1PublicClient as any,
      l1WalletClient as any,
      cached.wallet,
      cached.sponsoredPaymentMethod,
      conf,
    );
    aztecLeg = {
      sendRootToL1TxHash: r.sendRootToL1Tx.receipt.txHash.toString(),
      refreshRootTxHash: r.refreshRootTx.transactionHash,
      receiveGigaRootTxHash: '',
    };
  } else {
    console.log('[sync] step 1/5: skipped (AZTEC_NODE_URL not set)');
  }

  // === Step 2/5: Scroll local root → L1 ===
  let scrollLeg: FullSyncResult['scroll'] = null;
  let scrollState: { l2PublicClient: any; l2WalletClient: any; L2WarpToad: any; L2Adapter: any } | null = null;
  if (scrollRpc) {
    console.log('[sync] step 2/5: pushing Scroll local root to L1');
    const l2Account = privateKeyToAccount(privateKey as Hex);
    const l2PublicClient = createPublicClient({ transport: http(scrollRpc) });
    const l2WalletClient = createWalletClient({ account: l2Account, transport: http(scrollRpc) });
    const l2ChainId = BigInt(await l2PublicClient.getChainId());
    const { L2WarpToad, L2Adapter } = loadScrollContracts(
      l2ChainId, l2PublicClient as any, l2WalletClient as any,
    );
    scrollState = { l2PublicClient, l2WalletClient, L2WarpToad, L2Adapter };
    const r = await bridgeEVMLocalRootToL1(
      l1PublicClient as any,
      l1WalletClient as any,
      l2PublicClient as any,
      l2WalletClient as any,
      L2Adapter,
      conf,
    );
    scrollLeg = {
      sendRootToL1TxHash: r.sendRootToL1TxHash,
      receiveGigaRootTxHash: '',
    };
  } else {
    console.log('[sync] step 2/5: skipped (SCROLL_RPC_URL not set)');
  }

  // === Step 3/5: updateGigaRoot ===
  console.log('[sync] step 3/5: updating GigaRoot on L1');
  const { gigaRootUpdateTxHash } = await updateGigaRoot(
    l1PublicClient as any,
    l1WalletClient as any,
    gigaBridge,
    localRootProviders,
    conf,
  );

  // === Step 4/5: sendGigaRoot ===
  console.log('[sync] step 4/5: sending GigaRoot to all L2 adapters');
  const { sendGigaRootTx, sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
    l1PublicClient as any,
    l1WalletClient as any,
    gigaBridge,
    localRootProviders,
    payableLocalRootProviders,
    conf,
  );

  // === Step 5/5: receive on each L2 (parallel) ===
  console.log('[sync] step 5/5: awaiting GigaRoot arrival on L2s');
  const [aztecRecv, scrollRecv] = await Promise.allSettled([
    aztecState
      ? receiveGigaRootOnAztec(
          aztecState.aztecBridgeAdapter,
          L1AztecAdapter,
          aztecState.aztecWarpToad,
          l1PublicClient as any,
          sendGigaRootTx,
          aztecState.node,
          isSandbox,
          aztecState.sponsoredPaymentMethod,
          aztecState.wallet,
        )
      : Promise.resolve(null),
    scrollState
      ? receiveGigaRootOnEvmL2(scrollState.l2PublicClient, scrollState.L2Adapter, BigInt(gigaRootSent))
      : Promise.resolve(null),
  ]);

  if (aztecLeg && aztecRecv.status === 'fulfilled' && aztecRecv.value) {
    aztecLeg.receiveGigaRootTxHash = (aztecRecv.value as any).receiveGigaRootTx.receipt.txHash.toString();
  }
  if (scrollLeg && scrollRecv.status === 'fulfilled' && scrollRecv.value) {
    scrollLeg.receiveGigaRootTxHash = (scrollRecv.value as any).receiveGigaRootTxHash;
  }

  if (aztecRecv.status === 'rejected') throw aztecRecv.reason;
  if (scrollRecv.status === 'rejected') throw scrollRecv.reason;

  console.log(`[sync] cycle complete (gigaRoot=${gigaRootSent})`);
  return {
    aztec: aztecLeg,
    scroll: scrollLeg,
    updateGigaRootTxHash: gigaRootUpdateTxHash,
    sendGigaRootTxHash,
    gigaRootSent,
  };
}
