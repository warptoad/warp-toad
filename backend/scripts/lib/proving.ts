import { UltraHonkBackend, UltraPlonkBackend } from "@aztec/bb.js";
// @ts-ignore
import { CompiledCircuit, Noir, InputMap } from "@noir-lang/noir_js";
import os from 'os';
import circuit from "../../circuits/withdraw/target/withdraw.json"
import { ProofData } from "@aztec/bb.js";

import { GigaBridge, WarpToadCore as WarpToadEvm } from "../../typechain-types";
import { WarpToadCoreContract as WarpToadAztec } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { BytesLike, ethers } from "ethers";
import { MerkleTree, Element } from "fixed-merkle-tree";
import { findNoteHashIndex, hashCommitment, hashNullifier, hashPreCommitment, hashUniqueNoteHash , hashCommitmentFromNoteItems, hashSiloedNoteHash} from "./hashing";
import { EVM_TREE_DEPTH, AZTEC_TREE_DEPTH, emptyAztecMerkleData, emptyGigaMerkleData, emptyEvmMerkleData, GIGA_TREE_DEPTH, DEPLOYMENT_BLOCK_PER_CHAINID } from "./constants";


//@ts-ignore
import { createPXEClient, waitForPXE,NotesFilter, AztecAddress, PXE } from "@aztec/aztec.js";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

import { ProofInputs, EvmMerkleData, AztecMerkleData, } from "./types";

const { PXE_URL = 'http://localhost:8080' } = process.env;


import { poseidon2 } from "poseidon-lite";

import fs from "fs/promises";
import { parseEventFromTx, parseMultipleEventsFromTx } from "./bridging";
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

// eth_getLogs limit of alchemy is 500, so  chunksize = 499
export async function queryEventInChunks(contract: ethers.Contract | ethers.BaseContract, filter: ethers.ContractEventName, firstBlock: number, lastBlock?: number, reverseOrder = false, maxEvents = Infinity,  chunksize = 499) {
    const provider = contract!.runner!.provider
    lastBlock = lastBlock ? lastBlock : await provider!.getBlockNumber()
    let allEvents = [] as ethers.EventLog[]

    const scanLogic = async (index: number) => {
        const start = index * chunksize + firstBlock
        // Math.min <= to ensure never go above lastBlock
        const stop = Math.min(start + chunksize, lastBlock)
        const events = await contract.queryFilter(filter, start, stop) as ethers.EventLog[]
        console.log({start, stop, events})
        return events
    }
    const numIters = Math.ceil((lastBlock - firstBlock) / chunksize)

    console.log({numIters})
    if (reverseOrder) {
        for (let index = numIters-1; index >= 0; index--) {
            allEvents = [...(await scanLogic(index)), ...allEvents]
            if (allEvents.length >= maxEvents) {
                break
            }
        }
    } else {
        for (let index = 0; index < numIters; index++) {
            allEvents = [...allEvents, ...(await scanLogic(index))]
            if (allEvents.length >= maxEvents) {
                break
            }
        }
    }

    return allEvents

}


export async function getWarptoadBurnEvents(warpToadOrigin: WarpToadEvm, localRootBlockNumber:number) {
    const chainId = (await  warpToadOrigin.runner?.provider?.getNetwork())?.chainId as bigint
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()]
    const filter = warpToadOrigin.filters.Burn()
    const events = await queryEventInChunks(warpToadOrigin, filter, deploymentBlock, localRootBlockNumber)
    return events
}

export async function getEvmMerkleData(warpToadOrigin: WarpToadEvm, commitment: bigint, treeDepth: number, localRootBlockNumber:number) {
    const events = await getWarptoadBurnEvents(warpToadOrigin, localRootBlockNumber)
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
    if ((await warpToadOrigin.localRootHistory(tree.root)) === false) {throw new Error(`could not recreate the localRoot with events. Root that is recreated: ${tree.root}`)}
    if (!leafs.includes(commitment)) {
        throw new Error(`commitment: ${commitment} is not included in localRoot: ${tree.root}, which is build from events till blockNumber ${localRootBlockNumber}. 
        Either the commitment is in a localRoot that still has yet to be bridged, or (if deposited and withdrawn on the same chain) this commitments is not included onchain`)
    }
    const merkleData = {
        leaf_index: ethers.toBeHex(leafIndex),
        hash_path: tree.proof(commitment as any as Element).pathElements.map((e) => ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    } as EvmMerkleData

    return merkleData
}

export async function getGigaBridgeNewRootEvents(gigaBridge:GigaBridge,allRootIndexes:ethers.BigNumberish[], gigaRootBlockNumber:number) {
    const chainId = (await  gigaBridge.runner?.provider?.getNetwork())?.chainId as bigint
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()]
    //@ts-ignore i hate typescript
    const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined,allRootIndexes,undefined)
    return await queryEventInChunks(gigaBridge, filter, deploymentBlock) 
    
}


export async function getGigaMerkleData(gigaBridge:GigaBridge,localRoot:bigint, localRootIndex:bigint, treeDepth:number, gigaRootBlockNumber:number) {
    const amountOfLocalRoots = await gigaBridge.amountOfLocalRoots()
    const allRootIndexes = new Array(Number(amountOfLocalRoots)).fill(0).map((v,i)=>ethers.toBeHex(i)) as ethers.BigNumberish[]
    //@ts-ignore i hate typescript
    // const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined,allRootIndexes,undefined)
    // const events = await gigaBridge.queryFilter(filter,0,"latest")
    const events = await getGigaBridgeNewRootEvents(gigaBridge,allRootIndexes,gigaRootBlockNumber)

    const eventsPerIndex = events.reduce((newObj: any, event)=>{
        //@ts-ignore TODO do as typed gigaBridge event
        const index = ethers.toBeHex(event.args[1])
        if (index in newObj) {
            newObj[index].push(event)
        } else {
            newObj[index] = [event]
        }
        return newObj
    },{})
    console.log({allRootIndexes,eventsPerIndex})
    let sortedLeafs = [];
    for (const index of allRootIndexes) {
        if (index.toString() in eventsPerIndex){
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
    console.log({localRoot, localRootIndex, sortedLeafs})
    const merkleData = {
        leaf_index: ethers.toBeHex(localRootIndex),
        hash_path: tree.proof(localRoot as any as Element).pathElements.map((e) => ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    } as EvmMerkleData

    if (!sortedLeafs.includes(localRoot)) {
        throw new Error(`localRoot: ${localRoot} is not included in gigaRoot: ${tree.root}, which is build from events till blockNumber ${gigaRootBlockNumber}.`)
    }

    return merkleData
}

export async function getAztecNoteHashTreeRoot(blockNumber:number, PXE?:PXE): Promise<bigint> {
    // do aztec things
    PXE = PXE ? PXE : (await connectPXE()).PXE;
    const block = await PXE.getBlock(blockNumber)
    return block?.header.state.partial.noteHashTree.root.toBigInt() as bigint
}

export async function getBlockNumberOfGigaRoot(gigaBridge:GigaBridge, gigaRoot:bigint) {

}

export function getLatestEvent(events:ethers.EventLog[]|any[]) {
    return events.reduce((latestEv:any, ev)=> {
        if (latestEv.blockNumber > ev.blockNumber) {
            return latestEv
        } else {
            return ev
        }
    }, events[0] )
    
}

export async function getGigaRootBlockNumber(gigaBridge:GigaBridge, gigaRoot:bigint) {
    const filter = gigaBridge.filters.ConstructedNewGigaRoot(gigaRoot)
    const chainId = (await  gigaBridge.runner?.provider?.getNetwork())?.chainId as bigint
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()]
    const events = await queryEventInChunks(gigaBridge, filter, deploymentBlock,undefined,true,1)  // reverse order because we only need the most recent event
    console.log("gigaRootEvents: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {events})
    const gigaRootEvent = getLatestEvent(events) // someone can create the same gigaroot twice if they really try. Idk might not matter is this context
    const gigaRootBlockNumber = gigaRootEvent.blockNumber
    return gigaRootBlockNumber  
}


//TODO clean this up. can prob be simpler
export async function getLocalRootInGigaRoot(gigaBridge:GigaBridge, gigaRoot:bigint, gigaRootBlockNumber: number, warpToadOrigin:WarpToadEvm|WarpToadAztec) {
    const isFromAztec = !("target" in warpToadOrigin);

    const l1BridgeAdapter = isFromAztec ? await getL1BridgeAdapterAztec(warpToadOrigin) : await warpToadOrigin.l1BridgeAdapter()
    const localRootIndex = await gigaBridge.getLocalRootProvidersIndex(l1BridgeAdapter)
    const newGigaRootFilter = gigaBridge.filters.ConstructedNewGigaRoot(gigaRoot)
    // const localRootFilter = gigaBridge.filters.ReceivedNewLocalRoot(undefined,localRootIndex)
    const chainId = (await  gigaBridge.runner?.provider?.getNetwork())?.chainId as bigint
    const deploymentBlock = DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()]
    const newGigaRootEvents = await queryEventInChunks(gigaBridge, newGigaRootFilter, deploymentBlock,undefined,true,1) 
    const latestNewGigaRootEvent = getLatestEvent(newGigaRootEvents) // you can assume newGigaRootEvents[0] is fine but lets be safe this time!
    const newGigaRootTx = await latestNewGigaRootEvent.getTransactionReceipt() //await newGigaRootEvents[0].getTransactionReceipt()
    const parsedEvents = parseMultipleEventsFromTx(newGigaRootTx, gigaBridge, "ReceivedNewLocalRoot")

    // i hate events
    const eventsOfThisWarpToadLocalRoot = parsedEvents.filter((e:any)=>e.args[1] === localRootIndex )
    const latestEventLocalRoot = getLatestEvent(eventsOfThisWarpToadLocalRoot)
    const localRoot = latestEventLocalRoot.args[0]
    const localRootL2BlockNumber = latestEventLocalRoot.args[2]
    return  {localRoot, localRootL2BlockNumber, gigaRootBlockNumber,localRootIndex}
}


export async function getL1BridgeAdapterAztec(WarpToad:WarpToadAztec) {
    const response = await WarpToad.methods.get_l1_bridge_adapter().simulate()
    const address = ethers.getAddress(ethers.toBeHex(response.inner)) // EthAddress type in aztec is a lil silly thats why
    return address
}

export async function getAztecMerkleData(WarpToad:WarpToadAztec, commitment:bigint, destinationLocalRootBlock:number)  {
    const {PXE} = await connectPXE()
    console.log("finding unique_note_hash index within the tx")
    const warpToadNoteFilter:NotesFilter = {
        contractAddress: WarpToad.address, 
        storageSlot: WarpToadAztec.storage.commitments.slot
    }
    const notes = await PXE.getNotes(warpToadNoteFilter)
    const currentNote = notes.find((n)=> hashCommitmentFromNoteItems(n.note.items) === commitment);
    const siloedNoteHash = await hashSiloedNoteHash(WarpToad.address.toBigInt() ,commitment)
    const uniqueNoteHash = await hashUniqueNoteHash(currentNote!.noteNonce.toBigInt(),siloedNoteHash)
    const witness = await WarpToad.methods.get_note_proof(destinationLocalRootBlock,uniqueNoteHash ).simulate()
    const merkleData: AztecMerkleData = {
        leaf_index: ethers.toBeHex(witness.index),
        hash_path: witness.path.map((h:bigint)=>ethers.toBeHex(h)),
        leaf_nonce: ethers.toBeHex(currentNote!.noteNonce.toBigInt()),
        contract_address: ethers.toBeHex(WarpToad.address.toBigInt())
    }
    return merkleData
}


async function getAztecLocalData() {
    const {PXE} = await connectPXE()
    const blockNumber = await PXE.getBlockNumber()
    const noteHashTreeRoot = await getAztecNoteHashTreeRoot(blockNumber,PXE)
    return {blockNumber,localRoot:noteHashTreeRoot}
}

async function getEvmLocalData(warpToadOrigin:WarpToadEvm) {
    const provider = warpToadOrigin.runner?.provider
    const blockNumber = BigInt(await provider?.getBlockNumber() as number) 
    const localRoot = await warpToadOrigin.cachedLocalRoot()
    return {blockNumber,localRoot}
}

// if you ever run into a bug with this. I am so sorry
export async function getMerkleData(gigaBridge:GigaBridge, warpToadOrigin: WarpToadEvm | WarpToadAztec, warpToadDestination:WarpToadEvm | WarpToadAztec, commitment:bigint) { 
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
        const  {blockNumber,localRoot} = isFromAztec ? await getAztecLocalData() : await getEvmLocalData(warpToadOrigin)
        destinationLocalRootL2Block = blockNumber
        originLocalRoot = localRoot
        gigaMerkleData = emptyGigaMerkleData
    } else {
        // you need to get the local root from the event that created the gigaRoot. Other wise you might end up using a local root that hasn't been bridged into a gigaRoot yet ☝🤓
        const gigaRootBlockNumber = await getGigaRootBlockNumber(gigaBridge, gigaRoot)
        const {localRoot, localRootL2BlockNumber,localRootIndex:originLocalRootIndex } = await getLocalRootInGigaRoot(gigaBridge, gigaRoot,gigaRootBlockNumber, warpToadOrigin)
        originLocalRoot = localRoot
        destinationLocalRootL2Block = localRootL2BlockNumber;

        gigaMerkleData = await getGigaMerkleData(gigaBridge, originLocalRoot, originLocalRootIndex, GIGA_TREE_DEPTH, gigaRootBlockNumber)
    }

    console.log("getting localProof")
    let aztecMerkleData:AztecMerkleData;
    let evmMerkleData:EvmMerkleData;
    if (isFromAztec) {
        aztecMerkleData = await getAztecMerkleData(warpToadOrigin, commitment, Number(destinationLocalRootL2Block)) 
        evmMerkleData = emptyEvmMerkleData
    } else {
        aztecMerkleData = emptyAztecMerkleData
        evmMerkleData = await getEvmMerkleData(warpToadOrigin, commitment, EVM_TREE_DEPTH, Number(destinationLocalRootL2Block));
    }

    return {isFromAztec, gigaMerkleData,evmMerkleData,aztecMerkleData, originLocalRoot, blockNumber:BigInt(destinationLocalRootL2Block)}
}

export async function getProofInputs(
    gigaBridge:GigaBridge,
    warpToadDestination: WarpToadEvm,
    warpToadOrigin: WarpToadEvm | WarpToadAztec, // warptoadEvm = {WarpToadCore} from typechain-types and WarpToadAztec = {WarpToadCoreContract} from `aztec-nargo codegen` 
    amount: bigint,
    feeFactor: bigint,
    priorityFee: bigint,
    maxFee: bigint,
    relayerAddress: ethers.AddressLike,
    recipientAddress: ethers.AddressLike,

    //private
    nullifierPreImage: bigint,
    secret: bigint,
): Promise<ProofInputs> {
    // TODO performance: do all these awaits concurrently 
    const chainId = (await warpToadDestination.runner?.provider?.getNetwork())?.chainId as bigint
    const gigaRoot = await warpToadDestination.gigaRoot()
    const destinationLocalRoot = await warpToadDestination.cachedLocalRoot() //TODO if this breaks. means you have to cache it first
    const preCommitment = hashPreCommitment(nullifierPreImage, secret, chainId)
    const commitment = hashCommitment(preCommitment, amount)
    const nullifier = hashNullifier(nullifierPreImage)
    const relayer = ethers.toBigInt(relayerAddress as BytesLike)
    const recipient = ethers.toBigInt(recipientAddress as BytesLike)

    const {
        isFromAztec,
        gigaMerkleData,
        evmMerkleData,
        aztecMerkleData, 
        originLocalRoot
    } = await getMerkleData(gigaBridge,warpToadOrigin,warpToadDestination, commitment)
    
    const proofInputs: ProofInputs = {
        // ----- public inputs -----
        nullifier: ethers.toBeHex(nullifier),
        chain_id: ethers.toBeHex(chainId),
        amount: ethers.toBeHex(amount),
        giga_root: ethers.toBeHex(gigaRoot),
        destination_local_root: ethers.toBeHex(destinationLocalRoot),

        fee_factor: ethers.toBeHex(feeFactor),
        priority_fee: ethers.toBeHex(priorityFee),
        max_fee: ethers.toBeHex(maxFee),
        relayer_address: ethers.toBeHex(relayer),      // eth address left padded zeros / as bigInt
        recipient_address: ethers.toBeHex(recipient),  // eth address left padded zeros

        // ----- private inputs -----
        origin_local_root: ethers.toBeHex(originLocalRoot as bigint),
        is_from_aztec: isFromAztec,//ethers.toBeHex(BigInt(isFromAztec)),
        nullifier_preimage: ethers.toBeHex(nullifierPreImage),
        secret: ethers.toBeHex(secret),
        aztec_merkle_data: aztecMerkleData,
        evm_merkle_data: evmMerkleData,
        giga_merkle_data: gigaMerkleData as EvmMerkleData,
    }
    return proofInputs
}

export async function createProof(proofInputs: ProofInputs, threads: number | undefined): Promise<ProofData> {
    // TODO assumes that if window doesn't exist os does
    threads = threads ? threads : window ? window.navigator.hardwareConcurrency : os.cpus().length

    const noir = new Noir(circuit as CompiledCircuit);
    console.log({ threads })

    const backend = new UltraPlonkBackend(circuit.bytecode, { threads: threads });
    const executeRes = await noir.execute(proofInputs as any as InputMap);
    const proof = await backend.generateProof(executeRes.witness);
    const verifiedJs = await backend.verifyProof(proof)
    console.log({verifiedJs})

    return proof
}


export async function generateNoirTest(proofInputs:ProofInputs) {
const noirTest = `
#[test]
fn test_main() {
    let nullifier:              Field = ${proofInputs.nullifier};
    let chain_id:               Field = ${proofInputs.chain_id};
    let amount:                 Field = ${proofInputs.amount};
    let giga_root:              Field = ${proofInputs.giga_root};
    let destination_local_root: Field = ${proofInputs.destination_local_root};
    let fee_factor:             Field = ${proofInputs.fee_factor};
    let priority_fee:           Field = ${proofInputs.priority_fee};
    let max_fee:                Field = ${proofInputs.max_fee};
    let relayer_address:        Field = ${proofInputs.relayer_address};            
    let recipient_address:      Field = ${proofInputs.recipient_address};          

    // ----- private inputs -----
    let origin_local_root:      Field = ${proofInputs.origin_local_root};
    let is_from_aztec:          bool  = ${proofInputs.is_from_aztec};
    let nullifier_preimage:     Field = ${proofInputs.nullifier_preimage};
    let secret:                 Field = ${proofInputs.secret};
    let aztec_merkle_data: Aztec_merkle_data<40> = Aztec_merkle_data {
        leaf_index:                 ${proofInputs.aztec_merkle_data.leaf_index},
        hash_path:                  [${proofInputs.aztec_merkle_data.hash_path.toString()}],
        leaf_nonce:                 ${proofInputs.aztec_merkle_data.leaf_nonce},
        contract_address:           ${proofInputs.aztec_merkle_data.contract_address},
    };
    let evm_merkle_data: Evm_merkle_data<32> = Evm_merkle_data {
        leaf_index:                 ${proofInputs.evm_merkle_data.leaf_index},
        hash_path:                  [${proofInputs.evm_merkle_data.hash_path.toString()}],
    };
    let giga_merkle_data: Evm_merkle_data<5> = Evm_merkle_data {
        leaf_index:                 ${proofInputs.giga_merkle_data.leaf_index},
        hash_path:                  [${proofInputs.giga_merkle_data.hash_path.toString()}],
    };
    main(
        nullifier,
        chain_id,
        amount,
        giga_root,
        destination_local_root,
        fee_factor, 
        priority_fee,
        max_fee,
        relayer_address,              
        recipient_address,             
        origin_local_root, 
        is_from_aztec,
        nullifier_preimage, 
        secret,
        aztec_merkle_data,
        evm_merkle_data,
        giga_merkle_data,
    )
}
`
    const isFromAztec = proofInputs.is_from_aztec ? "is_from_aztec" : "not_from_aztec"
    await fs.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputsAsNoirTest.nr`, noirTest);
    await fs.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputs.json`, JSON.stringify(proofInputs,null,2));
    return noirTest
}