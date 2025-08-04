import { ArgumentParser } from 'argparse';
import fs from "fs/promises";
import { getContractAddressesAztec, getContractAddressesEvm } from './utils';
import { ethers, NonceManager } from 'ethers';
import { bridgeLocalRootToL1, bridgeNoteHashTreeRoot, getLocalRootProviders, getPayableGigaRootRecipients, receiveGigaRootOnAztec, receiveGigaRootOnEvmL2, sendGigaRoot, updateGigaRoot, waitForBlocksAztec } from '../lib/bridging';
//@ts-ignore
import { createPXEClient, PXE, waitForPXE, Wallet as aztecWallet, AztecAddressLike, GrumpkinScalar, createAztecNodeClient, AztecAddress, Fr } from '@aztec/aztec.js';
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { GigaBridge__factory, L1AztecBridgeAdapter, L1AztecBridgeAdapter__factory, L1ScrollBridgeAdapter, L1ScrollBridgeAdapter__factory, L2ScrollBridgeAdapter, L2ScrollBridgeAdapter__factory, L2WarpToad as L2EvmWarpToad, L2WarpToad__factory } from '../../typechain-types';
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from '../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
//@ts-ignore
import { computePartialAddress } from '@aztec/stdlib/contract';
import { getObsidionDeployerFPCWallet } from './getObsidionWallet/getObsidionWallet';
import { WarpToadCoreContract as L2AztecWarpToad } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

const OBSIDION_DEPLOYER_FPC_ADDRESS = AztecAddress.fromField(Fr.fromHexString("0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5"))
const OBSIDION_DEPLOYER_SECRET_KEY = "0x00"
const AZTEC_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz"
import { ObsidionDeployerFPCContractArtifact } from "./getObsidionWallet/ObsidionDeployerFPC"
import { getAztecTestWallet } from './utils';
import { SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA } from '../lib/constants';
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
    const { wallet, sponsoredPaymentMethod } = await getAztecTestWallet(PXE, chainId)
    return { PXE, aztecWallet: wallet, sponsoredPaymentMethod }

}

function getL1Adapter(l2ChainId: bigint, isAztec = false, signer: ethers.Signer, allL1Contracts: any) {
    if ((!l2ChainId) && (!isAztec)) { throw new Error("either set isAztec to true, or provide a l2ChainId both cannot be falsy") }
    if (isAztec) {
        return L1AztecBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1AztecBridgeAdapter"], signer)
    }
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            return L1ScrollBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1ScrollBridgeAdapter"], signer)
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
}

async function getL1Contracts(l1ChainId: bigint, l2ChainId: bigint, signer: ethers.Signer, isAztec = false,) {
    const l1Contracts = await getContractAddressesEvm(l1ChainId)
    const L1Adapter = getL1Adapter(l2ChainId, isAztec, signer, l1Contracts)
    const gigaBridge = GigaBridge__factory.connect(l1Contracts["L1InfraModule#GigaBridge"], signer)
    return { L1Adapter, gigaBridge }
}

async function getL2EvmContracts(l2ChainId: bigint, signer: ethers.Signer): Promise<{ L2Adapter: L2ScrollBridgeAdapter, L2WarpToad: L2EvmWarpToad }> {
    const l2Contracts = await getContractAddressesEvm(l2ChainId)
    let L2Adapter;
    let L2WarpToad;
    switch (l2ChainId) {
        case SCROLL_CHAINID_MAINNET:
        case SCROLL_CHAINID_SEPOLIA:
            L2Adapter = L2ScrollBridgeAdapter__factory.connect(l2Contracts["L2ScrollModule#L2ScrollBridgeAdapter"], signer)
            L2WarpToad = L2WarpToad__factory.connect(l2Contracts["L2ScrollModule#L2WarpToad"], signer)
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
    return { L2Adapter: L2Adapter as L2ScrollBridgeAdapter, L2WarpToad: L2WarpToad as L2EvmWarpToad }
}

async function getL2Contracts(
    l2Wallet: aztecWallet | ethers.Signer,
    l1ChainId: bigint,
    l2ChainId: bigint | undefined,
    isAztec: boolean,
    PXE: PXE
): Promise<{
    L2Adapter: L2ScrollBridgeAdapter | L2AztecBridgeAdapterContract,
    L2WarpToad: L2EvmWarpToad | L2AztecWarpToad
}> {
    if (isAztec) {
        const isSandBox = BigInt(l1ChainId) === 31337n
        const contracts = await getContractAddressesAztec(l1ChainId)

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

        const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.at(L2AztecAdapterAddress, l2Wallet as aztecWallet)
        const AztecWarpToad = await WarpToadCoreContract.at(AztecWarpToadAddress, l2Wallet as aztecWallet)
        return { L2Adapter: L2AztecBridgeAdapter, L2WarpToad: AztecWarpToad }

    } else {
        return await getL2EvmContracts(l2ChainId as bigint, l2Wallet as ethers.Signer)
    }

}

async function main() {
    const parser = new ArgumentParser({
        description: 'quick lil script bridge some root',
        usage: `TODO`
    });


    parser.add_argument('-a', '--isAztec', { help: 'is it aztec L2 or EVM L2?', required: false, default: false, action: 'store_true' });
    parser.add_argument('-ep', '--evmPrivatekey', { help: 'give me ur evmPrivatekey you can trust me! Defaults to standard anvil key', required: false, default: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" });
    parser.add_argument('-ap', '--aztecPrivatekey', { help: 'give me ur aztecPrivatekey you can trust me! Defaults to getInitialTestAccountsWallets() but that only works on sandbox', required: false, default: "sandbox" });
    parser.add_argument('-l', '--localRootProviders', { help: 'a list of contracts to get the local roots from on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-g', '--gigaRootRecipients', { help: 'a list of contracts to send the gigaRoot to on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-1', '--L1Rpc', { help: 'url for the ethereum L1 rpc', required: false, type: 'str', default: "http://localhost:8545" });
    parser.add_argument('-2', '--L2Rpc', { help: 'url for L2 rpc', required: false, type: 'str', default: "http://localhost:8080" });


    const args = parser.parse_args()


    const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);
    const l2Provider = args.isAztec ? undefined : new ethers.JsonRpcProvider(args.L2Rpc);
    // TODO maybe use     const signer = (await hre.ethers.getSigners())[0] instead
    const l1Wallet = new ethers.Wallet(args.evmPrivatekey, l1Provider);
    const l1ChainId = (await l1Provider.getNetwork()).chainId
    const l2ChainId = args.isAztec ? undefined : (await l2Provider!.getNetwork()).chainId
    if (args.evmPrivatekey === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" && l1ChainId !== 31337n) { console.warn("default anvil key used on a l1 network that is not chainId 31337!") }
    console.log({isAztec:args.isAztec})
    const { PXE, aztecWallet, sponsoredPaymentMethod } = args.isAztec ? await connectAztec(args.L2Rpc, l1ChainId) : { PXE: undefined, aztecWallet: undefined, sponsoredPaymentMethod: undefined }
    const L2Wallet = args.isAztec ? aztecWallet as aztecWallet : new ethers.Wallet(args.evmPrivatekey, l2Provider);
    const localRootProviders = args.localRootProviders ? args.localRootProviders : await getLocalRootProviders(l1ChainId)
    const { L1Adapter, gigaBridge } = await getL1Contracts(l1ChainId, l2ChainId as bigint, l1Wallet, args.isAztec)
    const { L2Adapter, L2WarpToad } = await getL2Contracts(L2Wallet, l1ChainId, l2ChainId, args.isAztec, PXE as PXE)
    const isSandBox = l1ChainId === 31337n
    //------- bridge localRoot L2->L1---------
    if (args.isAztec) {
        console.log("bridgeNoteHashTreeRoot")
        const { sendRootToL1Tx, refreshRootTx, PXE_L2Root } = await bridgeNoteHashTreeRoot(
            PXE as PXE,
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            l1Provider,
            sponsoredPaymentMethod
        )
        const gigaRootPreBridge = await gigaBridge.gigaRoot()
        console.log({ sendRootToL1Tx: sendRootToL1Tx.txHash.hash, refreshRootTx: refreshRootTx.hash, PXE_L2Root: PXE_L2Root.toBigInt(), gigaRootPreBridge })
    } else {
        await bridgeLocalRootToL1(L2Adapter as L2ScrollBridgeAdapter, l1Wallet)
        //normal evm things
        // await function relayLocalRootBridgeMessageOnL1() <- for scroll copy paste shit from relayMessageScroll
    }


    //--- collect localRoots from adapters and send a giga root back--------------
    const { gigaRootUpdateTx } = await updateGigaRoot(
        gigaBridge,
        localRootProviders,
    )

    const { sendGigaRootTx } = await sendGigaRoot(
        gigaBridge,
        localRootProviders,
        await getPayableGigaRootRecipients(l1ChainId)
    )

    const log = sendGigaRootTx.logs.map(log => gigaBridge.interface.parseLog(log)).find(log => log!.name === "SentGigaRoot");
    const gigaRootSent =  log!.args.gigaRoot.toString();

    console.log({ gigaRootUpdateTx: gigaRootUpdateTx.hash, sendGigaRootTx: sendGigaRootTx.hash, gigaRootSent })


    // ------- retrieve the giga root from the adapters on L2 and send them to the toads!!! ----------
    if (args.isAztec) {
        const { receive_giga_rootTx } = await receiveGigaRootOnAztec(
            L2Adapter as L2AztecBridgeAdapterContract,
            L1Adapter as L1AztecBridgeAdapter,
            L2WarpToad as WarpToadCoreContract,
            sendGigaRootTx,
            PXE as PXE,
            isSandBox,
            sponsoredPaymentMethod
        )
        const gigaRootOnAztec = await (L2WarpToad as L2AztecWarpToad)?.methods.get_giga_root().simulate()
        console.log({ receive_giga_rootTx: receive_giga_rootTx.txHash.hash, gigaRootOnAztec })
    } else {
        console.log(`waiting for gigaRoot: ${ethers.toBeHex(gigaRootSent)} to arrive at L2 adapter ${(L2Adapter as L2ScrollBridgeAdapter).target}`)
        const tx = await receiveGigaRootOnEvmL2(L2Adapter as L2ScrollBridgeAdapter, gigaRootSent)
        console.log(`gigaRoot arrived on L2: ${tx.hash}`)
    }

}

if (require.main === module) {
    main()
}
