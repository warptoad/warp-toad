//@ts-ignore
import {  Fr, PXE, EthAddress } from "@aztec/aztec.js"
import { ethers } from "ethers";
import { WarpToadCore as WarpToadEvm, USDcoin, PoseidonT3, LazyIMT, L1AztecRootBridgeAdapter, GigaRootBridge } from "../../typechain-types";
import {  L2AztecRootBridgeAdapterContract } from '../../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter'
import { WarpToadCoreContract as AztecWarpToadCore } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
//@ts-ignore
import { sha256ToField } from "@aztec/foundation/crypto";

/**
 * continues in updateGigaRoot
 * 
 * bridges noteHashTreeRoot from aztec L2 to L1 
 * L2aztecAdapter -> L1AztecAdapter 
 * after this gigaBridge can call L1AztecAdapter.getLocalRootAndBlock() and use that to make a new gigaRoot
 * @param PXE 
 * @param L2AztecRootBridgeAdapter 
 * @param L1AztecRootBridgeAdapter 
 * @param provider 
 * @returns 
 */
export async function bridgeNoteHashTreeRoot(
    PXE: PXE,
    L2AztecRootBridgeAdapter: L2AztecRootBridgeAdapterContract,
    L1AztecRootBridgeAdapter: L1AztecRootBridgeAdapter,
    provider: ethers.Provider,
) {

    await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();

    await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();

    await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();
    const blockNumberOfRoot = await PXE.getBlockNumber();
    const PXE_L2Root = (await PXE.getBlock(blockNumberOfRoot))?.header.state.partial.noteHashTree.root as Fr
    const sendRootToL1Tx = await L2AztecRootBridgeAdapter.methods.send_root_to_l1(blockNumberOfRoot).send().wait();

    const aztecChainVersion = await L1AztecRootBridgeAdapter.rollupVersion();
    const l1PortalAddress = L1AztecRootBridgeAdapter.target;
    const l1ChainId = (await provider.getNetwork()).chainId

    const messageContent = sha256ToField([ // does sha256(PXE_L2Root, blockNumberOfRoot) then removes the last byte and then adds byte(1) in front (to fit into a field)
        PXE_L2Root.toBuffer(),
        new Fr(blockNumberOfRoot).toBuffer(),
    ]);
    const l2Bridge = L2AztecRootBridgeAdapter.address;
    const messageLeaf = sha256ToField([
        l2Bridge.toBuffer(),
        new Fr(aztecChainVersion).toBuffer(),
        EthAddress.fromString(l1PortalAddress.toString()).toBuffer32() ?? Buffer.alloc(32, 0),
        new Fr(l1ChainId).toBuffer(),
        messageContent.toBuffer(),
    ]);

    const witnessBlocknumber =  await PXE.getBlockNumber() // any block number after send_root_to_l1 happened
    const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
        witnessBlocknumber, 
        //@ts-ignore some bs where the Fr type that getL2ToL1MembershipWitness wants is different messageLeaf has
        messageLeaf
    );
    const siblingPathArray = siblingPath.toFields().map((f) => f.toString())

    const refreshRootTx = await (await L1AztecRootBridgeAdapter.getNewRootFromL2(
        PXE_L2Root.toString(),
        BigInt(blockNumberOfRoot), // has to be the same block as when as the root bridged. since this function uses it to create the content_hash
        BigInt(witnessBlocknumber), // hash to be the same block as the witness was retrieved since that is what the witness will be proved against
        l2ToL1MessageIndex,
        siblingPathArray
    )).wait(1) as ethers.ContractTransactionReceipt;

    return {refreshRootTx, sendRootToL1Tx, PXE_L2Root}
}
/**
 * happens after bridgeNoteHashTreeRoot()
 * continues in sendGigaRoot()
 * 
 * calls the gigaBridge contract to collect all bridged localRoot from the L1Adapters (and L1warpToad) and use it to create a new gigaRoot 
 * after this function gigaBridge.sendRoot can be called to send the gigaRoot to all L2s (and L1warpToad)
 * @param gigaBridge 
 * @param localRootProviders everyone who has a localRoot: L1warpToad + all L1<L2Name>Adapters
 * @returns 
 */
export async function updateGigaRoot(
    gigaBridge: GigaRootBridge,
    localRootProviders: ethers.AddressLike[]
) {
    const gigaRootUpdateTx = await (await gigaBridge.updateRoot(
        localRootProviders
    )).wait(1) as ethers.ContractTransactionReceipt;
    // todo check id tree reproduces by syncing events
    // TODO make sure the gigaBridge contract also emits events updatedLocalRoot(indexed index, localRoot
    return {gigaRootUpdateTx}
}


/**
 * happens after updateGigaRoot()
 * continues in: [receiveGigaRootOnAztec, etc]
 * 
 * sends the gigaRoot to all L1 adapter (and L1Warptoad) so it can be bridged.
 * Depending on the native bridge of the L2, the message either automatically arrives or needs to be initiated by a EOA (like with receiveGigaRootOnAztec)
 * @param gigaBridge 
 * @param gigaRootRecipients same as localRootProviders but here they receive a gigaRoot!
 * @param isSandBox 
 * @returns 
 */
export async function sendGigaRoot(
    gigaBridge: GigaRootBridge,
    gigaRootRecipients: ethers.AddressLike[],
) {
    // sends the root to the L2AztecRootBridgeAdapter through the L1AztecRootBridgeAdapter
    const sendGigaRootTx = await (await gigaBridge.sendRoot(
        gigaRootRecipients
    )
    ).wait(1) as ethers.ContractTransactionReceipt;

    return {sendGigaRootTx}
}


/**
 * happens after sendGigaRoot
 * makes the L2AztecRootBridgeAdapter retrieve the gigaRoot from the native aztec bridge on L2
 * @param params 
 * @returns 
 */
export async function receiveGigaRootOnAztec(
    L2AztecRootBridgeAdapter: L2AztecRootBridgeAdapterContract,
    L1AztecRootBridgeAdapter: L1AztecRootBridgeAdapter,
    AztecWarpToad: AztecWarpToadCore,
    sendGigaRootTx: ethers.TransactionReceipt, // either get it from sendGigaRoot. or event scan for a specific gigaRoot with "NewGigaRootSentToL2"
    PXE: PXE,
    isSandBox?: boolean,
    
) {
    // auto detects based on chainId (they cant stop me from making cursed one liners >:) )
    isSandBox = (isSandBox === undefined) ? 31337n === (await L1AztecRootBridgeAdapter.runner?.provider?.getNetwork())?.chainId : isSandBox
    // contenthash is just gigaRoot in this case since we only need to bridge 1 Field but normally its sha256ToField(_newL2Root.toBuffer(), _l2BlockNumber.toBuffer()))
    // sha256ToField = hashing with sha256 and then making that hash fit into a field somehow. (it just removes the last byte and then adds byte(1) in front)
    const parsedL1AdapterEvent = parseEventFromTx(sendGigaRootTx, L1AztecRootBridgeAdapter, "NewGigaRootSentToL2") 
    const content_hash = parsedL1AdapterEvent!.args[0]; 
    const key = parsedL1AdapterEvent!.args[1];                          
    const index = parsedL1AdapterEvent!.args[2];


    const blocksToWait = 2 //should be NewGigaRootSentToL2Event.tx.blocknumber + 2
    if (isSandBox) {
        // this is to make the sandbox progress n blocks
        await L2AztecRootBridgeAdapter.methods.count(0n).send().wait();
        await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();
    } else {
        console.warn("isSandBox is not set or detected. I hope ur indeed not on sandbox because it will break if u are!")
        await waitForBlocksAztec(blocksToWait, PXE);
    }

    const update_gigarootTx = await L2AztecRootBridgeAdapter.methods.update_gigaroot(content_hash, index, AztecWarpToad.address).send().wait();
    return {update_gigarootTx}
}

export async function waitForBlocksAztec(blocksToWait:number, PXE:PXE) {
    const L1BlockTime = 12000
    const blockBeforeWaiting = await PXE.getBlockNumber()
    const waitTillBlock = blockBeforeWaiting + blocksToWait
    let waiting = true
    while(waiting) {
        const currentBlock = await PXE.getBlockNumber()
        waiting = currentBlock < waitTillBlock
        console.log(`waiting ${ L1BlockTime/2*blocksToWait / 1000 } seconds until ${blocksToWait} aztec blocks has passed. blocks passed: ${currentBlock-blockBeforeWaiting}`)
        if (waiting) {
            await new Promise((resolve)=>setTimeout(resolve, L1BlockTime/2*blocksToWait)) 
        }
    }
}

export function parseEventFromTx(tx: ethers.TransactionReceipt, contract: ethers.Contract | any, eventName: string) {
    const sendGigaRootEvent = tx.logs.find(
        (log) => log.topics[0] === contract.interface.getEvent(eventName)?.topicHash
    );

    // Parse the event data
    const parsedEvent = contract.interface.parseLog({
        topics: sendGigaRootEvent!.topics,
        data: sendGigaRootEvent!.data
    });
    return parsedEvent

}

export function parseMultipleEventsFromTx(tx: ethers.TransactionReceipt, contract: ethers.Contract | any, eventName: string) {
    console.log({tx, logs: tx.logs})
    const events = tx.logs.filter(
        (log) => log.topics[0] === contract.interface.getEvent(eventName)?.topicHash
    );

    // Parse the event data
    const parsedEvents = events.map((e)=>contract.interface.parseLog({
        topics: e!.topics,
        data: e!.data
    })) 
    return parsedEvents
}