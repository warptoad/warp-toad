import { ArgumentParser } from 'argparse';
import fs from "fs/promises";
import { getContractAddressesAztec, getContractAddressesEvm } from './getDeployedAddresses';
import { ethers, NonceManager } from 'ethers';
import { bridgeNoteHashTreeRoot, receiveGigaRootOnAztec, sendGigaRoot, updateGigaRoot, waitForBlocksAztec } from '../lib/bridging';
//@ts-ignore
import { createPXEClient, PXE, waitForPXE, Wallet as aztecWallet, AztecAddressLike, GrumpkinScalar, createAztecNodeClient, AztecAddress, Fr } from '@aztec/aztec.js';
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { GigaBridge__factory, L1AztecBridgeAdapter__factory } from '../../typechain-types';
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
//@ts-ignore
import { computePartialAddress } from '@aztec/stdlib/contract';
import { getObsidionDeployerFPCWallet } from './getObsidionWallet/getObsidionWallet';


async function getLocalRootProviders(chainId: bigint) {
    const contracts = await getContractAddressesEvm(chainId)
    return [contracts["L1WarpToadModule#L1WarpToad"], contracts["L1InfraModule#L1AztecBridgeAdapter"]]
}
const OBSIDION_DEPLOYER_FPC_ADDRESS = AztecAddress.fromField(Fr.fromHexString("0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5"))
const OBSIDION_DEPLOYER_SECRET_KEY = "0x00"
const AZTEC_NODE_URL = "https://full-node.alpha-testnet.aztec.network"
import { ObsidionDeployerFPCContractArtifact } from "./getObsidionWallet/ObsidionDeployerFPC"
import { getAztecTestWallet } from './getTestWallet';
const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))


async function connectPXE(PXE_URL: string) {
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    return PXE
}

async function connectAztec(PXE_URL: string, chainId: bigint) {
    const PXE = await connectPXE(PXE_URL)
    const {wallet, sponsoredPaymentMethod} = await getAztecTestWallet(PXE, chainId)
    return { PXE, aztecWallet:wallet, sponsoredPaymentMethod } 
    
}

async function getL1Contracts(l1ChainId: bigint, signer: ethers.Signer) {
    const contracts = await getContractAddressesEvm(l1ChainId)
    const gigaBridge = GigaBridge__factory.connect(contracts["L1InfraModule#GigaBridge"], signer)
    const L1AztecBridgeAdapter = L1AztecBridgeAdapter__factory.connect(contracts["L1InfraModule#L1AztecBridgeAdapter"], signer)
    return { L1AztecBridgeAdapter, gigaBridge }

}

async function getAztecContracts(aztecWallet: aztecWallet | any, chainId: number, PXE:PXE) {
    const isSandBox = BigInt(chainId) === 31337n
    const contracts = await getContractAddressesAztec(chainId)

    const L2AztecAdapterAddress = contracts["L2AztecBridgeAdapter"]
    const AztecWarpToadAddress = contracts["AztecWarpToad"]

    if (!isSandBox) {
        const node = createAztecNodeClient(AZTEC_NODE_URL)
        const AztecWarpToadContract = await node.getContract(AztecWarpToadAddress as any)
        await PXE.registerContract({
            instance: AztecWarpToadContract as any,
            artifact: WarpToadCoreContractArtifact,
        })
        await delay(10000)
        const L2AztecAdapterContract = await node.getContract(L2AztecAdapterAddress as any)
        await PXE.registerContract({
            instance: L2AztecAdapterContract as any,
            artifact: L2AztecBridgeAdapterContractArtifact,
        })
        await delay(10000)
    }

    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(L2AztecAdapterAddress, aztecWallet)
    const AztecWarpToad = await WarpToadCoreContract.at(AztecWarpToadAddress, aztecWallet)
    return { L2AztecBridgeAdapter, AztecWarpToad }
}

async function main() {
    const parser = new ArgumentParser({
        description: 'quick lil script bridge some root',
        usage: `TODO`
    });


    parser.add_argument('-a', '--isAztec', { help: 'is it aztec L2 or EVM L2?', required: true, default: true, action: 'store_true' });
    parser.add_argument('-ep', '--evmPrivatekey', { help: 'give me ur evmPrivatekey you can trust me! Defaults to standard anvil key', required: false, default: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" });
    parser.add_argument('-ap', '--aztecPrivatekey', { help: 'give me ur aztecPrivatekey you can trust me! Defaults to getInitialTestAccountsWallets() but that only works on sandbox', required: false, default: "sandbox" });
    parser.add_argument('-l', '--localRootProviders', { help: 'a list of contracts to get the localroots from on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-g', '--gigaRootRecipients', { help: 'a list of contracts to send the gigaRoot to on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-1', '--L1Rpc', { help: 'url for the ethereum L1 rpc', required: false, type: 'str', default: "http://localhost:8545" });
    parser.add_argument('-2', '--L2Rpc', { help: 'url for L2 rpc', required: false, type: 'str', default: "http://localhost:8080" });
    

    const args = parser.parse_args()


    const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);
    // TODO maybe use     const signer = (await hre.ethers.getSigners())[0] instead
    const l1Wallet = new ethers.Wallet(args.evmPrivatekey, l1Provider);
    const l1ChainId = (await l1Provider.getNetwork()).chainId
    if(args.evmPrivatekey === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" && l1ChainId !== 31337n  ) {console.warn("default anvil key used on a l1 network that is not chainId 31337!")}

    const { PXE, aztecWallet, sponsoredPaymentMethod } = args.isAztec ? await connectAztec(args.L2Rpc,  l1ChainId) : { PXE: undefined, aztecWallet: undefined,  sponsoredPaymentMethod:undefined}

    const localRootProviders = args.localRootProviders ? args.localRootProviders : await getLocalRootProviders(l1ChainId)
    const gigaRootRecipients = args.gigaRootRecipients ? args.gigaRootRecipients : await getLocalRootProviders(l1ChainId)
    const { L1AztecBridgeAdapter, gigaBridge } = await getL1Contracts(l1ChainId, l1Wallet)
    const { L2AztecBridgeAdapter, AztecWarpToad } = args.isAztec ? await getAztecContracts(aztecWallet, Number(l1ChainId), PXE as PXE) : { L2AztecBridgeAdapter: undefined, AztecWarpToad: undefined }
    const isSandBox = l1ChainId === 31337n 
    //------- bridge localRoot L1->l2---------
    if (args.isAztec) {
        const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeNoteHashTreeRoot(
            PXE as PXE,
            L2AztecBridgeAdapter as L2AztecBridgeAdapterContract,
            L1AztecBridgeAdapter,
            l1Provider,
            sponsoredPaymentMethod
        )
        const gigaRootPreBridge = await gigaBridge.gigaRoot()
        console.log({ sendRootToL1Tx: sendRootToL1Tx.txHash.hash, refreshRootTx: refreshRootTx.hash, PXE_L2Root: PXE_L2Root.toBigInt(), gigaRootPreBridge })
        // try {
        //     const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeNoteHashTreeRoot(
        //         PXE as PXE,
        //         L2AztecBridgeAdapter as L2AztecBridgeAdapterContract,
        //         L1AztecBridgeAdapter,
        //         l1Provider
        //     )
        //     const gigaRootPreBridge = await gigaBridge.gigaRoot()
        //     console.log({ sendRootToL1Tx: sendRootToL1Tx.txHash.hash, refreshRootTx: refreshRootTx.hash, PXE_L2Root: PXE_L2Root.toBigInt(), gigaRootPreBridge })

        // } catch (error) {
        //     console.error(error)
        //     throw new Error("DEBUG HINT!!!!: THIS LIKELY HAPPENED BECAUSE YOU FORGOT TO INITIALIZE THE CONTRACTS YOU DUMMY!!!")

        // }
    } else {
        //normal evm things
    }


    //--- collect localRoots from adapters and send a giga root back--------------
    const { gigaRootUpdateTx } = await updateGigaRoot(
        gigaBridge,
        localRootProviders,
    )
    const { sendGigaRootTx } = await sendGigaRoot(
        gigaBridge,
        gigaRootRecipients,
    )
    const updatedGigaRoot = await gigaBridge.gigaRoot()
    console.log({ gigaRootUpdateTx: gigaRootUpdateTx.hash, sendGigaRootTx: sendGigaRootTx.hash, updatedGigaRoot })


    // ------- retrieve the giga root from the adapters on L2 and send them to the toads!!! ----------
    if (args.isAztec) {
        const { receive_giga_rootTx } = await receiveGigaRootOnAztec(
            L2AztecBridgeAdapter as L2AztecBridgeAdapterContract,
            L1AztecBridgeAdapter,
            AztecWarpToad as WarpToadCoreContract,
            sendGigaRootTx,
            PXE as PXE,
            isSandBox,
            sponsoredPaymentMethod
        )
        const gigaRootOnAztec = await AztecWarpToad?.methods.get_giga_root().simulate()
        console.log({ receive_giga_rootTx: receive_giga_rootTx.txHash.hash, gigaRootOnAztec })
    } else {
        //normal evm things
    }
    
}

if (require.main === module) {
    main()
}
