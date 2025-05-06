import { ArgumentParser } from 'argparse';
import fs from "fs/promises";
import { getContractAddressesAztec, getContractAddressesEvm } from './getDeployedAddresses';
import { ethers, NonceManager } from 'ethers';
import { bridgeNoteHashTreeRoot, receiveGigaRootOnAztec, sendGigaRoot, updateGigaRoot } from '../lib/bridging';
//@ts-ignore
import { createPXEClient, PXE, waitForPXE, Wallet as aztecWallet, AztecAddressLike } from '@aztec/aztec.js';
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { GigaRootBridge__factory, L1AztecRootBridgeAdapter__factory } from '../../typechain-types';
import { L2AztecRootBridgeAdapterContract } from '../../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter';
import { WarpToadCoreContract } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';


async function getLocalRootProviders(chainId: bigint) {
    const contracts = await getContractAddressesEvm(chainId)
    return [contracts["L1WarpToadModule#L1WarpToad"], contracts["L1InfraModule#L1AztecRootBridgeAdapter"]]
}

async function connectPXE(PXE_URL:string) {
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);

    console.log("getting test accounts this will break outside of sanbox")
    const aztecWallet = (await getInitialTestAccountsWallets(PXE))[0];
    return { aztecWallet, PXE }
}

async function getL1Contracts(l1ChainId:bigint, signer:ethers.Signer) {
    const contracts = await getContractAddressesEvm(l1ChainId)
    const gigaBridge = GigaRootBridge__factory.connect(contracts["L1InfraModule#GigaRootBridge"], signer)
    const L1AztecRootBridgeAdapter = L1AztecRootBridgeAdapter__factory.connect(contracts["L1InfraModule#L1AztecRootBridgeAdapter"], signer)
    return {L1AztecRootBridgeAdapter, gigaBridge}

}

async function getAztecContracts(aztecWallet: aztecWallet|any) {
    const contracts = await getContractAddressesAztec()
    const L2AztecRootBridgeAdapter =await L2AztecRootBridgeAdapterContract.at(contracts["L2AztecRootBridgeAdapter"], aztecWallet)
    const AztecWarpToad =await WarpToadCoreContract.at(contracts["AztecWarpToad"], aztecWallet)
    return {L2AztecRootBridgeAdapter, AztecWarpToad}   
}

async function main() {
    const parser = new ArgumentParser({
        description: 'quick lil script bridge some root',
        usage: `TODO`
    });


    parser.add_argument('-a', '--isAztec', { help: 'is it aztec L2 or EVM L2?', required: true, default: true, action: 'store_true' });
    parser.add_argument('-p', '--privatekey', { help: 'give me ur privatekey you can trust me! Defaults to standard anvil key', required: false, default: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" });

    parser.add_argument('-l', '--localRootProviders', { help: 'a list of contracts to get the localroots from on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-g', '--gigaRootRecipients', { help: 'a list of contracts to send the gigaRoot to on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-1', '--L1Rpc', { help: 'url for the ethereum L1 rpc', required: false, type: 'str', default: "http://localhost:8545" });
    parser.add_argument('-2', '--L2Rpc', { help: 'url for L2 rpc', required: false, type: 'str', default: "http://localhost:8080" });

    const args = parser.parse_args()
    const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);
    const l1Wallet = new ethers.Wallet(args.privatekey, l1Provider);
    const l1ChainId = (await l1Provider.getNetwork()).chainId

    const {PXE, aztecWallet} = args.isAztec ? await connectPXE(args.L2Rpc): {PXE:undefined, aztecWallet:undefined}

    const localRootProviders = args.localRootProviders ? args.localRootProviders : await getLocalRootProviders(l1ChainId)
    const gigaRootRecipients = args.gigaRootRecipients ? args.gigaRootRecipients : await getLocalRootProviders(l1ChainId)

    const {L1AztecRootBridgeAdapter, gigaBridge} = await getL1Contracts(l1ChainId, l1Wallet)
    const {L2AztecRootBridgeAdapter, AztecWarpToad} =  args.isAztec ?  await getAztecContracts(aztecWallet) : {L2AztecRootBridgeAdapter:undefined, AztecWarpToad:undefined}
    
    //The L2ToL1Message you are trying to prove inclusion of does not exist
    //await AztecWarpToad?.methods.mint_for_testing(1n, aztecWallet?.getAddress() as AztecAddressLike).send().wait();
    //------- bridge localRoot L1->l2---------
    if (args.isAztec) {
        try {
            const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeNoteHashTreeRoot(
                PXE as PXE,
                L2AztecRootBridgeAdapter as L2AztecRootBridgeAdapterContract,
                L1AztecRootBridgeAdapter,
                l1Provider
            )
            console.log({sendRootToL1Tx:sendRootToL1Tx.txHash,refreshRootTx:refreshRootTx.hash, PXE_L2Root:PXE_L2Root.toBigInt()})

        } catch (error) {
            console.error(error)
            throw new Error("DEBUG HINT!!!!: THIS LIKELY HAPPENED BECAUSE YOU FORGOT TO INITIALIZE THE CONTRACTS YOU DUMMY!!!")
            
        }
    } else {
        //normal evm things
    }


    //--- collect localRoots from adapters and send a giga root back--------------
        const {gigaRootUpdateTx} = await updateGigaRoot(
            gigaBridge,
            localRootProviders,
        )
        const {sendGigaRootTx} = await sendGigaRoot(
            gigaBridge,
            gigaRootRecipients,
        )
        console.log({gigaRootUpdateTx:gigaRootUpdateTx.hash,sendGigaRootTx:sendGigaRootTx.hash})


    // ------- retrieve the giga root from the adapters on L2 and send them to the toads!!! ----------
    if (args.isAztec) {
        const {update_gigarootTx} = await receiveGigaRootOnAztec(
            L2AztecRootBridgeAdapter as L2AztecRootBridgeAdapterContract,
            L1AztecRootBridgeAdapter,
            AztecWarpToad as WarpToadCoreContract,
            sendGigaRootTx,
            PXE as PXE,
            true
        )
        console.log({update_gigarootTx:update_gigarootTx.txHash})
    } else {
        //normal evm things
    }
}

if (require.main === module) {
    main()
}
