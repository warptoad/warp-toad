import { UltraHonkBackend, Barretenberg, ProofData } from "@aztec/bb.js";
import { CompiledCircuit, Noir, InputMap } from "@noir-lang/noir_js";
import os from 'os';
// @ts-ignore
import circuit from "../circuits/withdraw/target/withdraw.json" with { type: 'json' }

import { WarpToadCoreContract as WarpToadAztec } from '../aztec/WarpToadCore/src/artifacts/WarpToadCore';

import { toHex, decodeAbiParameters, parseAbiParameters, type Address, type PublicClient } from "viem";
import { MerkleTree, Element } from "fixed-merkle-tree";

import { type NotesFilter } from '@aztec/stdlib/note';
import { PXE } from "@aztec/pxe/server";
import { AztecNode } from "@aztec/aztec.js/node";
import { Wallet as AztecWallet } from "@aztec/aztec.js/wallet";

import { ProofInputs, EvmMerkleData, AztecMerkleData, } from "./types";

import { findNoteHashIndex, hashCommitment, hashNullifier, hashPreCommitment, hashUniqueNoteHash , hashCommitmentFromNoteItems, hashSiloedNoteHash} from "./hashing";
import { EVM_TREE_DEPTH, AZTEC_TREE_DEPTH, emptyAztecMerkleData, emptyGigaMerkleData, emptyEvmMerkleData, GIGA_TREE_DEPTH, DEPLOYMENT_BLOCK_PER_CHAINID } from "./constants";

// Loosely-typed viem contract handles. The test path builds these via `getContract`
// so `.address`, `.abi`, `.read.*`, `.write.*`, `.getEvents.*` are all present.
type WarpToadEvm = any;
type GigaBridge = any;

import { poseidon2 } from "poseidon-lite";
import { BlockNumber } from "@aztec/foundation/branded-types";

/**
 * kind of weird number but its the thing that is multiplied with (baseFee+priorityFee) to get the amount of tokens the relayers gets to compensate for gas fees.
 */
export function calculateFeeFactor(ethPriceInToken: number, gasCost: number, relayerBonusFactor: number): bigint {
    return BigInt(Math.round(ethPriceInToken * gasCost * relayerBonusFactor))
}

// eth_getLogs limit of alchemy is 500, so chunksize = 499
export async function queryEventInChunks(
    contract: any,
    publicClient: PublicClient,
    eventName: string,
    eventArgs: Record<string, any> | undefined,
    firstBlock: number,
    lastBlock?: number,
    reverseOrder = false,
    maxEvents = Infinity,
    chunksize = 499,
) {
    lastBlock = lastBlock ? lastBlock : Number(await publicClient.getBlockNumber())
    let allEvents: any[] = []

    const scanLogic = async (index: number) => {
        const start = index * chunksize + firstBlock
        const stop = Math.min(start + chunksize, lastBlock as number)
        const events = await contract.getEvents[eventName](eventArgs ?? {}, {
            fromBlock: BigInt(start),
            toBlock: BigInt(stop),
        })
        return events as any[]
    }
    const numIters = Math.ceil((lastBlock - firstBlock) / chunksize)

    if (reverseOrder) {
        for (let index = numIters - 1; index >= 0; index--) {
            allEvents = [...(await scanLogic(index)), ...allEvents]
            if (allEvents.length >= maxEvents) break
        }
    } else {
        for (let index = 0; index < numIters; index++) {
            allEvents = [...allEvents, ...(await scanLogic(index))]
            if (allEvents.length >= maxEvents) break
        }
    }

    return allEvents
}

export async function getWarptoadBurnEvents(warpToadOrigin: WarpToadEvm, publicClient: PublicClient, localRootBlockNumber: number) {
    const chainId = BigInt(await publicClient.getChainId())
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId.toString()]
    const events = await queryEventInChunks(warpToadOrigin, publicClient, "Burn", undefined, deploymentBlock, localRootBlockNumber)
    return events
}

export async function getEvmMerkleData(warpToadOrigin: WarpToadEvm, publicClient: PublicClient, commitment: bigint, treeDepth: number, localRootBlockNumber: number) {
    const events = await getWarptoadBurnEvents(warpToadOrigin, publicClient, localRootBlockNumber)

    const decodedEvents = events.map((event) => {
        // viem decodes indexed + data args by name: commitment, amount, index
        return {
            commitment: BigInt(event.args.commitment),
            amount: BigInt(event.args.amount),
            index: BigInt(event.args.index),
        }
    })
    const leafIndex = decodedEvents.find((e) => e.commitment === commitment)?.index
    const leafs = decodedEvents.map((e) => e.commitment)

    //@ts-ignore
    const hashFunc = (left, right) => poseidon2([left, right])
    //@ts-ignore
    const tree = new MerkleTree(treeDepth, leafs, { hashFunction: hashFunc })
    if ((await warpToadOrigin.read.localRootHistory([tree.root])) === false) {
        throw new Error(`could not recreate the localRoot with events. Root that is recreated: ${tree.root}`)
    }
    if (!leafs.includes(commitment)) {
        throw new Error(`commitment: ${commitment} is not included in localRoot: ${tree.root}, which is build from events till blockNumber ${localRootBlockNumber}.`)
    }
    const merkleData = {
        leaf_index: toHex(leafIndex as bigint),
        hash_path: tree.proof(commitment as any as Element).pathElements.map((e) => toHex(BigInt(e as any))),
    } as EvmMerkleData

    return merkleData
}

export async function getGigaBridgeNewRootEvents(gigaBridge: GigaBridge, publicClient: PublicClient, allRootIndexes: bigint[], gigaRootBlockNumber: number) {
    const chainId = BigInt(await publicClient.getChainId())
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId.toString()]
    // NOTE: previously this passed an OR filter `{ localRootIndex: allRootIndexes }`,
    // but viem's named-object filter is fragile when the *first* indexed arg is left
    // undefined and the second is an array. Fetch all `ReceivedNewLocalRoot` events
    // unfiltered and let the caller bucket them by index.
    const events = await queryEventInChunks(gigaBridge, publicClient, "ReceivedNewLocalRoot", undefined, deploymentBlock)
    const wantedSet = new Set(allRootIndexes.map(i => i.toString()))
    return events.filter((e: any) => wantedSet.has(BigInt(e.args.localRootIndex).toString()))
}

export async function getGigaMerkleData(gigaBridge: GigaBridge, publicClient: PublicClient, localRoot: bigint, localRootIndex: bigint, treeDepth: number, gigaRootBlockNumber: number) {
    const amountOfLocalRoots = await gigaBridge.read.amountOfLocalRoots()
    const allRootIndexes = new Array(Number(amountOfLocalRoots)).fill(0).map((_, i) => BigInt(i))
    const events = await getGigaBridgeNewRootEvents(gigaBridge, publicClient, allRootIndexes, gigaRootBlockNumber)

    const eventsPerIndex = events.reduce((newObj: any, event: any) => {
        const index = BigInt(event.args.localRootIndex).toString()
        if (index in newObj) newObj[index].push(event)
        else newObj[index] = [event]
        return newObj
    }, {})

    let sortedLeafs: bigint[] = [];
    for (const index of allRootIndexes) {
        const key = index.toString()
        if (key in eventsPerIndex) {
            sortedLeafs[Number(index)] = BigInt(getLatestEvent(eventsPerIndex[key]).args.newLocalRoot)
        } else {
            console.log(`whoop this index wasn't in there: ${index}`)
            sortedLeafs[Number(index)] = 0n
        }
    }

    //@ts-ignore
    const hashFunc = (left, right) => poseidon2([left, right])
    //@ts-ignore
    const tree = new MerkleTree(treeDepth, sortedLeafs, { hashFunction: hashFunc })
    console.log({ localRoot, localRootIndex, sortedLeafs })
    const merkleData = {
        leaf_index: toHex(localRootIndex),
        hash_path: tree.proof(localRoot as any as Element).pathElements.map((e) => toHex(BigInt(e as any))),
    } as EvmMerkleData

    if (!sortedLeafs.includes(localRoot)) {
        throw new Error(`localRoot: ${localRoot} is not included in gigaRoot: ${tree.root}, which is build from events till blockNumber ${gigaRootBlockNumber}.`)
    }

    return merkleData
}

export async function getAztecNoteHashTreeRoot(blockNumber: number, aztecNode: AztecNode): Promise<bigint> {
    const block = await aztecNode.getBlock(blockNumber as BlockNumber)
    return block?.header.state.partial.noteHashTree.root.toBigInt() as bigint
}

export function getLatestEvent(events: any[]) {
    return events.reduce((latestEv: any, ev: any) => {
        if (latestEv.blockNumber > ev.blockNumber) return latestEv
        else return ev
    }, events[0])
}

export async function getGigaRootBlockNumber(gigaBridge: GigaBridge, publicClient: PublicClient, gigaRoot: bigint) {
    const chainId = BigInt(await publicClient.getChainId())
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId.toString()]
    const events = await queryEventInChunks(gigaBridge, publicClient, "ConstructedNewGigaRoot", { newGigaRoot: gigaRoot }, deploymentBlock, undefined, true, 1)
    console.log("gigaRootEvents:", { events })
    const gigaRootEvent = getLatestEvent(events)
    return Number(gigaRootEvent.blockNumber)
}

//TODO clean this up
export async function getLocalRootInGigaRoot(gigaBridge: GigaBridge, publicClient: PublicClient, gigaRoot: bigint, gigaRootBlockNumber: number, warpToadOrigin: WarpToadEvm | WarpToadAztec, aztecWallet: AztecWallet) {
    const isFromAztec = !(typeof (warpToadOrigin as any).address === "string")

    const l1BridgeAdapter = isFromAztec
        ? await getL1BridgeAdapterAztec(warpToadOrigin as WarpToadAztec, aztecWallet)
        : await (warpToadOrigin as WarpToadEvm).read.l1BridgeAdapter()
    const localRootIndex = await gigaBridge.read.getLocalRootProvidersIndex([l1BridgeAdapter])
    const chainId = BigInt(await publicClient.getChainId())
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId.toString()]
    const newGigaRootEvents = await queryEventInChunks(gigaBridge, publicClient, "ConstructedNewGigaRoot", { newGigaRoot: gigaRoot }, deploymentBlock, undefined, true, 1)
    const latestNewGigaRootEvent = getLatestEvent(newGigaRootEvents)
    const newGigaRootTx = await publicClient.getTransactionReceipt({ hash: latestNewGigaRootEvent.transactionHash })
    // pull all ReceivedNewLocalRoot events out of that same tx
    const { parseEventLogs } = await import("viem")
    const parsedEvents = parseEventLogs({ abi: gigaBridge.abi, logs: newGigaRootTx.logs, eventName: "ReceivedNewLocalRoot" }) as any[]

    const eventsOfThisWarpToadLocalRoot = parsedEvents.filter((e: any) => BigInt(e.args.localRootIndex) === BigInt(localRootIndex))
    const latestEventLocalRoot = getLatestEvent(eventsOfThisWarpToadLocalRoot)
    const localRoot = BigInt(latestEventLocalRoot.args.newLocalRoot)
    const localRootL2BlockNumber = BigInt(latestEventLocalRoot.args.localRootBlockNumber)
    return { localRoot, localRootL2BlockNumber, gigaRootBlockNumber, localRootIndex }
}

export async function getL1BridgeAdapterAztec(WarpToad: WarpToadAztec, aztecWallet: AztecWallet) {
    const { result } = await WarpToad.methods.get_l1_bridge_adapter().simulate({ from: (await aztecWallet.getAccounts())[0].item }) as any
    return result.toString()
}

export async function getAztecMerkleData(WarpToad: WarpToadAztec, commitment: bigint, destinationLocalRootBlock: number, PXE: PXE, aztecWallet: AztecWallet) {
    console.log("finding unique_note_hash index within the tx")
    console.log({ "warptoadAddressAztec": WarpToad.address })
    const warpToadNoteFilter: NotesFilter = {
        contractAddress: WarpToad.address,
        storageSlot: WarpToadAztec.storage.commitments.slot
    }
    console.warn("TODO @JIMJIM PXE.getNotes is still broken complain about it. Rn it uses the contract util 'get_notes_util' But afaik it only gets 16 notes not all!!!")
    const notesWithNoncesSim = await WarpToad.methods.get_notes_with_nonces(WarpToadAztec.storage.commitments.slot).simulate({ from: (await aztecWallet.getAccounts())[0].item }) as any;
    const notesWithNonces = notesWithNoncesSim.result ?? notesWithNoncesSim;
    console.log({ notesWithNonces_storage: notesWithNonces.storage })
    const ourEntry = notesWithNonces.storage.find((entry: any) => hashCommitmentFromNoteItems([entry.note.nullifier_preimage, entry.note.secret, entry.note.chain_id, entry.note.amount]) === commitment);
    if (!ourEntry) throw new Error(`No matching commitment note found for commitment ${commitment}`)
    console.log({ ourEntry })
    const noteNonce = ourEntry.note_nonce
    const siloedNoteHash = await hashSiloedNoteHash(WarpToad.address.toBigInt(), commitment)

    const uniqueNoteHash = await hashUniqueNoteHash(noteNonce, siloedNoteHash)
    const witnessSim = await WarpToad.methods.get_note_proof(destinationLocalRootBlock, uniqueNoteHash).simulate({ from: (await aztecWallet.getAccounts())[0].item }) as any
    const witness = witnessSim.result ?? witnessSim
    console.log({ witness })
    const merkleData: AztecMerkleData = {
        leaf_index: toHex(BigInt(witness.leaf_index ?? witness.index)),
        hash_path: (witness.sibling_path ?? witness.path).map((h: bigint) => toHex(BigInt(h))),
        leaf_nonce: toHex(BigInt(noteNonce)),
    }
    return { aztecMerkleData: merkleData, aztecWarptoadAddress: WarpToad.address.toBigInt() }
}

async function getAztecLocalData(aztecNode: AztecNode) {
    const currentBlockNumber = await aztecNode.getBlockNumber()
    const noteHashTreeRoot = await getAztecNoteHashTreeRoot(currentBlockNumber, aztecNode)
    return { blockNumber: currentBlockNumber, localRoot: noteHashTreeRoot }
}

async function getEvmLocalData(warpToadOrigin: WarpToadEvm, publicClient: PublicClient) {
    const blockNumber = await publicClient.getBlockNumber()
    const localRoot = await warpToadOrigin.read.cachedLocalRoot()
    return { blockNumber, localRoot: BigInt(localRoot) }
}

export async function getMerkleData(
    gigaBridge: GigaBridge,
    publicClient: PublicClient,
    warpToadOrigin: WarpToadEvm | WarpToadAztec,
    warpToadDestination: WarpToadEvm | WarpToadAztec,
    commitment: bigint,
    aztecWallet?: AztecWallet,
    PXE?: PXE,
    aztecNode?: AztecNode,
) {
    const isToAztec = !(typeof (warpToadDestination as any).address === "string")
    const isFromAztec = !(typeof (warpToadOrigin as any).address === "string")
    const isOnlyLocal = warpToadDestination === warpToadOrigin
    const gigaRoot: bigint = isToAztec
        ? BigInt(((await (warpToadDestination as WarpToadAztec).methods.get_giga_root().simulate({ from: (await (aztecWallet as AztecWallet).getAccounts())[0].item }) as any).result))
        : BigInt(await (warpToadDestination as WarpToadEvm).read.gigaRoot())
    const gigaRootArrivalBlockNumber: bigint = isToAztec
        ? BigInt(await (aztecNode as AztecNode).getBlockNumber())
        : await publicClient.getBlockNumber()

    console.log("getting gigaProof")
    let originLocalRoot: bigint
    let gigaMerkleData
    let destinationLocalRootL2Block: bigint | number
    if (isOnlyLocal) {
        const { blockNumber, localRoot } = isFromAztec
            ? await getAztecLocalData(aztecNode as AztecNode)
            : await getEvmLocalData(warpToadOrigin as WarpToadEvm, publicClient)
        destinationLocalRootL2Block = blockNumber as any
        originLocalRoot = localRoot as bigint
        gigaMerkleData = emptyGigaMerkleData
    } else {
        const gigaRootBlockNumber = await getGigaRootBlockNumber(gigaBridge, publicClient, gigaRoot)
        const { localRoot, localRootL2BlockNumber, localRootIndex: originLocalRootIndex } = await getLocalRootInGigaRoot(gigaBridge, publicClient, gigaRoot, gigaRootBlockNumber, warpToadOrigin, aztecWallet as AztecWallet)
        originLocalRoot = localRoot
        destinationLocalRootL2Block = localRootL2BlockNumber

        gigaMerkleData = await getGigaMerkleData(gigaBridge, publicClient, originLocalRoot, BigInt(originLocalRootIndex), GIGA_TREE_DEPTH, gigaRootBlockNumber)
    }

    console.log("getting localProof")
    let aztecMerkleData: AztecMerkleData
    let evmMerkleData: EvmMerkleData
    let aztecWarptoadAddress: bigint
    if (isFromAztec) {
        const aztecData = await getAztecMerkleData(warpToadOrigin as WarpToadAztec, commitment, Number(destinationLocalRootL2Block), PXE as PXE, aztecWallet as AztecWallet)
        aztecWarptoadAddress = aztecData.aztecWarptoadAddress
        aztecMerkleData = aztecData.aztecMerkleData
        evmMerkleData = emptyEvmMerkleData
    } else {
        aztecMerkleData = emptyAztecMerkleData
        aztecWarptoadAddress = BigInt(await (warpToadOrigin as WarpToadEvm).read.aztecWarptoadAddress())
        evmMerkleData = await getEvmMerkleData(warpToadOrigin as WarpToadEvm, publicClient, commitment, EVM_TREE_DEPTH, Number(destinationLocalRootL2Block))
    }

    return { isFromAztec, gigaMerkleData, evmMerkleData, aztecMerkleData, originLocalRoot, blockNumber: gigaRootArrivalBlockNumber, aztecWarptoadAddress }
}

export async function getProofInputs(
    gigaBridge: GigaBridge,
    publicClient: PublicClient,
    warpToadDestination: WarpToadEvm,
    warpToadOrigin: WarpToadEvm | WarpToadAztec,
    amount: bigint,
    feeFactor: bigint,
    priorityFee: bigint,
    maxFee: bigint,
    relayerAddress: Address,
    recipientAddress: Address,

    nullifierPreImage: bigint,
    secret: bigint,
    aztecWallet?: AztecWallet,
    PXE?: PXE,
    aztecNode?: AztecNode,
): Promise<ProofInputs> {
    const chainId = BigInt(await publicClient.getChainId())
    const gigaRoot = BigInt(await warpToadDestination.read.gigaRoot())
    const destinationLocalRoot = BigInt(await warpToadDestination.read.cachedLocalRoot())
    const preCommitment = hashPreCommitment(nullifierPreImage, secret, chainId)
    const commitment = hashCommitment(preCommitment, amount)
    const nullifier = hashNullifier(nullifierPreImage)
    const relayer = BigInt(relayerAddress)
    const recipient = BigInt(recipientAddress)

    const {
        isFromAztec,
        gigaMerkleData,
        evmMerkleData,
        aztecMerkleData,
        originLocalRoot,
        aztecWarptoadAddress,
    } = await getMerkleData(gigaBridge, publicClient, warpToadOrigin, warpToadDestination, commitment, aztecWallet, PXE, aztecNode)
    const proofInputs: ProofInputs = {
        nullifier: toHex(nullifier),
        chain_id: toHex(chainId),
        amount: toHex(amount),
        giga_root: toHex(gigaRoot),
        destination_local_root: toHex(destinationLocalRoot),
        aztec_warptoad_address: toHex(aztecWarptoadAddress),

        fee_factor: toHex(feeFactor),
        priority_fee: toHex(priorityFee),
        max_fee: toHex(maxFee),
        relayer_address: toHex(relayer),
        recipient_address: toHex(recipient),

        origin_local_root: toHex(originLocalRoot as bigint),
        is_from_aztec: isFromAztec,
        nullifier_preimage: toHex(nullifierPreImage),
        secret: toHex(secret),
        aztec_merkle_data: aztecMerkleData,
        evm_merkle_data: evmMerkleData,
        giga_merkle_data: gigaMerkleData as EvmMerkleData,
    }
    return proofInputs
}

export async function createProof(proofInputs: ProofInputs, threads: number | undefined): Promise<ProofData> {
    threads = threads ? threads : (typeof window !== "undefined" ? window.navigator.hardwareConcurrency : 69)

    const noir = new Noir(circuit as CompiledCircuit);
    console.log({ threads })

    const bbPath = process.env.BB_BINARY_PATH || undefined;
    const api = await Barretenberg.new({
        threads: threads,
        ...(bbPath ? { bbPath } : {}),
    });
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const executeRes = await noir.execute(proofInputs as any as InputMap);
    const proof = await backend.generateProof(executeRes.witness, { keccakZK: true });
    const verifiedJs = await backend.verifyProof(proof, { keccakZK: true })
    console.log({ verifiedJs })

    return proof
}
