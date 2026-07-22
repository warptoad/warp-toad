import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
    type Address,
    type Hex,
    type PublicClient,
    type WalletClient,
    encodeAbiParameters,
    getContract,
    parseEventLogs,
    toHex,
} from "viem";

import { L2AztecBridgeAdapterContract } from '../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { WarpToadCoreContract as L2WarpToadAZTEC } from '../aztec/WarpToadCore/src/artifacts/WarpToadCore';
import {
    ZK_STACK_BRIDGEHUB_MAINNET,
    ZK_STACK_BRIDGEHUB_SEPOLIA,
    ZK_STACK_CHAINS,
} from './constants';

// Loose viem contract-handle types. Test path builds these via `getContract`.
type WarpToadEvm = any;
type L1AztecBridgeAdapter = any;
type L1ZkStackBridgeAdapter = any;
type L2ZkStackBridgeAdapter = any;
type L2WarpToadEVM = any;
type GigaBridge = any;
type USDcoin = any;

import { PXE } from "@aztec/pxe/server";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { Fr } from "@aztec/aztec.js/fields";
import { Contract } from "@aztec/aztec.js/contracts";

import { AztecNode } from "@aztec/aztec.js/node";
import { Wallet as AztecWallet } from "@aztec/aztec.js/wallet";
import { SiblingPath } from "@aztec/foundation/trees";

import {
    type L2ToL1MembershipWitness,
} from '@aztec/stdlib/messaging';
import { TxHash } from "@aztec/stdlib/tx";
import type { BlockNumber } from "@aztec/foundation/branded-types";

// Minimal ABIs for ad-hoc viem reads against contracts we don't have full handles for.
const LOCAL_ROOT_PROVIDER_ABI = [
    { type: "function", name: "mostRecentL2Root", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "mostRecentL2RootBlockNumber", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ROLLUP_EPOCH_ABI = [
    { type: "function", name: "getEpochDuration", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const OUTBOX_ABI = [
    { type: "function", name: "getRootData", stateMutability: "view", inputs: [{ name: "_epoch", type: "uint256" }, { name: "_numCheckpointsInEpoch", type: "uint256" }], outputs: [{ name: "root", type: "bytes32" }] },
] as const;

// L1 entrypoint on our own adapter. Permissionless: the inclusion proof is the auth.
const L1_ZKSTACK_ADAPTER_ABI = [
    {
        type: "function",
        name: "getNewRootFromL2",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_batchNumber", type: "uint256" },
            { name: "_index", type: "uint256" },
            { name: "_txNumberInBatch", type: "uint16" },
            { name: "_message", type: "bytes" },
            { name: "_proof", type: "bytes32[]" },
        ],
        outputs: [],
    },
    { type: "function", name: "l2ChainId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const BRIDGEHUB_ABI = [
    { type: "function", name: "getZKChain", stateMutability: "view", inputs: [{ name: "_chainId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

// Getters facet on the per-chain diamond. Used only for progress reporting while
// waiting; the proof itself comes from zks_getL2ToL1LogProof.
const ZK_CHAIN_GETTERS_ABI = [
    { type: "function", name: "getTotalBatchesExecuted", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const NEW_GIGA_ROOT_EVENT = {
    type: "event",
    name: "NewGigaRoot",
    inputs: [{ name: "gigaRoot", type: "uint256", indexed: true }],
} as const;

const SENT_LOCAL_ROOT_EVENT = {
    type: "event",
    name: "SentLocalRootToL1",
    inputs: [
        { name: "localRoot", type: "uint256", indexed: true },
        { name: "l2BlockNumber", type: "uint256", indexed: false },
    ],
} as const;

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type L1Adapter = L1AztecBridgeAdapter | L1ZkStackBridgeAdapter;
export type L2Adapter = L2ZkStackBridgeAdapter | L2AztecBridgeAdapterContract
export type L2WarpToad = L2WarpToadAZTEC | L2WarpToadEVM

function loadEvmDeployedAddresses(chainId: bigint): Record<string, string> {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = path.dirname(thisFile);
    const file = path.resolve(thisDir, '..', 'deploy', 'ignition', 'deployments', `chain-${chainId.toString()}`, 'deployed_addresses.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
}

/**
 * Addresses of the L1 adapter slots that a ZK Stack chain has actually claimed.
 *
 * Deliberately driven by ZK_STACK_CHAINS rather than by what's in
 * deployed_addresses.json: L1Infra deploys ZK_STACK_ADAPTER_SLOTS adapters, but the
 * unclaimed spares are uninitialized and REVERT on getLocalRootAndBlock(). Including
 * one would break every GigaBridge.updateGigaRoot call.
 */
function claimedZkStackAdapters(addrs: Record<string, string>): Address[] {
    const result: Address[] = [];
    for (const { slot } of ZK_STACK_CHAINS) {
        const addr = addrs[`L1InfraModule#L1ZkStackBridgeAdapter_${slot}`];
        if (addr) result.push(addr as Address);
    }
    return result;
}

export async function getLocalRootProviders(chainId: bigint): Promise<Address[]> {
    const addrs = loadEvmDeployedAddresses(chainId);
    const result: Address[] = [];
    const l1WarpToad = addrs['L1InfraModule#L1WarpToad'] || addrs['L1WarpToadModule#L1WarpToad'];
    const l1AztecAdapter = addrs['L1InfraModule#L1AztecBridgeAdapter'];
    if (l1WarpToad) result.push(l1WarpToad as Address);
    if (l1AztecAdapter) result.push(l1AztecAdapter as Address);
    result.push(...claimedZkStackAdapters(addrs));
    return result;
}

export async function getPayableGigaRootRecipients(chainId: bigint): Promise<Address[]> {
    // ZK Stack adapters need msg.value to cover the Bridgehub base cost of the
    // L1->L2 message. The Aztec adapter and L1WarpToad don't.
    return claimedZkStackAdapters(loadEvmDeployedAddresses(chainId));
}

/** Shape returned by the ZK Stack `zks_getL2ToL1LogProof` RPC. */
interface ZkStackLogProof {
    id: number;
    proof: Hex[];
    root: Hex;
}

/** Everything L1ZkStackBridgeAdapter.getNewRootFromL2 needs. */
export interface ZkStackClaimData {
    batchNumber: bigint;
    index: bigint;
    txNumberInBatch: number;
    message: Hex;
    proof: Hex[];
}

/** Raw JSON-RPC against an L2, for the zks_* namespace viem doesn't model. */
async function zkStackRpc(l2PublicClient: PublicClient, method: string, params: any[]): Promise<any> {
    return await l2PublicClient.request({ method, params } as any);
}

/**
 * Resolve a ZK Stack chain's diamond via the shared Bridgehub, so nothing here is
 * hardcoded per chain. Used only for progress reporting.
 */
async function getZkChainDiamond(
    l1PublicClient: PublicClient,
    l2ChainId: bigint,
): Promise<Address | undefined> {
    const l1ChainId = BigInt(await l1PublicClient.getChainId());
    const bridgehub = (l1ChainId === 1n ? ZK_STACK_BRIDGEHUB_MAINNET : ZK_STACK_BRIDGEHUB_SEPOLIA) as Address;
    try {
        return await l1PublicClient.readContract({
            address: bridgehub, abi: BRIDGEHUB_ABI, functionName: 'getZKChain', args: [l2ChainId],
        }) as Address;
    } catch {
        return undefined;
    }
}

/**
 * Poll until an L2→L1 message is provable on L1, then return the proof bundle.
 *
 * Unlike Scroll there is no HTTP bridge API: this is pure JSON-RPC. Two distinct
 * waits are folded together here, and they fail differently, so both are reported:
 *   1. the L2 tx has no `l1BatchNumber` yet (batch not sealed)
 *   2. the batch is sealed but not yet committed+proven+executed on L1, so
 *      `zks_getL2ToL1LogProof` still returns null
 *
 * Measured on Era Sepolia 2026-07-20: 116 minutes end to end (2h batch window plus
 * ~30 min to execute). Abstract seals on timeout at ~7h47m per batch, so callers must
 * not assume a single timeout fits every ZK Stack chain.
 */
export async function getZkStackClaimData(
    l1PublicClient: PublicClient,
    l2PublicClient: PublicClient,
    l2TxHash: Hex,
    pollIntervalMs: number = 60_000,
): Promise<ZkStackClaimData> {
    const startedAt = Date.now();
    const l2ChainId = BigInt(await l2PublicClient.getChainId());
    const diamond = await getZkChainDiamond(l1PublicClient, l2ChainId);

    while (true) {
        const mins = Math.round((Date.now() - startedAt) / 60_000);
        const receipt = await l2PublicClient.getTransactionReceipt({ hash: l2TxHash }) as any;
        const batchNumber = receipt?.l1BatchNumber != null ? BigInt(receipt.l1BatchNumber) : null;
        const txNumberInBatch = receipt?.l1BatchTxIndex != null ? Number(BigInt(receipt.l1BatchTxIndex)) : null;

        if (batchNumber === null || txNumberInBatch === null) {
            console.log(`[zkstack] batch not assigned to ${l2TxHash} yet (${mins}m elapsed)`);
        } else {
            // zks_getL2ToL1LogProof is the gate. The executed-batch read below is only
            // to make the wait legible in logs, so a failure there must not abort.
            const logProof = await zkStackRpc(
                l2PublicClient, 'zks_getL2ToL1LogProof', [l2TxHash, 0],
            ) as ZkStackLogProof | null;

            if (logProof) {
                const claim: ZkStackClaimData = {
                    batchNumber,
                    index: BigInt(logProof.id),
                    txNumberInBatch,
                    // sendToL1's payload is not in the proof response; it's the
                    // abi.encode(root, blockNumber) the L2 adapter emitted.
                    message: '0x' as Hex,
                    proof: logProof.proof,
                };
                console.log(`[zkstack] proof ready after ${mins}m: batch=${batchNumber} index=${claim.index} txNumberInBatch=${txNumberInBatch} proofLen=${logProof.proof.length}`);
                return claim;
            }

            let progress = '';
            if (diamond) {
                try {
                    const executed = await l1PublicClient.readContract({
                        address: diamond, abi: ZK_CHAIN_GETTERS_ABI, functionName: 'getTotalBatchesExecuted',
                    }) as bigint;
                    progress = executed < batchNumber
                        ? ` (executed=${executed}, ${batchNumber - executed} to go)`
                        : ' (batch executed, proof endpoint lagging)';
                } catch { /* progress reporting only */ }
            }
            console.log(`[zkstack] batch ${batchNumber} not provable yet${progress}, ${mins}m elapsed`);
        }
        await sleep(pollIntervalMs);
    }
}

/**
 * Submit the inclusion proof to our L1 adapter, which verifies it against the
 * Bridgehub and adopts the local root.
 *
 * Note this is NOT a "claim" in the Scroll sense: no message is being relayed and
 * nothing gets executed on L1 as a result. The adapter re-derives the root by decoding
 * the proven message itself.
 */
export async function submitZkStackRootProof(
    l1PublicClient: PublicClient,
    l1WalletClient: WalletClient,
    l1Adapter: Address,
    claim: ZkStackClaimData,
    confirmations = 1,
) {
    const args = [claim.batchNumber, claim.index, claim.txNumberInBatch, claim.message, claim.proof] as const;

    // Surface a bad proof as a clean revert reason instead of an opaque out-of-gas.
    await l1PublicClient.simulateContract({
        address: l1Adapter, abi: L1_ZKSTACK_ADAPTER_ABI, functionName: 'getNewRootFromL2',
        args, account: l1WalletClient.account!,
    });

    const hash = await l1WalletClient.writeContract({
        address: l1Adapter,
        abi: L1_ZKSTACK_ADAPTER_ABI,
        functionName: 'getNewRootFromL2',
        args,
        account: l1WalletClient.account!,
        chain: l1WalletClient.chain!,
    });
    const tx = await l1PublicClient.waitForTransactionReceipt({ hash, confirmations });
    return { tx, hash };
}

/**
 * Optional resume state for a previously-sent ZK Stack L2→L1 root message. If
 * supplied, `bridgeEVMLocalRootToL1` skips the L2 send and picks up at the proof
 * poll. Used by bridge-sync to survive container restarts during the multi-hour
 * batch finalization wait.
 *
 * Only the tx hash is persisted: the sendToL1 payload isn't recoverable from the proof
 * RPC, but it is recoverable from the SentLocalRootToL1 event on the same tx, so
 * `readZkStackRootMessage` rebuilds it rather than making callers store it.
 */
export interface ZkStackRootSendResume {
    l2TxHashHex: Hex;
}

/**
 * Rebuild the exact bytes the L2 adapter passed to sendToL1, from its own event.
 *
 * Must stay byte-identical to `abi.encode(_l2Root, _l2BlockNumber)` in
 * L2ZkStackBridgeAdapter.sentLocalRootToL1 - the L1 side length-checks it at 64 bytes
 * and the inclusion proof covers it, so any drift fails to verify rather than
 * corrupting anything.
 */
export async function readZkStackRootMessage(
    l2PublicClient: PublicClient,
    l2TxHash: Hex,
): Promise<Hex> {
    const receipt = await l2PublicClient.getTransactionReceipt({ hash: l2TxHash });
    const events = parseEventLogs({
        abi: [SENT_LOCAL_ROOT_EVENT], logs: receipt.logs, eventName: 'SentLocalRootToL1',
    }) as any[];
    if (events.length === 0) {
        throw new Error(`readZkStackRootMessage: no SentLocalRootToL1 event in L2 tx ${l2TxHash}`);
    }
    const { localRoot, l2BlockNumber } = events[0].args;
    return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }],
        [BigInt(localRoot), BigInt(l2BlockNumber)],
    );
}

/** Invoked right after a fresh `sentLocalRootToL1` tx is mined on the L2, so
 * the caller can persist the tx hash before the long poll begins. */
export type OnZkStackRootSent = (state: ZkStackRootSendResume) => void | Promise<void>;

/**
 * Publish the L2 local root and land it on L1.
 *
 * The ZK Stack L2→L1 direction is PULL: sendToL1 records an opaque blob and nothing
 * ever calls L1. So this sends on L2, waits for the batch to be executed, fetches the
 * Merkle proof, and submits it to our own L1 adapter.
 *
 * @param l1Adapter address of the L1ZkStackBridgeAdapter slot paired with this L2.
 *                  Must be the slot whose l2ChainId matches, or the proof verifies
 *                  against the wrong chain and reverts.
 */
export async function bridgeEVMLocalRootToL1(
    l1PublicClient: PublicClient,
    l1WalletClient: WalletClient,
    l2PublicClient: PublicClient,
    l2WalletClient: WalletClient,
    L2Adapter: L2ZkStackBridgeAdapter,
    l1Adapter: Address,
    confirmations = 3,
    resumeFrom?: ZkStackRootSendResume,
    onSent?: OnZkStackRootSent,
) {
    const l2ChainId = BigInt(await l2PublicClient.getChainId());

    // Catch a mispaired adapter now, not two hours from now when the proof lands.
    const adapterChainId = await l1PublicClient.readContract({
        address: l1Adapter, abi: L1_ZKSTACK_ADAPTER_ABI, functionName: 'l2ChainId',
    }) as bigint;
    if (adapterChainId !== l2ChainId) {
        throw new Error(
            `bridgeEVMLocalRootToL1: L1 adapter ${l1Adapter} is bound to chain ${adapterChainId}, but the L2 client is chain ${l2ChainId}`,
        );
    }

    let l2TxHash: Hex;
    if (resumeFrom) {
        l2TxHash = resumeFrom.l2TxHashHex;
        console.log(`[zkstack] resuming from previously-sent L2 tx ${l2TxHash}`);
    } else {
        const sentHash = await L2Adapter.write.sentLocalRootToL1([], {
            account: l2WalletClient.account,
            chain: l2WalletClient.chain,
        });
        const L2ToL1Tx = await l2PublicClient.waitForTransactionReceipt({ hash: sentHash, confirmations });
        l2TxHash = L2ToL1Tx.transactionHash;
        console.log(`[zkstack] local root sent to L1 at L2 tx ${l2TxHash}; waiting for batch finalization...`);
        if (onSent) {
            // Persist BEFORE the multi-hour poll so a crash between here and
            // finalization is recoverable. Best-effort: a callback that throws is
            // logged but doesn't block the leg.
            try {
                await onSent({ l2TxHashHex: l2TxHash });
            } catch (e) {
                console.warn('[zkstack] onSent callback threw:', e);
            }
        }
    }

    const message = await readZkStackRootMessage(l2PublicClient, l2TxHash);
    const claim = await getZkStackClaimData(l1PublicClient, l2PublicClient, l2TxHash);
    console.log(`[zkstack] submitting inclusion proof to L1 adapter ${l1Adapter}`);
    const { tx } = await submitZkStackRootProof(
        l1PublicClient, l1WalletClient, l1Adapter, { ...claim, message }, confirmations,
    );
    return { sendRootToL1Tx: tx, sendRootToL1TxHash: tx.transactionHash };
}

export async function receiveGigaRootOnEvmL2(
    l2PublicClient: PublicClient,
    L2Adapter: L2ZkStackBridgeAdapter,
    gigaRootSent: bigint,
    startBlock?: bigint,
    chunkSize: bigint = 500n,
    pollIntervalMs: number = 60_000,
): Promise<{ receiveGigaRootTxHash: Hex; blockNumber: bigint }> {
    const currentBlock = await l2PublicClient.getBlockNumber();
    let scanStart = startBlock ?? (currentBlock > 100n ? currentBlock - 100n : 0n);
    let scanEnd = currentBlock;
    while (true) {
        let from = scanStart;
        while (from <= scanEnd) {
            const to = from + chunkSize - 1n > scanEnd ? scanEnd : from + chunkSize - 1n;
            const logs = await l2PublicClient.getLogs({
                address: L2Adapter.address as Address,
                event: NEW_GIGA_ROOT_EVENT,
                args: { gigaRoot: gigaRootSent },
                fromBlock: from,
                toBlock: to,
            });
            if (logs.length > 0) {
                console.log(`[zkstack] NewGigaRoot(${gigaRootSent}) observed at block ${logs[0].blockNumber}`);
                return {
                    receiveGigaRootTxHash: logs[0].transactionHash as Hex,
                    blockNumber: logs[0].blockNumber as bigint,
                };
            }
            from = to + 1n;
        }
        console.log(`[zkstack] waiting for NewGigaRoot(${gigaRootSent}) on L2 (scanned ${scanStart}-${scanEnd})`);
        await sleep(pollIntervalMs);
        scanStart = scanEnd + 1n;
        scanEnd = await l2PublicClient.getBlockNumber();
    }
}

/**
 * bridges noteHashTreeRoot from aztec L2 to L1
 * L2aztecAdapter -> L1AztecAdapter
 */
/**
 * Optional resume state for a previously-sent L2→L1 root message. If supplied,
 * `bridgeAZTECLocalRootToL1` skips the send step and picks up at the epoch
 * scan. Used by bridge-sync to survive container restarts without resetting
 * the 75-min clock.
 */
export interface AztecRootSendResume {
    aztecTxHashHex: string;
    blockNumberOfRoot: number;
    pxeL2RootHex: string;
}

/** Invoked right after a fresh `send_root_to_l1` call goes out on Aztec, so
 * the caller can persist the tx hash + anchor block before we start waiting.
 * Safe to leave undefined for callers that don't care about resumption. */
export type OnAztecRootSent = (state: AztecRootSendResume) => void | Promise<void>;

export async function bridgeAZTECLocalRootToL1(
    aztecNode: AztecNode,
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    publicClient: PublicClient,
    walletClient: WalletClient,
    aztecWallet: AztecWallet,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined,
    confirmations = 1,
    resumeFrom?: AztecRootSendResume,
    onSent?: OnAztecRootSent,
) {
    const l1ChainId = BigInt(await publicClient.getChainId())
    const isSandBox = l1ChainId === 31337n
    const blocksToWait = isSandBox ? 2 : 10

    // Either resume from a previously-sent tx (picked up off disk after a
    // restart) or send fresh now. After this block we have three locals set:
    // `aztecTxHash`, `blockNumberOfRoot`, `PXE_L2Root` - which is all the
    // downstream code needs.
    let aztecTxHash: TxHash
    let blockNumberOfRoot: number
    let PXE_L2Root: Fr
    // Kept for back-compat with callers that treat this as an opaque tx handle.
    // Undefined on the resume path since we only have the hash at that point.
    let sendRootToL1Tx: any | undefined
    if (resumeFrom) {
        aztecTxHash = TxHash.fromString(resumeFrom.aztecTxHashHex)
        blockNumberOfRoot = resumeFrom.blockNumberOfRoot
        PXE_L2Root = Fr.fromHexString(resumeFrom.pxeL2RootHex)
        sendRootToL1Tx = undefined
        console.log(`resuming aztec L2->L1 leg from tx ${resumeFrom.aztecTxHashHex} @ block ${blockNumberOfRoot}`)
    } else {
        blockNumberOfRoot = await aztecNode.getBlockNumber()
        PXE_L2Root = (await aztecNode.getBlock(blockNumberOfRoot as BlockNumber))?.header.state.partial.noteHashTree.root as Fr
        sendRootToL1Tx = await L2AztecBridgeAdapter.methods.send_root_to_l1(blockNumberOfRoot).send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await aztecWallet.getAccounts())[0].item });
        aztecTxHash = sendRootToL1Tx.receipt.txHash
        if (onSent) {
            // Persist BEFORE the long waits so a crash between here and the
            // outbox settle is recoverable. Best-effort: a callback that
            // throws is logged but doesn't block the leg.
            try {
                await onSent({
                    aztecTxHashHex: aztecTxHash.toString(),
                    blockNumberOfRoot,
                    pxeL2RootHex: PXE_L2Root.toString(),
                })
            } catch (e) {
                console.warn('onSent callback threw:', e)
            }
        }
        await waitForBlocksAztec(blocksToWait, aztecNode, isSandBox, L2AztecBridgeAdapter, aztecWallet, sponsoredPaymentMethod)
    }

    const sendRootEffect = await aztecNode.getTxEffect(aztecTxHash)
    const messageLeaf = sendRootEffect?.data.l2ToL1Msgs[0] as Fr
    if (!messageLeaf) throw new Error(`send_root_to_l1 tx ${aztecTxHash.toString()} has no L2->L1 message in its tx effect`)
    const contentHash = messageLeaf

    // Poll the canonical SDK helper: it takes (node, messageHash, txHash),
    // walks the tx's epoch itself, and returns the full witness (including
    // epochNumber/leafIndex/siblingPath) once the epoch is proven. Returns
    // undefined while the tx isn't yet in a proven epoch.
    //
    // Earlier versions of this file tried to compute the epoch from slot math
    // and call `computeL2ToL1MembershipWitnessFromMessagesInEpoch` with too
    // few args - the SDK helper throws, the catch swallows it, and the poll
    // loop spins until the 75-min outer timeout. That's the bug pattern the
    // aztec→L1 cycle kept hitting.
    //
    // Sandbox prover is single-threaded; poll fast (2s) with a smaller ceiling
    // so a broken sandbox fails fast. Testnet polls every 15s for up to 1h -
    // the prover lag observed in production has exceeded 20 min, and slower
    // polling also keeps the RPC budget reasonable.
    const pollIntervalMs = isSandBox ? 2_000 : 15_000
    const maxPolls = isSandBox ? 300 : 240

    // Only used for diagnostic logging of how close the prover is.
    const aztecNodeInfo = await aztecNode.getNodeInfo()
    const rollupAddressForEpoch = aztecNodeInfo.l1ContractAddresses.rollupAddress.toString() as Address
    const epochDuration = BigInt(await publicClient.readContract({
        address: rollupAddressForEpoch,
        abi: ROLLUP_EPOCH_ABI,
        functionName: "getEpochDuration",
    }))

    let messageWitness: L2ToL1MembershipWitness | undefined
    for (let i = 0; i < maxPolls; i++) {
        try {
            messageWitness = (await aztecNode.getL2ToL1MembershipWitness(aztecTxHash, contentHash)) as L2ToL1MembershipWitness | undefined
        } catch (err) {
            // Transient RPC failures (Bad Gateway, etc); log and keep polling.
            if (i % 5 === 0) console.log(`computeL2ToL1MembershipWitness threw (will retry): ${(err as Error).message ?? err}`)
        }
        if (messageWitness) break

        if (i % 5 === 0) {
            let provenEpoch = -1
            try {
                const provenBlockNum = Number(await aztecNode.getBlockNumber('proven'))
                if (provenBlockNum > 0) {
                    const provenBlock = await aztecNode.getBlock(provenBlockNum as BlockNumber)
                    if (provenBlock) provenEpoch = Number(BigInt(provenBlock.header.globalVariables.slotNumber) / epochDuration)
                }
            } catch {}
            console.log(`waiting for L2->L1 message ${contentHash.toString()} to be proven (provenEpoch=${provenEpoch})... (${i}/${maxPolls})`)
        }
        await sleep(pollIntervalMs)
    }
    if (!messageWitness) {
        throw new Error(`Timed out waiting for L2->L1 message ${contentHash.toString()} to land in a proven epoch`)
    }

    const foundEpoch = Number(messageWitness.epochNumber)
    const siblingPathArray = messageWitness.siblingPath.toFields().map((f: any) => f.toString())

    const outboxAddress = (await L1AztecBridgeAdapter.read.outbox()) as Address
    const outboxTimeoutMs = isSandBox ? 5 * 60_000 : 30 * 60_000
    const outboxStart = Date.now()
    while (true) {
        const rootHex = await publicClient.readContract({
            address: outboxAddress,
            abi: OUTBOX_ABI,
            functionName: "getRootData",
            args: [BigInt(foundEpoch), BigInt(messageWitness.numCheckpointsInEpoch)],
        }) as Hex
        if (rootHex && rootHex !== "0x0000000000000000000000000000000000000000000000000000000000000000") break
        if (Date.now() - outboxStart > outboxTimeoutMs) {
            throw new Error(`Timed out waiting for L1 outbox to expose root for epoch ${foundEpoch}`)
        }
        if (Math.round((Date.now() - outboxStart) / 1000) % 10 === 0) {
            console.log(`waiting for L1 outbox to settle epoch ${foundEpoch} (${Math.round((Date.now() - outboxStart) / 1000)}s)`)
        }
        await sleep(isSandBox ? 3_000 : 15_000)
    }

    const args = [
        PXE_L2Root.toString() as Hex,
        BigInt(blockNumberOfRoot),
        BigInt(foundEpoch),
        BigInt(messageWitness.numCheckpointsInEpoch),
        BigInt(messageWitness.leafIndex),
        siblingPathArray.map((s: string) => s as Hex),
    ] as const

    const waitFunc = async () => await waitForBlocksAztec(blocksToWait, aztecNode, isSandBox, L2AztecBridgeAdapter, aztecWallet, sponsoredPaymentMethod)
    await tryUntilItWorks(publicClient, L1AztecBridgeAdapter, "getNewRootFromL2", args as any, waitFunc)
    const refreshRootHash = await L1AztecBridgeAdapter.write.getNewRootFromL2(args, { account: walletClient.account, chain: walletClient.chain })
    const refreshRootTx = await publicClient.waitForTransactionReceipt({ hash: refreshRootHash, confirmations })

    return { refreshRootTx, sendRootToL1Tx, PXE_L2Root, aztecTxHash }
}

export async function bridgeLocalRootToL1(
    publicClient: PublicClient,
    walletClient: WalletClient,
    gigaBridge: GigaBridge,
    L1Adapter: L1Adapter,
    L2Adapter: L2Adapter,
    isAztec?: boolean,
    aztecNode?: AztecNode,
    sponsoredPaymentMethodAZTEC?: SponsoredFeePaymentMethod,
    aztecWallet?: AztecWallet,
    confirmations = 3,
    evmL2Inputs?: { l2PublicClient: PublicClient; l2WalletClient: WalletClient },
) {
    const l1ChainId = BigInt(await publicClient.getChainId())
    const isSandBox = l1ChainId === 31337n
    if (isAztec) {
        if (aztecNode === undefined) throw new Error("aztecNode cant be undefined")
        const { sendRootToL1Tx, refreshRootTx, PXE_L2Root, aztecTxHash } = await bridgeAZTECLocalRootToL1(
            aztecNode,
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            publicClient,
            walletClient,
            aztecWallet as AztecWallet,
            sponsoredPaymentMethodAZTEC,
            confirmations,
        )
        return { sendRootToL1Tx, sendRootToL1TxHash: aztecTxHash.toString() }
    } else {
        if (!evmL2Inputs) throw new Error("bridgeLocalRootToL1: evmL2Inputs (l2PublicClient, l2WalletClient) required for the non-aztec (ZK Stack) path")
        const { sendRootToL1Tx, sendRootToL1TxHash } = await bridgeEVMLocalRootToL1(
            publicClient,
            walletClient,
            evmL2Inputs.l2PublicClient,
            evmL2Inputs.l2WalletClient,
            L2Adapter as L2ZkStackBridgeAdapter,
            (L1Adapter as L1ZkStackBridgeAdapter).address as Address,
            confirmations,
        )
        return { sendRootToL1Tx, sendRootToL1TxHash }
    }
}

export async function updateGigaRoot(
    publicClient: PublicClient,
    walletClient: WalletClient,
    gigaBridge: GigaBridge,
    localRootProviders: Address[],
    confirmations = 1,
) {
    // Skip providers that don't yet have a root.
    const isValidLocalRootProviders = await Promise.all(localRootProviders.map(async (addr) => {
        try {
            const r = await publicClient.readContract({ address: addr, abi: LOCAL_ROOT_PROVIDER_ABI, functionName: "mostRecentL2Root" })
            const b = await publicClient.readContract({ address: addr, abi: LOCAL_ROOT_PROVIDER_ABI, functionName: "mostRecentL2RootBlockNumber" })
            if (r !== 0n && b !== 0n) return true
            console.log(`${addr} has not received a L2 root yet and will be skipped in updating the gigaRoot`)
            return false
        } catch {
            // L1WarpToad doesn't implement the localRootProvider getter; treat as valid.
            return true
        }
    }))
    const validLocalRootProviders = localRootProviders.filter((_, i) => isValidLocalRootProviders[i])
    console.log({ validLocalRootProviders, localRootProviders })
    console.log("---------------gigaBridge.updateGigaRoot-----------------------")
    const hash = await gigaBridge.write.updateGigaRoot([validLocalRootProviders], { account: walletClient.account, chain: walletClient.chain })
    const gigaRootUpdateTx = await publicClient.waitForTransactionReceipt({ hash, confirmations })
    console.log("---------------done---gigaBridge.updateGigaRoot-----------------------")
    return { gigaRootUpdateTx, gigaRootUpdateTxHash: gigaRootUpdateTx.transactionHash }
}

export async function sendGigaRoot(
    publicClient: PublicClient,
    walletClient: WalletClient,
    gigaBridge: GigaBridge,
    gigaRootRecipients: Address[],
    allPayableGigaRootRecipients: Address[],
    confirmations = 1,
) {
    const defaultEthAmountGas = 5n * 10n ** 16n;
    const amounts = gigaRootRecipients.map((v) => allPayableGigaRootRecipients.includes(v) ? defaultEthAmountGas : 0n)
    // Sum over current recipients, not the whole payable set - otherwise pure
    // L1-settle cycles (recipients=[L1WarpToad], payable=[zkStackAdapter]) send
    // 0.05 ETH that sits unused in the GigaBridge contract.
    const totalEth = amounts.reduce((sum, a) => sum + a, 0n)
    console.log({ gigaBridge: gigaBridge.address, gigaRootRecipients, amounts, totalEth, confirmations })

    const hash = await gigaBridge.write.sendGigaRoot([gigaRootRecipients, amounts], {
        value: totalEth,
        account: walletClient.account,
        chain: walletClient.chain,
    })
    const sendGigaRootTx = await publicClient.waitForTransactionReceipt({ hash, confirmations })
    const parsed = parseEventLogs({ abi: gigaBridge.abi, logs: sendGigaRootTx.logs, eventName: "SentGigaRoot" }) as any[]
    const gigaRootSent = BigInt(parsed[0].args.gigaRoot).toString()

    return { sendGigaRootTx, sendGigaRootTxHash: sendGigaRootTx.transactionHash, gigaRootSent }
}

export async function receiveGigaRootOnAztec(
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    AztecWarpToad: L2WarpToadAZTEC,
    publicClient: PublicClient,
    sendGigaRootTx: any, // viem TransactionReceipt
    aztecNode: AztecNode,
    isSandBox?: boolean,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined,
    aztecWallet?: AztecWallet,
) {
    isSandBox = (isSandBox === undefined) ? 31337n === BigInt(await publicClient.getChainId()) : isSandBox
    const parsedL1AdapterEvent = parseEventFromTx(sendGigaRootTx, L1AztecBridgeAdapter, "NewGigaRootSentToAztec")
    const content_hash = parsedL1AdapterEvent!.args.newGigaRoot ?? parsedL1AdapterEvent!.args[0];
    const key = parsedL1AdapterEvent!.args.key ?? parsedL1AdapterEvent!.args[1];
    const index = parsedL1AdapterEvent!.args.index ?? parsedL1AdapterEvent!.args[2];

    const messageHashFr = Fr.fromString(key.toString())
    const timeoutMs = isSandBox ? 10 * 60_000 : 30 * 60_000
    const start = Date.now()
    while (true) {
        const messageCheckpointNumber = await aztecNode.getL1ToL2MessageCheckpoint(messageHashFr)
        if (messageCheckpointNumber !== undefined) {
            const latestBlock = await aztecNode.getBlock("latest")
            if (latestBlock !== undefined && latestBlock.checkpointNumber >= messageCheckpointNumber) break
        }
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for L1->L2 message ${messageHashFr.toString()} to be ready`)
        }
        if (isSandBox && L2AztecBridgeAdapter && aztecWallet) {
            await L2AztecBridgeAdapter.methods.count(0n).send({
                ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {}),
                from: (await (aztecWallet as AztecWallet).getAccounts())[0].item,
            });
        }
        console.log(`waiting for L1->L2 message ${messageHashFr.toString()} to be ready (msgCheckpoint=${messageCheckpointNumber}, ${Math.round((Date.now() - start) / 1000)}s)`)
        await sleep(isSandBox ? 3_000 : 30_000)
    }

    const receiveGigaRootTx = await L2AztecBridgeAdapter.methods
        .receive_giga_root(content_hash, index, AztecWarpToad.address)
        .send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await (aztecWallet as AztecWallet).getAccounts())[0].item });
    return { receiveGigaRootTx }
}

export async function waitForBlocksAztec(blocksToWait: number, aztecNode: AztecNode, isSandBox?: boolean, L2AztecBridgeAdapter?: L2AztecBridgeAdapterContract, aztecWallet?: AztecWallet, sponsoredPaymentMethod?: SponsoredFeePaymentMethod) {
    const L1BlockTime = 12000
    const blockBeforeWaiting = await aztecNode.getBlockNumber()
    const waitTillBlock = blockBeforeWaiting + blocksToWait
    let waiting = true
    while (waiting) {
        const currentBlock = await aztecNode.getBlockNumber()
        waiting = currentBlock < waitTillBlock
        console.log(`waiting ${L1BlockTime / 2 * blocksToWait / 1000} seconds until ${blocksToWait} aztec blocks have passed. blocks passed: ${currentBlock - blockBeforeWaiting}`)
        if (waiting) {
            if (isSandBox) {
                if (L2AztecBridgeAdapter && aztecWallet) {
                    await L2AztecBridgeAdapter.methods.count(0n).send({
                        ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {}),
                        from: (await (aztecWallet as AztecWallet).getAccounts())[0].item,
                    });
                } else {
                    throw new Error("L2AztecBridgeAdapter and/or aztecWallet is not set but isSandBox=true")
                }
            } else {
                await new Promise((resolve) => setTimeout(resolve, L1BlockTime / 2 * blocksToWait))
            }
        }
    }
}

/**
 * Poll a viem contract simulate until it stops reverting. Used to wait for
 * async message-bridge preconditions to settle before doing the actual write.
 */
export async function tryUntilItWorks(publicClient: PublicClient, contract: any, funcName: string, funcArgs: any[], waitFunc: any): Promise<void> {
    let works = false
    while (works === false) {
        try {
            await contract.simulate[funcName](funcArgs)
            works = true
        } catch {
            await waitFunc()
        }
    }
}

export function parseEventFromTx(tx: any, contract: any, eventName: string): any {
    const parsed = parseEventLogs({ abi: contract.abi, logs: tx.logs, eventName }) as any[]
    return parsed[0]
}

export function parseMultipleEventsFromTx(tx: any, contract: any, eventName: string): any[] {
    return parseEventLogs({ abi: contract.abi, logs: tx.logs, eventName }) as any[]
}

export async function receiveGigaRootOnL2(
    L1Adapter: L1Adapter,
    L2Adapter: L2Adapter,
    L2WarpToad: L2WarpToad,
    publicClient: PublicClient,
    sendGigaRootTx: any,
    gigaRootSent?: bigint,
    isAztec?: boolean,
    aztecWallet?: AztecWallet,
    isSandBox?: boolean,
    aztecNode?: AztecNode,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod,
    evmL2Inputs?: { l2PublicClient: PublicClient },
) {
    if (isAztec) {
        if (aztecNode === undefined) throw new Error("isSandBox cant be undefined")
        const { receiveGigaRootTx } = await receiveGigaRootOnAztec(
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            L2WarpToad as L2WarpToadAZTEC,
            publicClient,
            sendGigaRootTx,
            aztecNode,
            isSandBox,
            sponsoredPaymentMethod,
            aztecWallet,
        )
        const gigaRootOnAztecResult = await (L2WarpToad as L2WarpToadAZTEC)?.methods.get_giga_root().simulate({ from: (await (aztecWallet as AztecWallet).getAccounts())[0].item })
        const gigaRootOnAztec = (gigaRootOnAztecResult as any)?.result ?? gigaRootOnAztecResult
        return { receiveGigaRootTx, receiveGigaRootTxHash: receiveGigaRootTx!.receipt.txHash.toString(), gigaRootOnL2: gigaRootOnAztec }
    } else {
        if (gigaRootSent === undefined) {
            // ZK Stack L1->L2 auto-executes off the priority queue, so there is
            // nothing to relay; we just have no root to watch for.
            console.log(`[zkstack] no gigaRootSent provided; skipping L2 arrival wait`);
            return { receiveGigaRootTx: undefined, receiveGigaRootTxHash: undefined, gigaRootOnL2: undefined };
        }
        if (!evmL2Inputs) throw new Error("receiveGigaRootOnL2: evmL2Inputs (l2PublicClient) required for the non-aztec (ZK Stack) path");
        const { receiveGigaRootTxHash } = await receiveGigaRootOnEvmL2(
            evmL2Inputs.l2PublicClient,
            L2Adapter as L2ZkStackBridgeAdapter,
            gigaRootSent,
        );
        return { receiveGigaRootTx: undefined, receiveGigaRootTxHash, gigaRootOnL2: gigaRootSent };
    }
}

/**
 * Bridges L1 <-> L2
 */
export async function bridgeBetweenL1AndL2(
    publicClient: PublicClient,
    walletClient: WalletClient,
    L1Adapter: L1Adapter,
    gigaBridge: GigaBridge,
    L2Adapter: L2Adapter,
    L2WarpToad: L2WarpToad,
    localRootProviders: Address[],
    payableLocalRootProviders: Address[],
    aztecInputs?: {
        isAztec?: boolean,
        aztecNode?: AztecNode,
        sponsoredPaymentMethod?: SponsoredFeePaymentMethod,
        aztecWallet?: AztecWallet,
        PXE?: PXE,
    },
    evmL2Inputs?: { l2PublicClient: PublicClient; l2WalletClient: WalletClient },
) {
    const l1ChainId = BigInt(await publicClient.getChainId())
    const isSandBox = l1ChainId === 31337n
    const confirmations = isSandBox ? 1 : 3
    if (aztecInputs && aztecInputs.isAztec && (aztecInputs.aztecNode === undefined)) {
        throw new Error(`aztecInputs.aztecNode needs to be set when isAztec = true`)
    }
    if (aztecInputs === undefined) aztecInputs = {}
    if (!aztecInputs.isAztec && !evmL2Inputs) {
        throw new Error("bridgeBetweenL1AndL2: evmL2Inputs required when isAztec=false")
    }

    const l1ChainIdStr = l1ChainId.toString()
    console.log(`\n--------- starting a L1 <-> L2 bridge on ${l1ChainIdStr} ---------------------\n`)

    console.log("\n-------------- bridging local root from L2 -> L1 --------------\n")
    const { sendRootToL1Tx, sendRootToL1TxHash } = await bridgeLocalRootToL1(
        publicClient,
        walletClient,
        gigaBridge,
        L1Adapter,
        L2Adapter,
        aztecInputs.isAztec,
        aztecInputs.aztecNode,
        aztecInputs.sponsoredPaymentMethod,
        aztecInputs.aztecWallet,
        confirmations,
        evmL2Inputs,
    )
    console.log(`local root is bridged to L1! At tx hash: ${sendRootToL1TxHash}`)

    console.log(`\n--------- updating the giga root on L1 -----------------------\n`)
    const { gigaRootUpdateTx, gigaRootUpdateTxHash } = await updateGigaRoot(
        publicClient,
        walletClient,
        gigaBridge,
        localRootProviders,
        confirmations,
    )
    console.log(`GigaRoot is updated! At tx hash: ${gigaRootUpdateTxHash}`)

    console.log(`\n---------- initiating gigaRoot bridging to the L2's ---------------\n`)
    const { sendGigaRootTx, sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
        publicClient,
        walletClient,
        gigaBridge,
        localRootProviders,
        payableLocalRootProviders,
        confirmations,
    )
    console.log(`gigaRoot bridging is initiated! At tx hash: ${sendGigaRootTxHash}`)

    console.log(`\n-------- completing arrival of the gigaRoot on L2 ----------\n`)
    const { receiveGigaRootTx, receiveGigaRootTxHash } = await receiveGigaRootOnL2(
        L1Adapter,
        L2Adapter,
        L2WarpToad,
        publicClient,
        sendGigaRootTx,
        BigInt(gigaRootSent),
        aztecInputs.isAztec,
        aztecInputs.aztecWallet,
        isSandBox,
        aztecInputs.aztecNode,
        aztecInputs.sponsoredPaymentMethod,
        evmL2Inputs ? { l2PublicClient: evmL2Inputs.l2PublicClient } : undefined,
    )
    console.log(`GigaRoot bridging completed! At tx hash: ${receiveGigaRootTxHash}`)

    return {
        txObjects: { sendRootToL1Tx, gigaRootUpdateTx, sendGigaRootTx, receiveGigaRootTx },
        txHashes: { sendRootToL1TxHash, gigaRootUpdateTxHash, sendGigaRootTxHash, receiveGigaRootTxHash },
        roots: { gigaRootSent },
    }
}
