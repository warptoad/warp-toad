import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
    type Address,
    type Hex,
    type PublicClient,
    type WalletClient,
    getContract,
    parseEventLogs,
    toHex,
} from "viem";

import { L2AztecBridgeAdapterContract } from '../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { WarpToadCoreContract as L2WarpToadAZTEC } from '../aztec/WarpToadCore/src/artifacts/WarpToadCore';
import {
    L1_SCROLL_MESSENGER_MAINNET,
    L1_SCROLL_MESSENGER_SEPOLIA,
    SCROLL_CHAINID_MAINNET,
    SCROLL_CHAINID_SEPOLIA,
} from './constants';

// Loose viem contract-handle types. Test path builds these via `getContract`.
type WarpToadEvm = any;
type L1AztecBridgeAdapter = any;
type L1ScrollBridgeAdapter = any;
type L2ScrollBridgeAdapter = any;
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
    computeL2ToL1MembershipWitness,
    computeL2ToL1MembershipWitnessFromMessagesInEpoch,
} from '@aztec/stdlib/messaging';
import { BlockNumber, EpochNumber } from "@aztec/foundation/branded-types";

// Minimal ABIs for ad-hoc viem reads against contracts we don't have full handles for.
const LOCAL_ROOT_PROVIDER_ABI = [
    { type: "function", name: "mostRecentL2Root", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "mostRecentL2RootBlockNumber", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ROLLUP_EPOCH_ABI = [
    { type: "function", name: "getEpochDuration", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const OUTBOX_ABI = [
    { type: "function", name: "getRootData", stateMutability: "view", inputs: [{ name: "_epoch", type: "uint256" }], outputs: [{ name: "root", type: "bytes32" }] },
] as const;

const L1_SCROLL_MESSENGER_ABI = [
    {
        type: "function",
        name: "relayMessageWithProof",
        stateMutability: "nonpayable",
        inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "message", type: "bytes" },
            {
                name: "proof",
                type: "tuple",
                components: [
                    { name: "batchIndex", type: "uint256" },
                    { name: "merkleProof", type: "bytes" },
                ],
            },
        ],
        outputs: [],
    },
] as const;

const NEW_GIGA_ROOT_EVENT = {
    type: "event",
    name: "NewGigaRoot",
    inputs: [{ name: "gigaRoot", type: "uint256", indexed: true }],
} as const;

const SCROLL_BRIDGE_API_BASE_SEPOLIA = "https://sepolia-api-bridge-v2.scroll.io/api";
const SCROLL_BRIDGE_API_BASE_MAINNET = "https://mainnet-api-bridge-v2.scroll.io/api";

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type L1Adapter = L1AztecBridgeAdapter | L1ScrollBridgeAdapter;
export type L2Adapter = L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract
export type L2WarpToad = L2WarpToadAZTEC | L2WarpToadEVM

const chainIds = {
    scroll: {
        testnet: 534351n,
        mainnet: 534352n,
    },
}

function loadEvmDeployedAddresses(chainId: bigint): Record<string, string> {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = path.dirname(thisFile);
    const file = path.resolve(thisDir, '..', 'deploy', 'ignition', 'deployments', `chain-${chainId.toString()}`, 'deployed_addresses.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
}

export async function getLocalRootProviders(chainId: bigint): Promise<Address[]> {
    const addrs = loadEvmDeployedAddresses(chainId);
    const result: Address[] = [];
    const l1WarpToad = addrs['L1InfraModule#L1WarpToad'] || addrs['L1WarpToadModule#L1WarpToad'];
    const l1AztecAdapter = addrs['L1InfraModule#L1AztecBridgeAdapter'];
    const l1ScrollAdapter = addrs['L1InfraModule#L1ScrollBridgeAdapter'];
    if (l1WarpToad) result.push(l1WarpToad as Address);
    if (l1AztecAdapter) result.push(l1AztecAdapter as Address);
    if (l1ScrollAdapter) result.push(l1ScrollAdapter as Address);
    return result;
}

export async function getPayableGigaRootRecipients(chainId: bigint): Promise<Address[]> {
    const addrs = loadEvmDeployedAddresses(chainId);
    const l1ScrollAdapter = addrs['L1InfraModule#L1ScrollBridgeAdapter'];
    return l1ScrollAdapter ? [l1ScrollAdapter as Address] : [];
}

export async function getL1ClaimDataScrollBridgeApi(
    l2BridgeInitiationContract: Address,
    txHash?: Hex,
    pageSize = 10,
    apiBase: string = SCROLL_BRIDGE_API_BASE_SEPOLIA,
): Promise<any> {
    let page = 1;
    while (true) {
        const url = `${apiBase}/l2/unclaimed/withdrawals?address=${l2BridgeInitiationContract}&page=${page}&page_size=${pageSize}`;
        const apiRes = await fetch(url);
        const apiResJson = (await apiRes.json()) as any;
        const results = apiResJson?.data?.results;
        if (results === null || results === undefined) return undefined;
        const found = txHash
            ? results.find((v: any) => v.hash === txHash)
            : results[0];
        if (found !== undefined) return found;
        if (results.length < pageSize) return undefined;
        page += 1;
    }
}

export async function getClaimDataScroll(
    adapterContract: Address,
    txHash?: Hex,
    pollIntervalMs: number = 60_000,
    apiBase?: string,
): Promise<any> {
    while (true) {
        const result = await getL1ClaimDataScrollBridgeApi(adapterContract, txHash, 10, apiBase);
        const claimInfo = result && result.claim_info !== null ? result.claim_info : undefined;
        if (claimInfo !== undefined) return claimInfo;
        console.log(`[scroll] claim not ready for ${txHash ?? '(latest)'} @ ${adapterContract}; retrying in ${pollIntervalMs / 1000}s`);
        await sleep(pollIntervalMs);
    }
}

export async function claimL1WithdrawScroll(
    publicClient: PublicClient,
    walletClient: WalletClient,
    claimInfo: any,
    confirmations = 1,
) {
    const l1ChainId = BigInt(await publicClient.getChainId());
    const l1ScrollMessenger = (l1ChainId === 1n ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA) as Address;
    const hash = await walletClient.writeContract({
        address: l1ScrollMessenger,
        abi: L1_SCROLL_MESSENGER_ABI,
        functionName: 'relayMessageWithProof',
        args: [
            claimInfo.from as Address,
            claimInfo.to as Address,
            BigInt(claimInfo.value),
            BigInt(claimInfo.nonce),
            claimInfo.message as Hex,
            {
                batchIndex: BigInt(claimInfo.proof.batch_index),
                merkleProof: claimInfo.proof.merkle_proof as Hex,
            },
        ],
        account: walletClient.account!,
        chain: walletClient.chain!,
    });
    const tx = await publicClient.waitForTransactionReceipt({ hash, confirmations });
    return { tx, hash };
}

export async function bridgeEVMLocalRootToL1(
    l1PublicClient: PublicClient,
    l1WalletClient: WalletClient,
    l2PublicClient: PublicClient,
    l2WalletClient: WalletClient,
    L2Adapter: L2ScrollBridgeAdapter,
    confirmations = 3,
) {
    const l2ChainId = BigInt(await l2PublicClient.getChainId());
    if (l2ChainId !== SCROLL_CHAINID_SEPOLIA && l2ChainId !== SCROLL_CHAINID_MAINNET) {
        throw new Error(`bridgeEVMLocalRootToL1: unknown L2 chain ${l2ChainId}`);
    }
    const apiBase = l2ChainId === SCROLL_CHAINID_MAINNET ? SCROLL_BRIDGE_API_BASE_MAINNET : SCROLL_BRIDGE_API_BASE_SEPOLIA;

    const l2Hash = await L2Adapter.write.sentLocalRootToL1([], {
        account: l2WalletClient.account,
        chain: l2WalletClient.chain,
    });
    const L2ToL1Tx = await l2PublicClient.waitForTransactionReceipt({ hash: l2Hash, confirmations });
    console.log(`[scroll] local root sent to L1 at L2 tx ${L2ToL1Tx.transactionHash}; polling bridge API for claim proof...`);

    const claimInfo = await getClaimDataScroll(L2Adapter.address as Address, L2ToL1Tx.transactionHash, 60_000, apiBase);
    console.log(`[scroll] claim proof ready; relaying on L1`);
    const { tx } = await claimL1WithdrawScroll(l1PublicClient, l1WalletClient, claimInfo, confirmations);
    return { sendRootToL1Tx: tx, sendRootToL1TxHash: tx.transactionHash };
}

export async function receiveGigaRootOnEvmL2(
    l2PublicClient: PublicClient,
    L2Adapter: L2ScrollBridgeAdapter,
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
                console.log(`[scroll] NewGigaRoot(${gigaRootSent}) observed at block ${logs[0].blockNumber}`);
                return {
                    receiveGigaRootTxHash: logs[0].transactionHash as Hex,
                    blockNumber: logs[0].blockNumber as bigint,
                };
            }
            from = to + 1n;
        }
        console.log(`[scroll] waiting for NewGigaRoot(${gigaRootSent}) on L2 (scanned ${scanStart}-${scanEnd})`);
        await sleep(pollIntervalMs);
        scanStart = scanEnd + 1n;
        scanEnd = await l2PublicClient.getBlockNumber();
    }
}

/**
 * bridges noteHashTreeRoot from aztec L2 to L1
 * L2aztecAdapter -> L1AztecAdapter
 */
export async function bridgeAZTECLocalRootToL1(
    aztecNode: AztecNode,
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    publicClient: PublicClient,
    walletClient: WalletClient,
    aztecWallet: AztecWallet,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined,
    confirmations = 1,
) {
    const blockNumberOfRoot = await aztecNode.getBlockNumber()
    const PXE_L2Root = (await aztecNode.getBlock(blockNumberOfRoot))?.header.state.partial.noteHashTree.root as Fr
    const sendRootToL1Tx = await L2AztecBridgeAdapter.methods.send_root_to_l1(blockNumberOfRoot).send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await aztecWallet.getAccounts())[0].item });
    const l1ChainId = BigInt(await publicClient.getChainId())

    const isSandBox = l1ChainId === 31337n
    const blocksToWait = isSandBox ? 2 : 10
    await waitForBlocksAztec(blocksToWait, aztecNode, isSandBox, L2AztecBridgeAdapter, aztecWallet)

    const sendRootEffect = await aztecNode.getTxEffect(sendRootToL1Tx.receipt.txHash)
    const messageLeaf = sendRootEffect?.data.l2ToL1Msgs[0] as Fr
    const messageBlockNumber = sendRootEffect?.l2BlockNumber as number
    const contentHash = messageLeaf

    // Compute epoch from L2 block's slot using epochDuration read from L1 Rollup contract.
    const txL2Block = await aztecNode.getBlock(messageBlockNumber)
    if (!txL2Block) throw new Error(`Could not fetch L2 block ${messageBlockNumber} for message witness`)
    const messageSlot = BigInt(txL2Block.slot)
    const aztecNodeInfo = await aztecNode.getNodeInfo()
    const rollupAddressForEpoch = aztecNodeInfo.l1ContractAddresses.rollupAddress.toString() as Address
    const epochDuration = BigInt(await publicClient.readContract({
        address: rollupAddressForEpoch,
        abi: ROLLUP_EPOCH_ABI,
        functionName: "getEpochDuration",
    }))
    const computedEpoch = Number(messageSlot / epochDuration)

    const findMessageInEpoch = async (epoch: number): Promise<Fr[][][][] | null> => {
        if (epoch < 0) return null
        try {
            const messagesInEpoch = await aztecNode.getL2ToL1Messages(EpochNumber(epoch))
            if (messagesInEpoch.length === 0) return null
            computeL2ToL1MembershipWitnessFromMessagesInEpoch(messagesInEpoch, contentHash)
            return messagesInEpoch
        } catch (err) {
            // Transient RPC failures (e.g. Bad Gateway from the Aztec node) would
            // otherwise kill the whole bridge op; the poll loop is here to retry.
            return null
        }
    }
    let foundEpoch: number | undefined
    // The search window tracks the Aztec prover's proven tip rather than a
    // fixed ±1 offset - testnet prover lag is routinely several epochs, so
    // a static window silently misses the message when the proof lands late.
    //
    // Each iteration:
    //   1. Read getProvenBlockNumber() → derive provenEpoch from its slot.
    //   2. Scan every epoch in [computedEpoch-1 .. provenEpoch+1].
    //
    // Sandbox prover is single-threaded; poll fast (2s) with a smaller ceiling
    // so a broken sandbox fails fast. Testnet polls every 15s for up to 1h -
    // the prover lag observed in production has exceeded 20 min, and slower
    // polling also keeps the Infura RPC budget reasonable.
    const pollIntervalMs = isSandBox ? 2_000 : 15_000
    const maxPolls = isSandBox ? 300 : 240
    let lastLoggedProvenEpoch = -1
    pollLoop: for (let i = 0; i < maxPolls; i++) {
        let provenEpoch = computedEpoch
        try {
            const provenBlockNum = Number(await aztecNode.getProvenBlockNumber())
            if (provenBlockNum > 0) {
                const provenBlock = await aztecNode.getBlock(provenBlockNum)
                if (provenBlock) {
                    provenEpoch = Number(BigInt(provenBlock.slot) / epochDuration)
                }
            }
        } catch {
            // Transient node failures just mean we stick with the prior
            // bound for this iteration; next poll will retry.
        }
        const lo = Math.max(0, computedEpoch - 1)
        const hi = Math.max(computedEpoch + 1, provenEpoch + 1)
        for (let e = lo; e <= hi; e++) {
            if (await findMessageInEpoch(e)) {
                foundEpoch = e
                break pollLoop
            }
        }
        if (i % 5 === 0 || provenEpoch !== lastLoggedProvenEpoch) {
            console.log(`waiting for L2->L1 message ${contentHash.toString()} to be proven in epoch ${computedEpoch} (provenEpoch=${provenEpoch}, search=[${lo}..${hi}], slot=${messageSlot}, dur=${epochDuration})... (${i}/${maxPolls})`)
            lastLoggedProvenEpoch = provenEpoch
        }
        await sleep(pollIntervalMs)
    }
    if (foundEpoch === undefined) {
        throw new Error(`Timed out waiting for L2->L1 message ${contentHash.toString()} to land in a proven epoch (computed epoch ${computedEpoch})`)
    }

    const messageWitness = await computeL2ToL1MembershipWitness(aztecNode, EpochNumber(foundEpoch), contentHash) as L2ToL1MembershipWitness
    const siblingPathArray = messageWitness.siblingPath.toFields().map((f: any) => f.toString())

    const outboxAddress = (await L1AztecBridgeAdapter.read.outbox()) as Address
    const outboxTimeoutMs = isSandBox ? 5 * 60_000 : 30 * 60_000
    const outboxStart = Date.now()
    while (true) {
        const rootHex = await publicClient.readContract({
            address: outboxAddress,
            abi: OUTBOX_ABI,
            functionName: "getRootData",
            args: [BigInt(foundEpoch)],
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
        BigInt(messageWitness.leafIndex),
        siblingPathArray.map((s: string) => s as Hex),
    ] as const

    const waitFunc = async () => await waitForBlocksAztec(blocksToWait, aztecNode, isSandBox, L2AztecBridgeAdapter, aztecWallet)
    await tryUntilItWorks(publicClient, L1AztecBridgeAdapter, "getNewRootFromL2", args as any, waitFunc)
    const refreshRootHash = await L1AztecBridgeAdapter.write.getNewRootFromL2(args, { account: walletClient.account, chain: walletClient.chain })
    const refreshRootTx = await publicClient.waitForTransactionReceipt({ hash: refreshRootHash, confirmations })

    return { refreshRootTx, sendRootToL1Tx, PXE_L2Root }
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
        const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeAZTECLocalRootToL1(
            aztecNode,
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            publicClient,
            walletClient,
            aztecWallet as AztecWallet,
            sponsoredPaymentMethodAZTEC,
            confirmations,
        )
        return { sendRootToL1Tx, sendRootToL1TxHash: sendRootToL1Tx.receipt.txHash.toString() }
    } else {
        if (!evmL2Inputs) throw new Error("bridgeLocalRootToL1: evmL2Inputs (l2PublicClient, l2WalletClient) required for non-aztec (scroll) path")
        const { sendRootToL1Tx, sendRootToL1TxHash } = await bridgeEVMLocalRootToL1(
            publicClient,
            walletClient,
            evmL2Inputs.l2PublicClient,
            evmL2Inputs.l2WalletClient,
            L2Adapter as L2ScrollBridgeAdapter,
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
    const totalEth = BigInt(allPayableGigaRootRecipients.length) * defaultEthAmountGas
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
            await L2AztecBridgeAdapter.methods.count(0n).send({ from: (await (aztecWallet as AztecWallet).getAccounts())[0].item });
        }
        console.log(`waiting for L1->L2 message ${messageHashFr.toString()} to be ready (msgCheckpoint=${messageCheckpointNumber}, ${Math.round((Date.now() - start) / 1000)}s)`)
        await sleep(isSandBox ? 3_000 : 30_000)
    }

    const receiveGigaRootTx = await L2AztecBridgeAdapter.methods
        .receive_giga_root(content_hash, index, AztecWarpToad.address)
        .send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await (aztecWallet as AztecWallet).getAccounts())[0].item });
    return { receiveGigaRootTx }
}

export async function waitForBlocksAztec(blocksToWait: number, aztecNode: AztecNode, isSandBox?: boolean, L2AztecBridgeAdapter?: L2AztecBridgeAdapterContract, aztecWallet?: AztecWallet) {
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
                    await L2AztecBridgeAdapter.methods.count(0n).send({ from: (await (aztecWallet as AztecWallet).getAccounts())[0].item });
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
            console.log(`[scroll] no gigaRootSent provided; skipping L2 arrival wait (Scroll messenger will auto-relay)`);
            return { receiveGigaRootTx: undefined, receiveGigaRootTxHash: undefined, gigaRootOnL2: undefined };
        }
        if (!evmL2Inputs) throw new Error("receiveGigaRootOnL2: evmL2Inputs (l2PublicClient) required for non-aztec (scroll) path");
        const { receiveGigaRootTxHash } = await receiveGigaRootOnEvmL2(
            evmL2Inputs.l2PublicClient,
            L2Adapter as L2ScrollBridgeAdapter,
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
