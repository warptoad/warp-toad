import { UltraHonkBackend, UltraPlonkBackend } from "@aztec/bb.js";
// @ts-ignore
import { CompiledCircuit, Noir, InputMap } from "@noir-lang/noir_js";
import os from 'os';
import circuit from "../../circuits/withdraw/target/withdraw.json"
import { ProofData } from "@aztec/bb.js";

import { WarpToadCore as WarpToadEvm } from "../../typechain-types";
import { WarpToadCoreContract as WarpToadAztec } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { BytesLike, ethers } from "ethers";
import { MerkleTree, Element } from "fixed-merkle-tree";
import { findNoteHashIndex, hashCommitment, hashNullifier, hashPreCommitment, hashUniqueNoteHash , hashCommitmentFromNoteItems, hashSiloedNoteHash} from "./hashing";
import { EVM_TREE_DEPTH, AZTEC_TREE_DEPTH, emptyAztecMerkleData, emptyGigaMerkleData, emptyLocalMerkleData, GIGA_TREE_DEPTH } from "./constants";

//@ts-ignore
import { createPXEClient, waitForPXE,NotesFilter, AztecAddress } from "@aztec/aztec.js";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";

import { ProofInputs, EvmMerkleData, AztecMerkleData, } from "./types";

const { PXE_URL = 'http://localhost:8080' } = process.env;


import { poseidon2 } from "poseidon-lite";

import fs from "fs/promises";

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

async function getEvmMerkleData(warpToadOrigin: WarpToadEvm, commitment: bigint, treeDepth: number) {
    console.warn("warning event scanning code sucks and will break outside tests")
    // TODO do proper event scanning. This will break in prod
    const filter = warpToadOrigin.filters.Burn()
    const events = await warpToadOrigin.queryFilter(filter, 0) // this goes from 0 to latest. No rpc can do that! this will break outside tests!!
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
    const MerkleData = {
        leaf_index: ethers.toBeHex(leafIndex),
        hash_path: tree.proof(commitment as any as Element).pathElements.map((e) => ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    } as EvmMerkleData

    return MerkleData
}

export async function getAztecNoteHashTreeRoot(blockNumber:number): Promise<bigint> {
    // do aztec things
    const PXE = await connectPXE()
    const block = await PXE.PXE.getBlock(blockNumber)
    return block?.header.state.partial.noteHashTree.root.toBigInt() as bigint
}

export async function getAztecMerkleData(WarpToad:WarpToadAztec, commitment:bigint, latestBridgedBlockNumber: number): Promise<AztecMerkleData>  {
    const {PXE} = await connectPXE()
    console.log("finding unique_note_hash index within the tx")
    const warpToadNoteFilter:NotesFilter = {
        contractAddress: WarpToad.address, 
        storageSlot: WarpToadAztec.storage.commitments.slot
    }
    const notes = await PXE.getNotes(warpToadNoteFilter)
    // WarpToadAztec.notes.WarpToadNote.fields notes[0].note
    const currentNote = notes.find((n)=> hashCommitmentFromNoteItems(n.note.items) === commitment);
    const siloedNoteHash = await hashSiloedNoteHash(WarpToad.address.toBigInt() ,commitment)
    const uniqueNoteHash = await hashUniqueNoteHash(currentNote!.nonce.toBigInt(),siloedNoteHash)
    const witness = await WarpToad.methods.get_note_proof(latestBridgedBlockNumber,uniqueNoteHash ).simulate()
    const merkleData: AztecMerkleData = {
        leaf_index: ethers.toBeHex(witness.index),
        hash_path: witness.path.map((h:bigint)=>ethers.toBeHex(h)),
        leaf_nonce: ethers.toBeHex(currentNote!.nonce.toBigInt()),
        // contract_address: {
        //     inner: ethers.toBeHex(WarpToad.address.toBigInt())
        // }
        contract_address: ethers.toBeHex(WarpToad.address.toBigInt())
    }
    return merkleData
}

export async function getProofInputs(
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
    const destinationLocalRoot = await warpToadDestination.localRoot()

    const preCommitment = hashPreCommitment(nullifierPreImage, secret, chainId)
    const commitment = hashCommitment(preCommitment, amount)
    const nullifier = hashNullifier(nullifierPreImage)

    const relayer = ethers.toBigInt(relayerAddress as BytesLike)
    const recipient = ethers.toBigInt(recipientAddress as BytesLike)

    //if ( typeof(warpToadOrigin) == WarpToadCore  ) 
    // ^ what i tried to do but typescripts sucks. instead we just guess by checking if it has "target" and pray that that wont be part of aztecContracts interfaces in the future
    const isFromAztec = !("target" in warpToadOrigin);
    const isOnlyLocal = warpToadDestination === warpToadOrigin;
    const evmMerkleData: EvmMerkleData = isFromAztec ? emptyLocalMerkleData : await getEvmMerkleData(warpToadOrigin, commitment, EVM_TREE_DEPTH)
    
    const {PXE} = isFromAztec ? await connectPXE() : {PXE:undefined} // TODO  const = isFromAztec ? happens too ofter do something cleaner
    const aztecLatestBridgedBlockNumber = isFromAztec ? (await PXE!.getBlockNumber() ) -1: undefined// TODO not the way to do it. Bridging contract should track this
    const aztecMerkleData: AztecMerkleData = isFromAztec ? await getAztecMerkleData(warpToadOrigin, commitment, aztecLatestBridgedBlockNumber as number) : emptyAztecMerkleData; // TODO obviously when on aztec should not also be empty
    //const aztecMerkleData: AztecMerkleData = isFromAztec ? emptyAztecMerkleData: emptyAztecMerkleData
    const originLocalRoot: bigint = isFromAztec ? await getAztecNoteHashTreeRoot(aztecLatestBridgedBlockNumber as number) : await warpToadOrigin.localRoot();
    // TODO make this a 2 function that 1 that returns originLocalRoot for both evm and aztecMerkleData

    const gigaMerkleData: EvmMerkleData = isOnlyLocal ? emptyGigaMerkleData : emptyGigaMerkleData //doesn't work-> await generateEvmMerkleData(warpToadDestination, originLocalRoot, GIGA_TREE_DEPTH);

    // TODO local_merkle_data
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
        local_merkle_data: evmMerkleData,
        giga_merkle_data: gigaMerkleData,
    }
    return proofInputs
}

export async function createProof(proofInputs: ProofInputs, threads: number | undefined): Promise<ProofData> {
    // TODO assumes that if window doesn't exist os does
    threads = threads ? threads : window ? window.navigator.hardwareConcurrency : os.cpus().length
    console.log("initializing noir with circuit")
    const noir = new Noir(circuit as CompiledCircuit);
    console.log({ threads })
    console.log("initializing backend")
    const backend = new UltraPlonkBackend(circuit.bytecode, { threads: threads });
    // ill never figure out how to do typescript properly lmao
    console.log("generating zkproof witness")
    const executeRes = await noir.execute(proofInputs as any as InputMap);
    console.log("generating proof")
    const proof = await backend.generateProof(executeRes.witness);
    
    //debug. TODO maybe make separate script for this?
    const noirTest = generateNoirTest(proofInputs)
    const isFromAztec = proofInputs.is_from_aztec ? "is_from_aztec" : "not_from_aztec"
    await fs.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputsAsNoirTest.nr`, noirTest);
    await fs.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputs.json`, JSON.stringify(proofInputs,null,2));
    return proof
}

export function generateNoirTest(proofIputs:ProofInputs) {
return`
#[test]
fn test_main() {
    let nullifier:              Field = ${proofIputs.nullifier};
    let chain_id:               Field = ${proofIputs.chain_id};
    let amount:                 Field = ${proofIputs.amount};
    let giga_root:              Field = ${proofIputs.giga_root};
    let destination_local_root: Field = ${proofIputs.destination_local_root};
    let fee_factor:             Field = ${proofIputs.fee_factor};
    let priority_fee:           Field = ${proofIputs.priority_fee};
    let max_fee:                Field = ${proofIputs.max_fee};
    let relayer_address:        Field = ${proofIputs.relayer_address};            
    let recipient_address:      Field = ${proofIputs.recipient_address};          

    // ----- private inputs -----
    let origin_local_root:      Field = ${proofIputs.origin_local_root};
    let is_from_aztec:          bool  = ${proofIputs.is_from_aztec};
    let nullifier_preimage:     Field = ${proofIputs.nullifier_preimage};
    let secret:                 Field = ${proofIputs.secret};
    let aztec_merkle_data: Aztec_merkle_data<40> = Aztec_merkle_data {
        leaf_index:                 ${proofIputs.aztec_merkle_data.leaf_index},
        hash_path:                  [${proofIputs.aztec_merkle_data.hash_path.toString()}],
        leaf_nonce:                 ${proofIputs.aztec_merkle_data.leaf_nonce},
        contract_address:           ${proofIputs.aztec_merkle_data.contract_address},
    };
    let local_merkle_data: Evm_merkle_data<32> = Evm_merkle_data {
        leaf_index:                 ${proofIputs.local_merkle_data.leaf_index},
        hash_path:                  [${proofIputs.local_merkle_data.hash_path.toString()}],
    };
    let giga_merkle_data: Evm_merkle_data<5> = Evm_merkle_data {
        leaf_index:                 ${proofIputs.giga_merkle_data.leaf_index},
        hash_path:                  [${proofIputs.giga_merkle_data.hash_path.toString()}],
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
        local_merkle_data,
        giga_merkle_data,
    )
}
`
}