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
  l2Rpc: string;
  isAztec: boolean;
}

function resolveRoute(fromChainId: ChainId, toChainId: ChainId): BridgeRoute {
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);

  const isFromAztec = fromChain.isAztec;
  const isToAztec = toChain.isAztec;
  const isAztec = isFromAztec || isToAztec;

  const l1Rpc =
    fromChain.type === 'L1' || fromChain.type === 'L2' ? fromChain.rpcUrl : toChain.rpcUrl;
  const l2Rpc = isAztec
    ? isFromAztec
      ? fromChain.rpcUrl
      : toChain.rpcUrl
    : fromChain.type === 'L2'
      ? fromChain.rpcUrl
      : toChain.rpcUrl;

  return { l1Rpc, l2Rpc, isAztec };
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
  // Accepted for caller compatibility; bridgeBetweenL1AndL2 derives the
  // correct value from isSandBox internally (1 conf locally, 3 on testnet).
  _confirmations?: number,
): Promise<BridgeResult> {
  console.log(`[${operationId}] starting bridge: ${fromChainId} -> ${toChainId}`);

  const { l1Rpc, l2Rpc, isAztec } = resolveRoute(fromChainId, toChainId);

  // ----- L1 viem clients + contract handles -----
  const l1Account = privateKeyToAccount(privateKey as Hex);
  const l1PublicClient = createPublicClient({ transport: http(l1Rpc) });
  const l1WalletClient = createWalletClient({ account: l1Account, transport: http(l1Rpc) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());
  console.log(`[${operationId}] L1 chainId=${l1ChainId} rpc=${l1Rpc}`);

  const { L1Warptoad, gigaBridge, L1Adapter, l1WarpToadAddress, l1AdapterAddress } =
    loadL1Contracts(l1ChainId, l1PublicClient as any, l1WalletClient as any, isAztec);

  const localRootProviders: Address[] = [l1WarpToadAddress, l1AdapterAddress];
  const payableLocalRootProviders: Address[] = await getPayableGigaRootRecipients(l1ChainId);

  // ----- L2 leg: Aztec or Scroll EVM -----
  let l2ChainId: bigint = 0n;
  let L2Adapter: any;
  let L2WarpToad: any;
  let aztecNode: any;
  let aztecPXE: any;
  let aztecWallet: any;
  let sponsoredPaymentMethod: any;

  if (isAztec) {
    console.log(`[${operationId}] acquiring Aztec wallet for ${l2Rpc}`);
    const cached = await getOrCreateAztecWallet(l1ChainId, l2Rpc);
    aztecNode = cached.node;
    aztecWallet = cached.wallet;
    sponsoredPaymentMethod = cached.sponsoredPaymentMethod;
    aztecPXE = cached.pxe;

    // Reconstruct on-chain Aztec contract handles from saved metadata. Cheap
    // (no on-chain calls), safe to repeat per bridge run.
    const { aztecWarpToad, aztecBridgeAdapter } = await reconstructAztecContracts(
      l1ChainId,
      aztecWallet,
    );
    L2WarpToad = aztecWarpToad;
    L2Adapter = aztecBridgeAdapter;
  } else {
    // Scroll EVM L2: same private key, different RPC.
    const l2Account = privateKeyToAccount(privateKey as Hex);
    const l2PublicClient = createPublicClient({ transport: http(l2Rpc) });
    const l2WalletClient = createWalletClient({ account: l2Account, transport: http(l2Rpc) });
    l2ChainId = BigInt(await l2PublicClient.getChainId());
    console.log(`[${operationId}] L2 (Scroll) chainId=${l2ChainId} rpc=${l2Rpc}`);

    const scrollHandles = loadScrollContracts(
      l2ChainId,
      l2PublicClient as any,
      l2WalletClient as any,
    );
    L2WarpToad = scrollHandles.L2WarpToad;
    L2Adapter = scrollHandles.L2Adapter;
  }

  // ----- Run the bridging orchestration -----
  console.log(`[${operationId}] running bridgeBetweenL1AndL2...`);
  const result = await bridgeBetweenL1AndL2(
    l1PublicClient as any,
    l1WalletClient as any,
    L1Adapter,
    gigaBridge,
    L2Adapter,
    L2WarpToad,
    localRootProviders,
    payableLocalRootProviders,
    {
      isAztec,
      PXE: aztecPXE,
      sponsoredPaymentMethod,
      aztecNode,
      aztecWallet: isAztec ? aztecWallet : undefined,
    },
  );

  console.log(`[${operationId}] bridge complete:`, result.txHashes);

  return {
    sendRootToL1TxHash: result.txHashes.sendRootToL1TxHash,
    updateGigaRootTxHash: result.txHashes.gigaRootUpdateTxHash,
    sendGigaRootTxHash: result.txHashes.sendGigaRootTxHash,
  };
}
