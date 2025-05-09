import type { GigaRootBridge, WarpToadCore as WarpToadEvm } from "../../../../backend/typechain-types";
import { WarpToadCoreContract as WarpToadAztec } from '../../../../backend/contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { type BytesLike, ethers } from "ethers";
import { MerkleTree, type Element } from "fixed-merkle-tree";
import { findNoteHashIndex, hashCommitment, hashNullifier, hashPreCommitment, hashUniqueNoteHash, hashCommitmentFromNoteItems, hashSiloedNoteHash } from "../../../../backend/scripts/lib/hashing";
import { EVM_TREE_DEPTH, AZTEC_TREE_DEPTH, emptyAztecMerkleData, emptyGigaMerkleData, emptyEvmMerkleData, GIGA_TREE_DEPTH } from "../../../../backend/scripts/lib/constants";

//@ts-ignore
import { createPXEClient, waitForPXE, type NotesFilter, AztecAddress, type PXE } from "@aztec/aztec.js";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

import type { ProofInputs, EvmMerkleData, AztecMerkleData, } from "../../../../backend/scripts/lib/types";

const { PXE_URL = 'http://localhost:8080' } = process.env;


import { poseidon2 } from "poseidon-lite";

const abiCoder = new ethers.AbiCoder()


export async function connectPXE() {
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(PXE);
    return { wallets, PXE }
}

/**
 * kind of weird number but its the thing that is multiplied with (baseFee+priorityFee) to get the amount of tokens the relayers gets to compensate for gas fees.
 * @param ethPriceInToken       how many tokens need to buy 1 ETH (or other native gas token if the chain is weird)
 * @param gasCost               gas cost of the mint function. Should be a publicly agreed on number so the relayer knows what to expect
 * @param relayerBonusFactor    the factor on top of the fee to pay the relayer. Ex: 1.10 <= 10% earnings
 * @returns feeFactor
 */
export function calculateFeeFactor(ethPriceInToken: number, gasCost: number, relayerBonusFactor: number): bigint {
    return BigInt(Math.round(ethPriceInToken * gasCost * relayerBonusFactor))
}
//NEED
async function getEvmMerkleData(warpToadOrigin: WarpToadEvm, commitment: bigint, treeDepth: number, localRootBlockNumber: number) {

    // TODO do proper event scanning. This will break in prod
    const filter = warpToadOrigin.filters.Burn()
    const events = await warpToadOrigin.queryFilter(filter, 0, localRootBlockNumber) // this goes from 0 to latest. No rpc can do that! this will break outside tests!!
    const abiCoder = new ethers.AbiCoder()
    const types = ["uint256", "uint256"]

    const decodedEvents = events.map((event) => {
        const decodedData = abiCoder.decode(types, event.data)
        const commitment = BigInt(event.topics[1])
        const amount = decodedData[0]
        const index = decodedData[1]
        return { commitment, amount, index }
    })
    const leafIndex = decodedEvents.find((e) => e.commitment === commitment)?.index
    const leafs = decodedEvents.map((e) => e.commitment)
    //@ts-ignore
    const hashFunc = (left, right) => poseidon2([left, right])
    //@ts-ignore
    const tree = new MerkleTree(treeDepth, leafs, { hashFunction: hashFunc })
    const merkleData = {
        leaf_index: ethers.toBeHex(leafIndex),
        hash_path: tree.proof(commitment as any as Element).pathElements.map((e) => ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    } as EvmMerkleData

    return merkleData
}
//NEED
export async function getGigaMerkleData(gigaBridge: GigaRootBridge, localRoot: bigint, localRootIndex: bigint, treeDepth: number, gigaRootBlockNumber: number) {
    const amountOfLocalRoots = await gigaBridge.amountOfLocalRoots()
    const allRootIndexes = new Array(Number(amountOfLocalRoots)).fill(0).map((v, i) => ethers.toBeHex(i)) as ethers.BigNumberish[]
    //@ts-ignore i hate typescript
    const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined, allRootIndexes, undefined)
    const events = await gigaBridge.queryFilter(filter, 0, gigaRootBlockNumber)

    const eventsPerIndex = events.reduce((newObj: any, event) => {
        const index = ethers.toBeHex(event.args[1])
        if (index in newObj) {
            newObj[index].push(event)
        } else {
            newObj[index] = [event]
        }
        return newObj
    }, {})

    let sortedLeafs = [];
    for (const index of allRootIndexes) {
        if (index.toString() in eventsPerIndex) {
            sortedLeafs[ethers.toNumber(index)] = getLatestEvent(eventsPerIndex[index.toString()]).args[0] //arg[0] = localRoot
        } else {
            console.log(`whoop this index wasn't in there: ${index}`)
            sortedLeafs[ethers.toNumber(index)] = 0n
        }
    }

    //@ts-ignore
    const hashFunc = (left, right) => poseidon2([left, right])
    //@ts-ignore
    const tree = new MerkleTree(treeDepth, sortedLeafs, { hashFunction: hashFunc })
    const merkleData = {
        leaf_index: ethers.toBeHex(localRootIndex),
        hash_path: tree.proof(localRoot as any as Element).pathElements.map((e) => ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    } as EvmMerkleData
    return merkleData
}

export async function getAztecNoteHashTreeRoot(blockNumber: number, PXE?: PXE): Promise<bigint> {
    // do aztec things
    PXE = PXE ? PXE : (await connectPXE()).PXE;
    const block = await PXE.getBlock(blockNumber)
    return block?.header.state.partial.noteHashTree.root.toBigInt() as bigint
}

export async function getBlockNumberOfGigaRoot(gigaBridge: GigaRootBridge, gigaRoot: bigint) {

}

export function getLatestEvent(events: ethers.EventLog[] | any[]) {
    return events.reduce((latestEv: any, ev) => {
        if (latestEv.blockNumber > ev.blockNumber) {
            return latestEv
        } else {
            return ev
        }
    }, events[0])

}
//NEED
export async function getGigaRootBlockNumber(gigaBridge: GigaRootBridge, gigaRoot: bigint) {
    const filter = gigaBridge.filters.ConstructedNewGigaRoot(gigaRoot)
    const events = await gigaBridge.queryFilter(filter, 0) // TODO scan in chunks. start at latest go to deployment block.stop when you found 1
    const gigaRootEvent = getLatestEvent(events) // someone can create the same gigaroot twice if they really try. Idk might not matter is this context
    const gigaRootBlockNumber = gigaRootEvent.blockNumber
    return gigaRootBlockNumber
}


//NEED
export async function getLocalRootInGigaRoot(gigaBridge: GigaRootBridge, gigaRoot: bigint, gigaRootBlockNumber: number, warpToadOrigin: WarpToadEvm | WarpToadAztec) {
    const isFromAztec = !("target" in warpToadOrigin);

    const l1BridgeAdapter = isFromAztec ? await getL1BridgeAdapterAztec(warpToadOrigin) : await warpToadOrigin.l1BridgeAdapter()
    const localRootIndex = await gigaBridge.getLocalRootProvidersIndex(l1BridgeAdapter)
    const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined, localRootIndex)
    const events = await gigaBridge.queryFilter(filter, 0) // TODO scan in chunks. start at latest go to deployment block
    const [localRoot, , localRootL2BlockNumber] = events[0].args
    return { localRoot, localRootL2BlockNumber, gigaRootBlockNumber, localRootIndex }
}

export async function getL1BridgeAdapterAztec(WarpToad: WarpToadAztec) {
    const response = await WarpToad.methods.get_l1_bridge_adapter().simulate()
    const address = ethers.getAddress(ethers.toBeHex(response.inner)) // EthAddress type in aztec is a lil silly thats why
    return address
}
//NEED
export async function getAztecMerkleData(WarpToad: WarpToadAztec, commitment: bigint, destinationLocalRootBlock: number) {
    const { PXE } = await connectPXE()
    console.log("finding unique_note_hash index within the tx")
    const warpToadNoteFilter: NotesFilter = {
        contractAddress: WarpToad.address,
        storageSlot: WarpToadAztec.storage.commitments.slot
    }
    const notes = await PXE.getNotes(warpToadNoteFilter)
    const currentNote = notes.find((n) => hashCommitmentFromNoteItems(n.note.items) === commitment);
    const siloedNoteHash = await hashSiloedNoteHash(WarpToad.address.toBigInt(), commitment)
    const uniqueNoteHash = await hashUniqueNoteHash(currentNote!.nonce.toBigInt(), siloedNoteHash)
    const witness = await WarpToad.methods.get_note_proof(destinationLocalRootBlock, uniqueNoteHash).simulate()
    const merkleData: AztecMerkleData = {
        leaf_index: ethers.toBeHex(witness.index),
        hash_path: witness.path.map((h: bigint) => ethers.toBeHex(h)),
        leaf_nonce: ethers.toBeHex(currentNote!.nonce.toBigInt()),
        contract_address: ethers.toBeHex(WarpToad.address.toBigInt())
    }
    return merkleData
}

//NEED
async function getAztecLocalData() {
    const { PXE } = await connectPXE()
    const blockNumber = await PXE.getBlockNumber()
    const noteHashTreeRoot = await getAztecNoteHashTreeRoot(blockNumber, PXE)
    return { blockNumber, localRoot: noteHashTreeRoot }
}

//NEED
async function getEvmLocalData(warpToadOrigin: WarpToadEvm) {
    const provider = warpToadOrigin.runner?.provider
    const blockNumber = BigInt(await provider?.getBlockNumber() as number)
    const localRoot = await warpToadOrigin.cachedLocalRoot()
    return { blockNumber, localRoot }
}

// if you ever run into a bug with this. I am so sorry
export async function getMerkleData(gigaBridge: GigaRootBridge, warpToadOrigin: WarpToadEvm | WarpToadAztec, warpToadDestination: WarpToadEvm | WarpToadAztec, commitment: bigint) {
    const isToAztec = !("target" in warpToadDestination);
    const isFromAztec = !("target" in warpToadOrigin);
    const isOnlyLocal = warpToadDestination === warpToadOrigin;
    const gigaRoot = isToAztec ? await warpToadDestination.methods.get_giga_root().simulate() : await warpToadDestination.gigaRoot()

    console.log("getting gigaProof")
    let originLocalRoot;
    let gigaMerkleData;
    let destinationLocalRootL2Block;
    if (isOnlyLocal) {
        // get local root directly from the contract instead of extracting it from the gigaRoot (we wont use gigaRoot anyway)
        const { blockNumber, localRoot } = isFromAztec ? await getAztecLocalData() : await getEvmLocalData(warpToadOrigin)
        destinationLocalRootL2Block = blockNumber
        originLocalRoot = localRoot
        gigaMerkleData = emptyGigaMerkleData
    } else {
        // you need to get the local root from the event that created the gigaRoot. Other wise you might end up using a local root that hasn't been bridged into a gigaRoot yet ☝🤓
        const gigaRootBlockNumber = await getGigaRootBlockNumber(gigaBridge, gigaRoot)
        const { localRoot, localRootL2BlockNumber, localRootIndex: originLocalRootIndex } = await getLocalRootInGigaRoot(gigaBridge, gigaRoot, gigaRootBlockNumber, warpToadOrigin)
        originLocalRoot = localRoot
        destinationLocalRootL2Block = localRootL2BlockNumber;

        gigaMerkleData = await getGigaMerkleData(gigaBridge, originLocalRoot, originLocalRootIndex, GIGA_TREE_DEPTH, gigaRootBlockNumber)
    }

    console.log("getting localProof")
    let aztecMerkleData: AztecMerkleData;
    let evmMerkleData: EvmMerkleData;
    if (isFromAztec) {
        aztecMerkleData = await getAztecMerkleData(warpToadOrigin, commitment, Number(destinationLocalRootL2Block))
        evmMerkleData = emptyEvmMerkleData
    } else {
        aztecMerkleData = emptyAztecMerkleData
        //ok this should work:
        try {
            evmMerkleData = await getEvmMerkleData(warpToadOrigin, commitment, EVM_TREE_DEPTH, Number(destinationLocalRootL2Block));    
        } catch (error) {
            console.log(error)
            return
        }}

    return { isFromAztec, gigaMerkleData, evmMerkleData, aztecMerkleData, originLocalRoot, blockNumber: BigInt(destinationLocalRootL2Block) }
}
