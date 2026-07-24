/**
 * One-shot manual push of a ZK Stack L2 local root to L1.
 *
 * WHY: the keeper's Era L2->L1 push (sentLocalRootToL1) had been failing on a transient
 * -32603 from the public Era RPC, leaving the burn's local root unanchored on L1 and
 * every Era withdraw stuck on "Could not find a gigaRoot containing your commitment".
 * This sends that tx by hand over the same estimate-once-with-retry + explicit-gas path
 * as the fixed keeper, then hands the result to the running keeper by writing bridge-sync's
 * zkstack-pending.json - so the keeper's next Era cycle resumes at the proof poll instead
 * of starting a second multi-hour finalization clock.
 *
 * MODES:
 *   (default)  send on L2, persist for the keeper, exit. The keeper finishes the
 *              finalization + L1 proof submit.
 *   --wait     stay in-process through finalization + the L1 proof submit (~2h on Era
 *              Sepolia). Resumable via the same pending file if it dies.
 *
 * RUN IT WHERE THE KEEPER'S DB VOLUME IS, so the pending file lands in the shared volume:
 *   docker compose exec bridge-sync tsx scripts/pushEraRoot.ts
 *   docker compose exec bridge-sync tsx scripts/pushEraRoot.ts --wait
 *
 * ENV (same as the keeper): EVM_PRIVATE_KEY, SYNC_L1_CHAIN_ID (default 11155111),
 * DEFAULT_CONFIRMATIONS (default 3), and the leg's RPC (L2_RPC_URL_300 / the backend Era
 * env, else the public default). A keyed Era URL configured for the keeper is used here
 * automatically.
 *
 * ARGS:
 *   --leg <key>   which ZK Stack leg to push (default 300 = Era Sepolia)
 *   --wait        run the full leg in-process instead of handing off to the keeper
 */
import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rpcTransport } from '../src/bridge/rpcTransport.js';
import { getLeg, legRpcUrl, type LegKey } from '../src/bridge/legRegistry.js';
import { loadZkStackContracts, loadL1AdapterForLeg } from '../src/bridge/contractLoader.js';
import { getChainConfig } from '../src/bridge/chainMapper.js';
import {
  loadPending as loadZkStackPending,
  savePending as saveZkStackPending,
} from '../src/bridge/zkStackPending.js';
// @ts-ignore - resolved to .ts at runtime via tsx, see executor.ts header
import { sendZkStackLocalRootToL1, bridgeEVMLocalRootToL1 } from '../../backend/lib/bridging.js';

dotenv.config();

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

const hostOf = (url: string): string => {
  try {
    return new URL(url.split(',')[0].trim()).host;
  } catch {
    return '<l2>';
  }
};

async function main() {
  const legKey: LegKey = argValue('leg') ?? '300';
  const wait = hasFlag('wait');

  const pk = process.env.EVM_PRIVATE_KEY;
  if (!pk) throw new Error('EVM_PRIVATE_KEY is required (the same key the keeper uses)');
  const confirmations = parseInt(process.env.DEFAULT_CONFIRMATIONS || '3');

  const leg = getLeg(legKey);
  if (leg.kind !== 'zkstack') throw new Error(`leg '${legKey}' is not a ZK Stack leg`);

  const account = privateKeyToAccount(pk as Hex);

  // L1 (Sepolia): used to derive the exact l1ChainId the keeper keys its pending file by,
  // and - in --wait mode - to submit the inclusion proof.
  const l1ChainIdStr = process.env.SYNC_L1_CHAIN_ID || '11155111';
  const l1Cfg = getChainConfig(l1ChainIdStr);
  const l1PublicClient = createPublicClient({ transport: rpcTransport(l1Cfg.rpcUrl) });
  const l1WalletClient = createWalletClient({ account, transport: rpcTransport(l1Cfg.rpcUrl) });
  const l1ChainId = BigInt(await l1PublicClient.getChainId());

  // L2 (the ZK Stack chain).
  const l2Rpc = legRpcUrl(leg);
  const l2PublicClient = createPublicClient({ transport: rpcTransport(l2Rpc) });
  const l2WalletClient = createWalletClient({ account, transport: rpcTransport(l2Rpc) });
  const onChain = BigInt(await l2PublicClient.getChainId());
  if (onChain !== leg.chainId) {
    throw new Error(`leg '${legKey}' RPC reports chainId ${onChain}, expected ${leg.chainId}`);
  }
  const { L2Adapter } = loadZkStackContracts(onChain, l2PublicClient as any, l2WalletClient as any);

  console.log(
    `[push] leg=${leg.label} (${legKey})  L1=${l1ChainId}  L2=${hostOf(l2Rpc)}  signer=${account.address}`,
  );

  const existing = loadZkStackPending(l1ChainId, legKey);

  if (wait) {
    // Full leg, in-process: send (or resume) -> finalization -> proof -> L1 submit.
    const l1Adapter = loadL1AdapterForLeg(l1ChainId, l1PublicClient as any, l1WalletClient as any, legKey);
    const resumeFrom = existing ? { l2TxHashHex: existing.l2TxHashHex as Hex } : undefined;
    console.log(
      `[push] --wait: running the full leg in-process` +
        `${resumeFrom ? ` (resuming from L2 tx ${resumeFrom.l2TxHashHex})` : ''}. ` +
        `Finalization can take ~2h on Era Sepolia; safe to Ctrl-C, the pending file lets a re-run or the keeper resume.`,
    );
    const { sendRootToL1TxHash } = await bridgeEVMLocalRootToL1(
      l1PublicClient as any,
      l1WalletClient as any,
      l2PublicClient as any,
      l2WalletClient as any,
      L2Adapter,
      l1Adapter.address,
      confirmations,
      resumeFrom,
      async (sent: { l2TxHashHex: Hex }) =>
        saveZkStackPending(l1ChainId, legKey, { ...sent, createdAtMs: Date.now() }),
    );
    console.log(`[push] DONE. local root anchored on L1 at tx ${sendRootToL1TxHash}`);
    return;
  }

  // Default: don't stack a second send on top of one already in flight.
  if (existing) {
    console.log(`[push] a push is already pending for this leg: L2 tx ${existing.l2TxHashHex}`);
    console.log(`[push] the keeper will resume from it. Delete that key from zkstack-pending.json to force a fresh send.`);
    return;
  }

  // Send on L2 now, persist for the keeper, exit.
  const l2TxHash = await sendZkStackLocalRootToL1(
    l2PublicClient as any,
    l2WalletClient as any,
    L2Adapter,
    confirmations,
  );
  saveZkStackPending(l1ChainId, legKey, { l2TxHashHex: l2TxHash, createdAtMs: Date.now() });

  console.log('');
  console.log(`[push] SENT. L2 tx: ${l2TxHash}`);
  console.log(`[push] persisted to zkstack-pending.json (key ${l1ChainId}:${legKey}).`);
  console.log('[push] the running keeper resumes from this tx on its next Era cycle:');
  console.log('[push]   finalization (~30min-3h on Era) -> inclusion proof -> getNewRootFromL2 on L1 -> fold -> Aztec dispatch.');
  console.log('[push] watch: docker compose logs -f bridge-sync');
}

main().catch((e: any) => {
  console.error('[push] failed:', e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
