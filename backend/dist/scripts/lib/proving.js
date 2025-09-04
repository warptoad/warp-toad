"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectPXE = connectPXE;
exports.calculateFeeFactor = calculateFeeFactor;
exports.queryEventInChunks = queryEventInChunks;
exports.getWarptoadBurnEvents = getWarptoadBurnEvents;
exports.getEvmMerkleData = getEvmMerkleData;
exports.getGigaBridgeNewRootEvents = getGigaBridgeNewRootEvents;
exports.getGigaMerkleData = getGigaMerkleData;
exports.getAztecNoteHashTreeRoot = getAztecNoteHashTreeRoot;
exports.getBlockNumberOfGigaRoot = getBlockNumberOfGigaRoot;
exports.getLatestEvent = getLatestEvent;
exports.getGigaRootBlockNumber = getGigaRootBlockNumber;
exports.getLocalRootInGigaRoot = getLocalRootInGigaRoot;
exports.getL1BridgeAdapterAztec = getL1BridgeAdapterAztec;
exports.getAztecMerkleData = getAztecMerkleData;
exports.getMerkleData = getMerkleData;
exports.getProofInputs = getProofInputs;
exports.createProof = createProof;
exports.generateNoirTest = generateNoirTest;
// @ts-ignore
const bb_js_1 = require("@aztec/bb.js");
// @ts-ignore
const noir_js_1 = require("@noir-lang/noir_js");
const os_1 = __importDefault(require("os"));
//@ts-ignore
const withdraw_json_1 = __importDefault(require("../../circuits/withdraw/target/withdraw.json"));
const WarpToadCore_1 = require("../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore");
const ethers_1 = require("ethers");
const fixed_merkle_tree_1 = require("fixed-merkle-tree");
const hashing_1 = require("./hashing");
const constants_1 = require("./constants");
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
//@ts-ignore
const testing_1 = require("@aztec/accounts/testing");
const { PXE_URL = 'http://localhost:8080' } = process.env;
const poseidon_lite_1 = require("poseidon-lite");
const promises_1 = __importDefault(require("fs/promises"));
const bridging_1 = require("./bridging");
const abiCoder = new ethers_1.ethers.AbiCoder();
async function connectPXE() {
    console.log("creating PXE client");
    const PXE = (0, aztec_js_1.createPXEClient)(PXE_URL);
    console.log("waiting on PXE client", PXE_URL);
    await (0, aztec_js_1.waitForPXE)(PXE);
    console.log("getting test accounts");
    const wallets = await (0, testing_1.getInitialTestAccountsWallets)(PXE);
    return { wallets, PXE };
}
/**
 * kind of weird number but its the thing that is multiplied with (baseFee+priorityFee) to get the amount of tokens the relayers gets to compensate for gas fees.
 * @param ethPriceInToken       how many tokens need to buy 1 ETH (or other native gas token if the chain is weird)
 * @param gasCost               gas cost of the mint function. Should be a publicly agreed on number so the relayer knows what to expect
 * @param relayerBonusFactor    the factor on top of the fee to pay the relayer. Ex: 1.10 <= 10% earnings
 * @returns feeFactor
 */
function calculateFeeFactor(ethPriceInToken, gasCost, relayerBonusFactor) {
    return BigInt(Math.round(ethPriceInToken * gasCost * relayerBonusFactor));
}
// eth_getLogs limit of alchemy is 500, so  chunksize = 499
async function queryEventInChunks(contract, filter, firstBlock, lastBlock, reverseOrder = false, maxEvents = Infinity, chunksize = 499) {
    const provider = contract.runner.provider;
    lastBlock = lastBlock ? lastBlock : await provider.getBlockNumber();
    let allEvents = [];
    const scanLogic = async (index) => {
        const start = index * chunksize + firstBlock;
        // Math.min <= to ensure never go above lastBlock
        const stop = Math.min(start + chunksize, lastBlock);
        const events = await contract.queryFilter(filter, start, stop);
        console.log({ start, stop, events });
        return events;
    };
    const numIters = Math.ceil((lastBlock - firstBlock) / chunksize);
    console.log({ numIters });
    if (reverseOrder) {
        for (let index = numIters - 1; index >= 0; index--) {
            allEvents = [...(await scanLogic(index)), ...allEvents];
            if (allEvents.length >= maxEvents) {
                break;
            }
        }
    }
    else {
        for (let index = 0; index < numIters; index++) {
            allEvents = [...allEvents, ...(await scanLogic(index))];
            if (allEvents.length >= maxEvents) {
                break;
            }
        }
    }
    return allEvents;
}
async function getWarptoadBurnEvents(warpToadOrigin, localRootBlockNumber) {
    const chainId = (await warpToadOrigin.runner?.provider?.getNetwork())?.chainId;
    const deploymentBlock = constants_1.DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()];
    const filter = warpToadOrigin.filters.Burn();
    const events = await queryEventInChunks(warpToadOrigin, filter, deploymentBlock, localRootBlockNumber);
    return events;
}
async function getEvmMerkleData(warpToadOrigin, commitment, treeDepth, localRootBlockNumber) {
    const events = await getWarptoadBurnEvents(warpToadOrigin, localRootBlockNumber);
    const abiCoder = new ethers_1.ethers.AbiCoder();
    const types = ["uint256", "uint256"];
    const decodedEvents = events.map((event) => {
        const decodedData = abiCoder.decode(types, event.data);
        const commitment = BigInt(event.topics[1]);
        const amount = decodedData[0];
        const index = decodedData[1];
        return { commitment, amount, index };
    });
    const leafIndex = decodedEvents.find((e) => e.commitment === commitment)?.index;
    const leafs = decodedEvents.map((e) => e.commitment);
    //@ts-ignore
    const hashFunc = (left, right) => (0, poseidon_lite_1.poseidon2)([left, right]);
    //@ts-ignore
    const tree = new fixed_merkle_tree_1.MerkleTree(treeDepth, leafs, { hashFunction: hashFunc });
    if ((await warpToadOrigin.localRootHistory(tree.root)) === false) {
        throw new Error(`could not recreate the localRoot with events. Root that is recreated: ${tree.root}`);
    }
    if (!leafs.includes(commitment)) {
        throw new Error(`commitment: ${commitment} is not included in localRoot: ${tree.root}, which is build from events till blockNumber ${localRootBlockNumber}. 
        Either the commitment is in a localRoot that still has yet to be bridged, or (if deposited and withdrawn on the same chain) this commitments is not included onchain`);
    }
    const merkleData = {
        leaf_index: ethers_1.ethers.toBeHex(leafIndex),
        hash_path: tree.proof(commitment).pathElements.map((e) => ethers_1.ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    };
    return merkleData;
}
async function getGigaBridgeNewRootEvents(gigaBridge, allRootIndexes, gigaRootBlockNumber) {
    const chainId = (await gigaBridge.runner?.provider?.getNetwork())?.chainId;
    const deploymentBlock = constants_1.DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()];
    //@ts-ignore i hate typescript
    const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined, allRootIndexes, undefined);
    return await queryEventInChunks(gigaBridge, filter, deploymentBlock);
}
async function getGigaMerkleData(gigaBridge, localRoot, localRootIndex, treeDepth, gigaRootBlockNumber) {
    const amountOfLocalRoots = await gigaBridge.amountOfLocalRoots();
    const allRootIndexes = new Array(Number(amountOfLocalRoots)).fill(0).map((v, i) => ethers_1.ethers.toBeHex(i));
    //@ts-ignore i hate typescript
    // const filter = gigaBridge.filters.ReceivedNewLocalRoot(undefined,allRootIndexes,undefined)
    // const events = await gigaBridge.queryFilter(filter,0,"latest")
    const events = await getGigaBridgeNewRootEvents(gigaBridge, allRootIndexes, gigaRootBlockNumber);
    const eventsPerIndex = events.reduce((newObj, event) => {
        //@ts-ignore TODO do as typed gigaBridge event
        const index = ethers_1.ethers.toBeHex(event.args[1]);
        if (index in newObj) {
            newObj[index].push(event);
        }
        else {
            newObj[index] = [event];
        }
        return newObj;
    }, {});
    console.log({ allRootIndexes, eventsPerIndex });
    let sortedLeafs = [];
    for (const index of allRootIndexes) {
        if (index.toString() in eventsPerIndex) {
            sortedLeafs[ethers_1.ethers.toNumber(index)] = getLatestEvent(eventsPerIndex[index.toString()]).args[0]; //arg[0] = localRoot
        }
        else {
            console.log(`whoop this index wasn't in there: ${index}`);
            sortedLeafs[ethers_1.ethers.toNumber(index)] = 0n;
        }
    }
    //@ts-ignore
    const hashFunc = (left, right) => (0, poseidon_lite_1.poseidon2)([left, right]);
    //@ts-ignore
    const tree = new fixed_merkle_tree_1.MerkleTree(treeDepth, sortedLeafs, { hashFunction: hashFunc });
    console.log({ localRoot, localRootIndex, sortedLeafs });
    const merkleData = {
        leaf_index: ethers_1.ethers.toBeHex(localRootIndex),
        hash_path: tree.proof(localRoot).pathElements.map((e) => ethers_1.ethers.toBeHex(e)) // TODO actually take typescript seriously at some point
    };
    if (!sortedLeafs.includes(localRoot)) {
        throw new Error(`localRoot: ${localRoot} is not included in gigaRoot: ${tree.root}, which is build from events till blockNumber ${gigaRootBlockNumber}.`);
    }
    return merkleData;
}
async function getAztecNoteHashTreeRoot(blockNumber, PXE) {
    // do aztec things
    PXE = PXE ? PXE : (await connectPXE()).PXE;
    const block = await PXE.getBlock(blockNumber);
    return block?.header.state.partial.noteHashTree.root.toBigInt();
}
async function getBlockNumberOfGigaRoot(gigaBridge, gigaRoot) {
}
function getLatestEvent(events) {
    return events.reduce((latestEv, ev) => {
        if (latestEv.blockNumber > ev.blockNumber) {
            return latestEv;
        }
        else {
            return ev;
        }
    }, events[0]);
}
async function getGigaRootBlockNumber(gigaBridge, gigaRoot) {
    const filter = gigaBridge.filters.ConstructedNewGigaRoot(gigaRoot);
    const chainId = (await gigaBridge.runner?.provider?.getNetwork())?.chainId;
    const deploymentBlock = constants_1.DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()];
    const events = await queryEventInChunks(gigaBridge, filter, deploymentBlock, undefined, true, 1); // reverse order because we only need the most recent event
    console.log("gigaRootEvents: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { events });
    const gigaRootEvent = getLatestEvent(events); // someone can create the same gigaroot twice if they really try. Idk might not matter is this context
    const gigaRootBlockNumber = gigaRootEvent.blockNumber;
    return gigaRootBlockNumber;
}
//TODO clean this up. can prob be simpler
async function getLocalRootInGigaRoot(gigaBridge, gigaRoot, gigaRootBlockNumber, warpToadOrigin) {
    const isFromAztec = !("target" in warpToadOrigin);
    const l1BridgeAdapter = isFromAztec ? await getL1BridgeAdapterAztec(warpToadOrigin) : await warpToadOrigin.l1BridgeAdapter();
    const localRootIndex = await gigaBridge.getLocalRootProvidersIndex(l1BridgeAdapter);
    const newGigaRootFilter = gigaBridge.filters.ConstructedNewGigaRoot(gigaRoot);
    // const localRootFilter = gigaBridge.filters.ReceivedNewLocalRoot(undefined,localRootIndex)
    const chainId = (await gigaBridge.runner?.provider?.getNetwork())?.chainId;
    const deploymentBlock = constants_1.DEPLOYMENT_BLOCK_PER_CHAINID.WARPTOAD[chainId?.toString()];
    const newGigaRootEvents = await queryEventInChunks(gigaBridge, newGigaRootFilter, deploymentBlock, undefined, true, 1);
    const latestNewGigaRootEvent = getLatestEvent(newGigaRootEvents); // you can assume newGigaRootEvents[0] is fine but lets be safe this time!
    const newGigaRootTx = await latestNewGigaRootEvent.getTransactionReceipt(); //await newGigaRootEvents[0].getTransactionReceipt()
    const parsedEvents = (0, bridging_1.parseMultipleEventsFromTx)(newGigaRootTx, gigaBridge, "ReceivedNewLocalRoot");
    // i hate events
    const eventsOfThisWarpToadLocalRoot = parsedEvents.filter((e) => e.args[1] === localRootIndex);
    const latestEventLocalRoot = getLatestEvent(eventsOfThisWarpToadLocalRoot);
    const localRoot = latestEventLocalRoot.args[0];
    const localRootL2BlockNumber = latestEventLocalRoot.args[2];
    return { localRoot, localRootL2BlockNumber, gigaRootBlockNumber, localRootIndex };
}
async function getL1BridgeAdapterAztec(WarpToad) {
    const response = await WarpToad.methods.get_l1_bridge_adapter().simulate();
    const address = ethers_1.ethers.getAddress(ethers_1.ethers.toBeHex(response.inner)); // EthAddress type in aztec is a lil silly thats why
    return address;
}
async function getAztecMerkleData(WarpToad, commitment, destinationLocalRootBlock) {
    const { PXE } = await connectPXE();
    console.log("finding unique_note_hash index within the tx");
    const warpToadNoteFilter = {
        contractAddress: WarpToad.address,
        storageSlot: WarpToadCore_1.WarpToadCoreContract.storage.commitments.slot
    };
    const notes = await PXE.getNotes(warpToadNoteFilter);
    const currentNote = notes.find((n) => (0, hashing_1.hashCommitmentFromNoteItems)(n.note.items) === commitment);
    const siloedNoteHash = await (0, hashing_1.hashSiloedNoteHash)(WarpToad.address.toBigInt(), commitment);
    const uniqueNoteHash = await (0, hashing_1.hashUniqueNoteHash)(currentNote.noteNonce.toBigInt(), siloedNoteHash);
    const witness = await WarpToad.methods.get_note_proof(destinationLocalRootBlock, uniqueNoteHash).simulate();
    const merkleData = {
        leaf_index: ethers_1.ethers.toBeHex(witness.index),
        hash_path: witness.path.map((h) => ethers_1.ethers.toBeHex(h)),
        leaf_nonce: ethers_1.ethers.toBeHex(currentNote.noteNonce.toBigInt()),
        contract_address: ethers_1.ethers.toBeHex(WarpToad.address.toBigInt())
    };
    return merkleData;
}
async function getAztecLocalData() {
    const { PXE } = await connectPXE();
    const blockNumber = await PXE.getBlockNumber();
    const noteHashTreeRoot = await getAztecNoteHashTreeRoot(blockNumber, PXE);
    return { blockNumber, localRoot: noteHashTreeRoot };
}
async function getEvmLocalData(warpToadOrigin) {
    const provider = warpToadOrigin.runner?.provider;
    const blockNumber = BigInt(await provider?.getBlockNumber());
    const localRoot = await warpToadOrigin.cachedLocalRoot();
    return { blockNumber, localRoot };
}
// if you ever run into a bug with this. I am so sorry
async function getMerkleData(gigaBridge, warpToadOrigin, warpToadDestination, commitment) {
    const isToAztec = !("target" in warpToadDestination);
    const isFromAztec = !("target" in warpToadOrigin);
    const isOnlyLocal = warpToadDestination === warpToadOrigin;
    const gigaRoot = isToAztec ? await warpToadDestination.methods.get_giga_root().simulate() : await warpToadDestination.gigaRoot();
    console.log("getting gigaProof");
    let originLocalRoot;
    let gigaMerkleData;
    let destinationLocalRootL2Block;
    if (isOnlyLocal) {
        // get local root directly from the contract instead of extracting it from the gigaRoot (we wont use gigaRoot anyway)
        const { blockNumber, localRoot } = isFromAztec ? await getAztecLocalData() : await getEvmLocalData(warpToadOrigin);
        destinationLocalRootL2Block = blockNumber;
        originLocalRoot = localRoot;
        gigaMerkleData = constants_1.emptyGigaMerkleData;
    }
    else {
        // you need to get the local root from the event that created the gigaRoot. Other wise you might end up using a local root that hasn't been bridged into a gigaRoot yet ☝🤓
        const gigaRootBlockNumber = await getGigaRootBlockNumber(gigaBridge, gigaRoot);
        const { localRoot, localRootL2BlockNumber, localRootIndex: originLocalRootIndex } = await getLocalRootInGigaRoot(gigaBridge, gigaRoot, gigaRootBlockNumber, warpToadOrigin);
        originLocalRoot = localRoot;
        destinationLocalRootL2Block = localRootL2BlockNumber;
        gigaMerkleData = await getGigaMerkleData(gigaBridge, originLocalRoot, originLocalRootIndex, constants_1.GIGA_TREE_DEPTH, gigaRootBlockNumber);
    }
    console.log("getting localProof");
    let aztecMerkleData;
    let evmMerkleData;
    if (isFromAztec) {
        aztecMerkleData = await getAztecMerkleData(warpToadOrigin, commitment, Number(destinationLocalRootL2Block));
        evmMerkleData = constants_1.emptyEvmMerkleData;
    }
    else {
        aztecMerkleData = constants_1.emptyAztecMerkleData;
        evmMerkleData = await getEvmMerkleData(warpToadOrigin, commitment, constants_1.EVM_TREE_DEPTH, Number(destinationLocalRootL2Block));
    }
    return { isFromAztec, gigaMerkleData, evmMerkleData, aztecMerkleData, originLocalRoot, blockNumber: BigInt(destinationLocalRootL2Block) };
}
async function getProofInputs(gigaBridge, warpToadDestination, warpToadOrigin, // warptoadEvm = {WarpToadCore} from typechain-types and WarpToadAztec = {WarpToadCoreContract} from `aztec-nargo codegen` 
amount, feeFactor, priorityFee, maxFee, relayerAddress, recipientAddress, 
//private
nullifierPreImage, secret) {
    // TODO performance: do all these awaits concurrently 
    const chainId = (await warpToadDestination.runner?.provider?.getNetwork())?.chainId;
    const gigaRoot = await warpToadDestination.gigaRoot();
    const destinationLocalRoot = await warpToadDestination.cachedLocalRoot(); //TODO if this breaks. means you have to cache it first
    const preCommitment = (0, hashing_1.hashPreCommitment)(nullifierPreImage, secret, chainId);
    const commitment = (0, hashing_1.hashCommitment)(preCommitment, amount);
    const nullifier = (0, hashing_1.hashNullifier)(nullifierPreImage);
    const relayer = ethers_1.ethers.toBigInt(relayerAddress);
    const recipient = ethers_1.ethers.toBigInt(recipientAddress);
    const { isFromAztec, gigaMerkleData, evmMerkleData, aztecMerkleData, originLocalRoot } = await getMerkleData(gigaBridge, warpToadOrigin, warpToadDestination, commitment);
    const proofInputs = {
        // ----- public inputs -----
        nullifier: ethers_1.ethers.toBeHex(nullifier),
        chain_id: ethers_1.ethers.toBeHex(chainId),
        amount: ethers_1.ethers.toBeHex(amount),
        giga_root: ethers_1.ethers.toBeHex(gigaRoot),
        destination_local_root: ethers_1.ethers.toBeHex(destinationLocalRoot),
        fee_factor: ethers_1.ethers.toBeHex(feeFactor),
        priority_fee: ethers_1.ethers.toBeHex(priorityFee),
        max_fee: ethers_1.ethers.toBeHex(maxFee),
        relayer_address: ethers_1.ethers.toBeHex(relayer), // eth address left padded zeros / as bigInt
        recipient_address: ethers_1.ethers.toBeHex(recipient), // eth address left padded zeros
        // ----- private inputs -----
        origin_local_root: ethers_1.ethers.toBeHex(originLocalRoot),
        is_from_aztec: isFromAztec, //ethers.toBeHex(BigInt(isFromAztec)),
        nullifier_preimage: ethers_1.ethers.toBeHex(nullifierPreImage),
        secret: ethers_1.ethers.toBeHex(secret),
        aztec_merkle_data: aztecMerkleData,
        evm_merkle_data: evmMerkleData,
        giga_merkle_data: gigaMerkleData,
    };
    return proofInputs;
}
async function createProof(proofInputs, threads) {
    // TODO assumes that if window doesn't exist os does
    threads = threads ? threads : window ? window.navigator.hardwareConcurrency : os_1.default.cpus().length;
    const noir = new noir_js_1.Noir(withdraw_json_1.default);
    console.log({ threads });
    const backend = new bb_js_1.UltraPlonkBackend(withdraw_json_1.default.bytecode, { threads: threads });
    const executeRes = await noir.execute(proofInputs);
    const proof = await backend.generateProof(executeRes.witness);
    const verifiedJs = await backend.verifyProof(proof);
    console.log({ verifiedJs });
    return proof;
}
async function generateNoirTest(proofInputs) {
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
`;
    const isFromAztec = proofInputs.is_from_aztec ? "is_from_aztec" : "not_from_aztec";
    await promises_1.default.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputsAsNoirTest.nr`, noirTest);
    await promises_1.default.writeFile(`./out/${proofInputs.chain_id}-${isFromAztec}-proofInputs.json`, JSON.stringify(proofInputs, null, 2));
    return noirTest;
}
