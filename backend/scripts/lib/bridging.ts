//@ts-ignore
import { Fr, PXE, EthAddress, SponsoredFeePaymentMethod, FieldsOf, TxReceipt, ContractBase as AztecContract } from "@aztec/aztec.js"
import { ethers } from "ethers";
import { WarpToadCore as WarpToadEvm, USDcoin, PoseidonT3, LazyIMT, L1AztecBridgeAdapter, GigaBridge, L2ScrollBridgeAdapter, ILocalRootProvider__factory, IL1BridgeAdapter__factory, L1AztecBridgeAdapter__factory, IL1ScrollMessenger__factory, L1ScrollBridgeAdapter, L2WarpToad as L2WarpToadEVM } from "../../typechain-types";
import { L2AztecBridgeAdapterContract } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter'
import { WarpToadCoreContract as L2WarpToadAZTEC } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
//@ts-ignore
import { sha256ToField } from "@aztec/foundation/crypto";
import { getContractAddressesEvm } from "../dev_op/utils";
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA } from "./constants";
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type L1Adapter = L1AztecBridgeAdapter | L1ScrollBridgeAdapter;
export type L2Adapter = L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract
export type L2WarpToad = L2WarpToadAZTEC | L2WarpToadEVM
const chainIds = {
    scroll: {
        testnet: 534351n,
        mainnet: 534352n
    }
}

export async function getLocalRootProviders(chainId: bigint) {
    const contracts = await getContractAddressesEvm(chainId)
    return [contracts["L1WarpToadModule#L1WarpToad"], contracts["L1InfraModule#L1AztecBridgeAdapter"], contracts["L1InfraModule#L1ScrollBridgeAdapter"]]
}

export async function getPayableGigaRootRecipients(chainId: bigint) {
    const contracts = await getContractAddressesEvm(chainId)
    return [contracts["L1InfraModule#L1ScrollBridgeAdapter"]].filter((v) => v !== undefined)
}

async function getNonPayableLocalRootProviders(chainId: bigint) {
    const contracts = await getContractAddressesEvm(chainId)
    return [contracts["L1WarpToadModule#L1WarpToad"], contracts["L1InfraModule#L1AztecBridgeAdapter"]].filter((v) => v !== undefined)
}
export async function getL1ClaimDataScrollBridgeApi(l2BridgeInitiationContract: ethers.AddressLike, txHash?: ethers.BytesLike, pageSize = 10) {
    let result = undefined
    let page = 1
    while (result === undefined) {
        const apiRes = await fetch(`https://sepolia-api-bridge-v2.scroll.io/api/l2/unclaimed/withdrawals?address=${l2BridgeInitiationContract}&page=${page}&page_size=${pageSize}`)
        const apiResJson = await apiRes.json()
        if (apiResJson.data.results === null) {
            result = undefined
            break;
        } else {
            if (txHash) {
                result = apiResJson.data.results.find((v: any) => v.hash === txHash)
            } else {
                result = apiResJson.data.results !== null ? apiResJson.data.results[0] : undefined
            }
            if (result !== undefined) {
                break
            } else {
                page += 1
            }
        }
    }
    return result
}

export async function getClaimDataScroll(adapterContract: ethers.AddressLike, txHash?: ethers.BytesLike) {
    let claimData = undefined
    while (claimData === undefined) {
        const result = await getL1ClaimDataScrollBridgeApi(adapterContract, txHash)
        claimData = result && result.claim_info !== null ? result.claim_info : undefined
        if (claimData !== undefined) {
            break;
        } else {
            // if (result) {
            //     console.log(`results where found for address: ${adapterContract} with txHash ${txHash} but no claim_info, checking again in 30 minutes.`)
            // } else {
            //     console.log(`NO RESULTS FOUND for address: ${adapterContract} with txHash ${txHash}, checking again in 30 minutes.`)
            // }
            await sleep(1800000)
        }
    }
    return claimData
}

export async function claimL1WithdrawScroll(claimInfo: any, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const chainId = (await signer.provider?.getNetwork())?.chainId
    const IS_MAINNET = chainId === 1n
    const L1_SCROLL_MESSENGER = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    const L1ScrollMessenger = IL1ScrollMessenger__factory.connect(L1_SCROLL_MESSENGER, signer)
    const tx = await L1ScrollMessenger.relayMessageWithProof(
        ethers.getAddress(claimInfo.from),
        ethers.getAddress(claimInfo.to),
        BigInt(claimInfo.value),
        BigInt(claimInfo.nonce),
        ethers.hexlify(claimInfo.message),
        {
            batchIndex: BigInt(claimInfo.proof.batch_index),
            merkleProof: ethers.hexlify(claimInfo.proof.merkle_proof)
        }
    )
    return tx
}
export async function bridgeEVMLocalRootToL1(L2Adapter: L2ScrollBridgeAdapter, signer: ethers.Signer): Promise<ethers.TransactionReceipt> {
    // TODO
    const provider = L2Adapter.runner?.provider
    const chainId = (await provider?.getNetwork())!.chainId
    switch (chainId) {
        case chainIds.scroll.testnet:
        case chainIds.scroll.mainnet:
            const L2ToL1Tx = await (await L2Adapter["sentLocalRootToL1()"]()).wait(1)
            const claimData = await getClaimDataScroll(L2Adapter.target, L2ToL1Tx?.hash)
            const tx = await (await claimL1WithdrawScroll(claimData, signer)).wait(1)
            return tx as ethers.ContractTransactionReceipt
        default:
            throw new Error(`unknown chainId: ${Number(chainId)}`);
    }
}


/**
 * continues in updateGigaRoot
 * 
 * bridges noteHashTreeRoot from aztec L2 to L1 
 * L2aztecAdapter -> L1AztecAdapter 
 * after this gigaBridge can call L1AztecAdapter.getLocalRootAndBlock() and use that to make a new gigaRoot
 * @param PXE 
 * @param L2AztecBridgeAdapter 
 * @param L1AztecBridgeAdapter 
 * @param provider 
 * @returns 
 */
export async function bridgeAZTECLocalRootToL1(
    PXE: PXE,
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    provider: ethers.Provider,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined
) {
    const blockNumberOfRoot = await PXE.getBlockNumber();
    const PXE_L2Root = (await PXE.getBlock(blockNumberOfRoot))?.header.state.partial.noteHashTree.root as Fr
    const sendRootToL1Tx = await L2AztecBridgeAdapter.methods.send_root_to_l1(blockNumberOfRoot).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });

    const l1ChainId = (await provider.getNetwork()).chainId
    const messageContent = sha256ToField([ // does sha256(PXE_L2Root, blockNumberOfRoot) then removes the last byte and then adds byte(1) in front (to fit into a field)
        PXE_L2Root.toBuffer(),
        new Fr(blockNumberOfRoot).toBuffer(),
    ]);

    const isSandBox = l1ChainId === 31337n
    if (!isSandBox) {
        const blocksToWait = 10
        await waitForBlocksAztec(blocksToWait, PXE)
    }

    const sendRootEffect = await PXE.getTxEffect(sendRootToL1Tx.txHash)
    const messageLeaf = sendRootEffect?.data.l2ToL1Msgs[0] as Fr ///sha256ToField([

    const witnessBlocknumber = sendRootEffect?.l2BlockNumber as number//await PXE.getBlockNumber(); // the blockNumber of when send_root_to_l1 settled onchain
    const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
        witnessBlocknumber,
        //@ts-ignore some bs where the Fr type that getL2ToL1MembershipWitness wants is different messageLeaf has
        messageLeaf
    );
    const siblingPathArray = siblingPath.toFields().map((f: any) => f.toString())

    // console.log("got witness")
    // console.log("getNewRootFromL2", {
    //     PXE_L2Root: PXE_L2Root.toString(),
    //     blockNumberOfRoot: BigInt(blockNumberOfRoot), // has to be the same block as when as the root bridged. since this function uses it to create the content_hash
    //     witnessBlocknumber: BigInt(witnessBlocknumber), // hash to be the same block as the witness was retrieved since that is what the witness will be proved against
    //     l2ToL1MessageIndex,
    //     siblingPathArray
    // })
    const args = [
        PXE_L2Root.toString(),
        BigInt(blockNumberOfRoot), // has to be the same block as when as the root bridged. since this function uses it to create the content_hash
        BigInt(witnessBlocknumber), // hash to be the same block as the witness was retrieved since that is what the witness will be proved against
        l2ToL1MessageIndex,
        siblingPathArray
    ]
    const waitFunc = async () => await waitForBlocksAztec(10, PXE)
    const refreshRootTx = await (await tryUntilItWorks(
        L1AztecBridgeAdapter,
        "getNewRootFromL2",
        args,
        waitFunc
    )).wait(3) as ethers.ContractTransactionReceipt

    return { refreshRootTx, sendRootToL1Tx, PXE_L2Root }
}

export async function bridgeLocalRootToL1(l1Wallet: ethers.Signer, gigaBridge: GigaBridge, L1Adapter: L1Adapter, L2Adapter: L2Adapter, isAztec?: boolean, PXE?: PXE, sponsoredPaymentMethodAZTEC?: SponsoredFeePaymentMethod) {
    const l1Provider = L1Adapter.runner?.provider as ethers.Provider

    if (isAztec) {
        if (PXE === undefined || sponsoredPaymentMethodAZTEC == undefined) { throw new Error("PXE and sponsoredPaymentMethodAZTEC cant be undefined when isAztec = true") }
        const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeAZTECLocalRootToL1(
            PXE as PXE,
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            l1Provider,
            sponsoredPaymentMethodAZTEC
        )
        const gigaRootPreBridge = await gigaBridge.gigaRoot()
        return {sendRootToL1Tx, sendRootToL1TxHash: sendRootToL1Tx.txHash}
    } else {
        const sendRootToL1Tx = await bridgeEVMLocalRootToL1(L2Adapter as L2ScrollBridgeAdapter, l1Wallet)
        return {sendRootToL1Tx, sendRootToL1TxHash: sendRootToL1Tx.hash}
    }

}

/**
 * happens after bridgeNoteHashTreeRoot()
 * continues in sendGigaRoot()
 * 
 * calls the gigaBridge contract to collect all bridged localRoot from the L1Adapters (and L1warpToad) and use it to create a new gigaRoot 
 * after this function gigaBridge.sendGigaRoot can be called to send the gigaRoot to all L2s (and L1warpToad)
 * @param gigaBridge 
 * @param localRootProviders everyone who has a localRoot: L1warpToad + all L1<L2Name>Adapters
 * @returns 
 */
export async function updateGigaRoot(
    gigaBridge: GigaBridge,
    localRootProviders: ethers.AddressLike[]
) {
    const provider = gigaBridge.runner?.provider
    // things break if a localRootProvider does not have a root (localRoot = 0n)
    const isValidLocalRootProviders = await Promise.all(localRootProviders.map(async (localProviderAddr) => {
        // TODO make an interface because not every localRootProvider is L1AztecBridgeAdapter
        const localRootProvider = L1AztecBridgeAdapter__factory.connect(localProviderAddr as string, provider)
        try {
            if (await localRootProvider.mostRecentL2Root() !== 0n && await localRootProvider.mostRecentL2RootBlockNumber() !== 0n) {
                return true
            } else {
                console.log(`${localProviderAddr} has not received a L2 root yet and will be skipped in updating the gigaRoot`)
                return false
            }

        } catch (error) {
            // TODO L1WarpToad doesn't have mostRecentL2Root and mostRecentL2RootBlockNumber, but is a LocaRootProvider
            // TODO standardize that interface you silly!
            // and yes this is a cheap workaround lol
            return true
        }
    }))
    const validLocalRootProviders = localRootProviders.filter((v, i) => isValidLocalRootProviders[i])
    console.log({ validLocalRootProviders, localRootProviders })
    const gigaRootUpdateTx = await (await gigaBridge.updateGigaRoot(
        validLocalRootProviders
    )).wait(3) as ethers.ContractTransactionReceipt;
    // todo check id tree reproduces by syncing events
    // TODO make sure the gigaBridge contract also emits events updatedLocalRoot(indexed index, localRoot
    return { gigaRootUpdateTx, gigaRootUpdateTxHash: gigaRootUpdateTx.hash }
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
    gigaBridge: GigaBridge,
    gigaRootRecipients: ethers.AddressLike[],
    allPayableGigaRootRecipients: ethers.AddressLike[]
) {
    const defaultEthAmountGas = 5n * 10n ** 16n;
    const amounts = gigaRootRecipients.map((v: any) => {
        if (allPayableGigaRootRecipients.includes(v)) {
            return defaultEthAmountGas
        } else {
            return 0n
        }
    })
    const totalEth = BigInt(allPayableGigaRootRecipients.length) * defaultEthAmountGas
    // sends the root to the L2AztecBridgeAdapter through the L1AztecBridgeAdapter
    const sendGigaRootTx = await (await gigaBridge["sendGigaRoot(address[],uint256[])"](gigaRootRecipients, amounts, { value: totalEth })).wait(3) as ethers.ContractTransactionReceipt;
    const log = sendGigaRootTx.logs.map(log => gigaBridge.interface.parseLog(log)).find(log => log!.name === "SentGigaRoot");
    const gigaRootSent = log!.args.gigaRoot.toString();

    return { sendGigaRootTx, sendGigaRootTxHash: sendGigaRootTx.hash, gigaRootSent }
}

// /**
//  * happens after updateGigaRoot()
//  * continues in: [receiveGigaRootOnAztec, etc]
//  * 
//  * sends the gigaRoot to all L1 adapter (and L1Warptoad) so it can be bridged.
//  * Depending on the native bridge of the L2, the message either automatically arrives or needs to be initiated by a EOA (like with receiveGigaRootOnAztec)
//  * @param gigaBridge 
//  * @param gigaRootRecipients same as localRootProviders but here they receive a gigaRoot!
//  * @param isSandBox 
//  * @returns 
//  */
// export async function sendGigaRootPayable(
//     gigaBridge: GigaBridge,
//     gigaRootRecipients: ethers.AddressLike[],
//     amounts: bigint[]
// ) {
//     // sends the root to the L2AztecBridgeAdapter through the L1AztecBridgeAdapter
//     console.log("now pls dont break sendGigaRootPayable")
//     const pendingTxs = []
//     for (const [index, recipient] of gigaRootRecipients.entries()) {
//         const amount = amounts[Number(index)]
//         console.log({recipient,  override: {value:amount} });
//         pendingTxs.push(
//             (await gigaBridge.sendGigaRootPayable(recipient, {value:amount})).wait(3)
//         )
//     }
//     return {sendGigaRootTxs: await Promise.all(pendingTxs)} 
// }



/**
 * happens after sendGigaRoot
 * makes the L2AztecBridgeAdapter retrieve the gigaRoot from the native aztec bridge on L2
 * @param params 
 * @returns 
 */
export async function receiveGigaRootOnAztec(
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    AztecWarpToad: L2WarpToadAZTEC,
    sendGigaRootTx: ethers.TransactionReceipt, // either get it from sendGigaRoot. or event scan for a specific gigaRoot with "NewGigaRootSentToAztec"
    PXE: PXE,
    isSandBox?: boolean,
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod | undefined

) {
    // auto detects based on chainId (they cant stop me from making cursed one liners >:) )
    isSandBox = (isSandBox === undefined) ? 31337n === (await L1AztecBridgeAdapter.runner?.provider?.getNetwork())?.chainId : isSandBox
    // contenthash is just gigaRoot in this case since we only need to bridge 1 Field but normally its sha256ToField(_newL2Root.toBuffer(), _l2BlockNumber.toBuffer()))
    // sha256ToField = hashing with sha256 and then making that hash fit into a field somehow. (it just removes the last byte and then adds byte(1) in front)
    const parsedL1AdapterEvent = parseEventFromTx(sendGigaRootTx, L1AztecBridgeAdapter, "NewGigaRootSentToAztec")
    const content_hash = parsedL1AdapterEvent!.args[0];
    const key = parsedL1AdapterEvent!.args[1];
    const index = parsedL1AdapterEvent!.args[2];


    const blocksToWait = 10//should be NewGigaRootSentToAztecEvent.tx.blocknumber + 2

    if (isSandBox) {
        // this is to make the sandbox progress n blocks
        await L2AztecBridgeAdapter.methods.count(0n).send().wait();
        await L2AztecBridgeAdapter.methods.count(4n).send().wait();
    } else {
        console.warn("isSandBox is not set or detected. I hope ur indeed not on sandbox because it will break if u are!")
        await waitForBlocksAztec(blocksToWait, PXE);
    }

    const receiveGigaRootTx = await L2AztecBridgeAdapter.methods.receive_giga_root(content_hash, index, AztecWarpToad.address).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });
    return { receiveGigaRootTx }
}

export async function waitForBlocksAztec(blocksToWait: number, PXE: PXE) {
    const L1BlockTime = 12000
    const blockBeforeWaiting = await PXE.getBlockNumber()
    const waitTillBlock = blockBeforeWaiting + blocksToWait
    let waiting = true
    while (waiting) {
        const currentBlock = await PXE.getBlockNumber()
        waiting = currentBlock < waitTillBlock
        //console.log(`waiting ${L1BlockTime / 2 * blocksToWait / 1000} seconds until ${blocksToWait} aztec blocks have passed. blocks passed: ${currentBlock - blockBeforeWaiting}`)
        if (waiting) {
            await new Promise((resolve) => setTimeout(resolve, L1BlockTime / 2 * blocksToWait))
        }
    }
}

export async function tryUntilItWorks(contract: ethers.Contract | any, funcName: string, funcArgs: any[], waitFunc: any): Promise<ethers.ContractTransactionResponse> {
    let works = false
    while (works === false) {
        try {
            await contract[funcName].estimateGas(...funcArgs);
            works = true;
        } catch (error) {
            await waitFunc()
        }
    }

    return await contract[funcName](...funcArgs)
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
export async function receiveGigaRootOnEvmL2(L2Adapter: L2ScrollBridgeAdapter, gigaRootSent: bigint): Promise<ethers.TransactionResponse> {
    const provider = L2Adapter.runner?.provider
    const chainId = (await provider?.getNetwork())!.chainId
    switch (chainId) {
        case chainIds.scroll.testnet:
        case chainIds.scroll.mainnet:
            const filter = L2Adapter.filters.NewGigaRoot(gigaRootSent);
            let endBlock = Number(await provider?.getBlockNumber())
            let startBlock = endBlock - 100
            let eventFound = false
            while (eventFound === false) {
                const events = await L2Adapter.queryFilter(filter, startBlock, endBlock)
                if (events.length === 0) {
                    await sleep(1800000)
                    //console.log(`did not see an event for gigaRoot: ${ethers.toBeHex(gigaRootSent)} at L2 adapter: ${L2Adapter.target}. checking again in 30 minutes`)
                    eventFound = false
                    startBlock = endBlock
                    endBlock = Number(await provider?.getBlockNumber())
                } else {
                    eventFound = true
                    return await events[0].getTransaction()
                }
            }
        // below dont work and just makes bun quit early without error??
        // return new Promise((resolve) => {
        //     L2Adapter.once(filter,  (_gigaRoot, event) => resolve( event.transactionHash));
        // });
        default:
            throw new Error(`unknown chain id: ${chainId.toString(10)}`)
            break;
    }

}
export async function receiveGigaRootOnL2(
    L1Adapter:L1Adapter, 
    L2Adapter:L2Adapter, 
    L2WarpToad:L2WarpToad, 
    sendGigaRootTx:ethers.TransactionReceipt, 
    gigaRootSent?:bigint, 

    // aztec
    isAztec?:boolean, 
    isSandBox?: boolean, 
    PXE?:PXE, 
    sponsoredPaymentMethod?: SponsoredFeePaymentMethod
) {
    if (isAztec) {
        if(isSandBox === undefined ||  PXE === undefined || sponsoredPaymentMethod === undefined) {throw new Error(`isSandBox, PXE and sponsoredPaymentMethod need to be set when isAztec = true`)}
        const { receiveGigaRootTx } = await receiveGigaRootOnAztec(
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            L2WarpToad as L2WarpToadAZTEC,
            sendGigaRootTx,
            PXE as PXE,
            isSandBox,
            sponsoredPaymentMethod
        )
        const gigaRootOnAztec = await (L2WarpToad as L2WarpToadAZTEC)?.methods.get_giga_root().simulate()
        return {receiveGigaRootTx, receiveGigaRootTxHash: receiveGigaRootTx.txHash.hash, gigaRootOnL2: gigaRootOnAztec }
    } else {
        //scroll
        if (gigaRootSent) {
            //console.log(`waiting for gigaRoot: ${ethers.toBeHex(gigaRootSent)} to arrive at L2 adapter ${(L2Adapter as L2ScrollBridgeAdapter).target}`)
            const receiveGigaRootTx = await receiveGigaRootOnEvmL2(L2Adapter as L2ScrollBridgeAdapter, gigaRootSent)
            //console.log(`gigaRoot arrived on L2: ${receiveGigaRootTx.hash}`)
            return {receiveGigaRootTx, receiveGigaRootTxHash: receiveGigaRootTx.hash, gigaRootOnL2: gigaRootSent }
        } else {
            console.log(`no gigaRootSent provided, so script will not wait for it. \n The "receiveGigaRoot()" call will be automatically be made by the scroll messenger on L2 at contract: ${(L2Adapter as L2ScrollBridgeAdapter).target}`)
            return {receiveGigaRootTx:undefined, receiveGigaRootTxHash: undefined, gigaRootOnL2: gigaRootSent }
        }

    }
}

export function parseMultipleEventsFromTx(tx: ethers.TransactionReceipt, contract: ethers.Contract | any, eventName: string) {
    const events = tx.logs.filter(
        (log) => log.topics[0] === contract.interface.getEvent(eventName)?.topicHash
    );

    // Parse the event data
    const parsedEvents = events.map((e) => contract.interface.parseLog({
        topics: e!.topics,
        data: e!.data
    }))
    return parsedEvents

}

/**
 * Bridges L1 <-> L2
 * Bridges the localRoot from L2 to L1, then sends the new gigaRoot from L1 back to the L2 (or multiple localRootProviders if provided)
 * @param l1Wallet
 * @param L1Adapter 
 * @param gigaBridge 
 * @param L2Adapter 
 * @param L2WarpToad 
 * @param localRootProviders the addresses of the L2Adapters who will receive the new gigaRoot 
 * @param payableLocalRootProviders the addresses of the L2Adapters that need eth to bridge the gigaRoot, current only scroll
 * @param aztecInputs things specific to aztec, like the PXE, feePaymentMethod. Can be left out if ur not using aztec
 */
export async function bridgeBetweenL1AndL2(
    l1Wallet: ethers.Signer,
    L1Adapter: L1Adapter,
    gigaBridge: GigaBridge,
    L2Adapter: L2Adapter,
    L2WarpToad: L2WarpToad,
    localRootProviders: ethers.AddressLike[],
    payableLocalRootProviders: ethers.AddressLike[],
    aztecInputs?: {
        isAztec?: boolean,
        PXE?: PXE,
        sponsoredPaymentMethod?: SponsoredFeePaymentMethod
    }

) {
    // check input aztecInputs
    if(aztecInputs && aztecInputs.isAztec && (aztecInputs.PXE === undefined || aztecInputs.sponsoredPaymentMethod === undefined)) {
        throw new Error(`aztecInputs.PXE and aztecInputs.sponsoredPaymentMethod needs to be set when isAztec = true`)
    }
    if(aztecInputs === undefined) {aztecInputs={}}
    const l1ChainId = (await (l1Wallet.provider?.getNetwork()))?.chainId
    const isSandBox = l1ChainId=== 31337n

    const l2ChainIdStr = aztecInputs.isAztec ?  "aztec" : (await ((L2Adapter as L2ScrollBridgeAdapter).runner?.provider?.getNetwork()))?.chainId.toString()
    const l1ChainIdStr = l1ChainId?.toString()
    //------- bridge localRoot L2->L1---------
    //TODO etherscan links would be nice!
    console.log(`
    Doing a L1 <-> L2 bridge on ${l1ChainIdStr} <-> ${l2ChainIdStr}
        l1Wallet: ${await l1Wallet.getAddress()}
        gigaBridge: ${gigaBridge.target}
        L1Adapter: ${L1Adapter.target}
        L2Adapter: ${getAddress(L2Adapter)}
        L2WarpToad: ${getAddress(L2WarpToad)}
    `)
    const {sendRootToL1Tx, sendRootToL1TxHash} = await bridgeLocalRootToL1(
        l1Wallet,
        gigaBridge,
        L1Adapter,
        L2Adapter,
        // aztec inputs
        aztecInputs.isAztec,
        aztecInputs.PXE,
        aztecInputs.sponsoredPaymentMethod
    )
    console.log(`local root is bridged to L1! At tx hash: ${sendRootToL1TxHash}`)
    //--- collect localRoots from adapters and send a giga root back--------------
    console.log(`updating the gigaGiga root L1`)
    const { gigaRootUpdateTx, gigaRootUpdateTxHash } = await updateGigaRoot(
        gigaBridge,
        localRootProviders,
    )
    console.log(`GigaRoot is updated! At tx hash: ${gigaRootUpdateTxHash}`)

    console.log(`initiating gigaRoot bridging to the L2's`)
    const { sendGigaRootTx,sendGigaRootTxHash, gigaRootSent } = await sendGigaRoot(
        gigaBridge,
        localRootProviders,
        payableLocalRootProviders
    )
    console.log(`gigaRoot bridging is initiated to the L2's! At tx hash: ${sendRootToL1TxHash}`)

    // ------- retrieve the giga root from the adapters on L2 and send them to the toads!!! ----------
    console.log(`Completing arrival of the gigaRoot on L2 on the L2 adapter contract`)
    const {receiveGigaRootTx, receiveGigaRootTxHash} = await receiveGigaRootOnL2(
        L1Adapter,
        L2Adapter,
        L2WarpToad,
        sendGigaRootTx,
        gigaRootSent,
        aztecInputs.isAztec,
        isSandBox,
        aztecInputs.PXE,
        aztecInputs.sponsoredPaymentMethod,

    )
    console.log(`GigaRoot bridging completed! At tx hash: ${receiveGigaRootTxHash}`)

    return {
        txObjects: {
            sendRootToL1Tx,
            gigaRootUpdateTx,
            sendGigaRootTx,
            receiveGigaRootTx

        },

        txHashes: {
            sendRootToL1TxHash, 
            gigaRootUpdateTxHash, 
            sendGigaRootTxHash, 
            receiveGigaRootTxHash, 
        },
        
        roots: {
            gigaRootSent

        }
    }
}

function getAddress(contractObj: ethers.Contract|AztecContract|L2Adapter|L2WarpToad) {
    if ("address" in contractObj) {
        return contractObj.address
    } else if ("target" in contractObj) {
        return contractObj.target
    }
}