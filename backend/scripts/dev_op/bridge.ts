import { ethers } from 'ethers';
import { ArgumentParser } from 'argparse';
//@ts-ignore
import { createPXEClient, PXE, waitForPXE } from '@aztec/aztec.js';

// local
import { getL1Contracts, getL2Contracts, getAztecTestWallet } from "../dev_op/deployment"//'warp-toad-old-backend/deployment';
import { getLocalRootProviders, getPayableGigaRootRecipients, bridgeBetweenL1AndL2, sleep } from "../lib/bridging"//'warp-toad-old-backend/bridging';

const AZTEC_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz"

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

async function main() {
    const parser = new ArgumentParser({
        description: 'quick lil script bridge some root',
        usage: `TODO`
    });

    parser.add_argument('-a', '--isAztec', { help: 'is it aztec L2 or EVM L2?', required: false, default: false, action: 'store_true' });
    parser.add_argument('-ep', '--evmPrivatekey', { help: 'give me ur evmPrivatekey you can trust me! Defaults to standard anvil key', required: false, default: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" });
    // TODO actually use this key. Rn it's using a hardcoded default
    parser.add_argument('-ap', '--aztecPrivatekey', { help: 'give me ur aztecPrivatekey you can trust me! Defaults to getInitialTestAccountsWallets() but that only works on sandbox', required: false, default: "sandbox" });
    parser.add_argument('-l', '--localRootProviders', { help: 'a list of contracts to get the local roots from on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-g', '--gigaRootRecipients', { help: 'a list of contracts to send the gigaRoot to on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-L1', '--L1Rpc', { help: 'url for the ethereum L1 rpc', required: false, type: 'str', default: "http://localhost:8545" });
    parser.add_argument('-L2', '--L2Rpc', { help: 'url for L2 rpc', required: false, type: 'str', default: "http://localhost:8080" });
    parser.add_argument('-r', '--repeat', { help: 'if set repeatably bridges every 10 min', required: false, default: false, action: 'store_true' });


    const args = parser.parse_args()

    // ------------------- process user inputs -------------------
    const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);

    const l1Wallet = new ethers.Wallet(args.evmPrivatekey, l1Provider);
    const l1ChainId = (await l1Provider.getNetwork()).chainId
    if (args.evmPrivatekey === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" && l1ChainId !== 31337n) { console.warn("default anvil key used on a l1 network that is not chainId 31337!") }

    // aztec is not evm!
    const l2Data = {} as any; //TODO 
    if (args.isAztec) {
        const { PXE, aztecWallet, sponsoredPaymentMethod } = await connectAztec(args.L2Rpc, l1ChainId)
        l2Data.l2Wallet = aztecWallet
        l2Data.PXE = PXE
        l2Data.sponsoredPaymentMethod = sponsoredPaymentMethod
    } else {
        l2Data.l2Provider = new ethers.JsonRpcProvider(args.L2Rpc)
        l2Data.l2Wallet = new ethers.Wallet(args.evmPrivatekey, l2Data.l2Provider);
        l2Data.l2ChainId = (await l2Data.l2Provider!.getNetwork()).chainId
    }
    const { l2Provider, l2Wallet, l2ChainId, PXE, sponsoredPaymentMethod } = l2Data
    //----------------------------------------------------------------

    //------------------- get contract details -------------------------------
    const localRootProviders = args.localRootProviders ? args.localRootProviders : await getLocalRootProviders(l1ChainId)
    const { L1Adapter, gigaBridge, l1Warptoad } = await getL1Contracts(l1ChainId, l2ChainId as bigint, l1Wallet, args.isAztec)
    const { L2Adapter, L2WarpToad } = await getL2Contracts(l2Wallet,l1ChainId, l2ChainId, args.isAztec, PXE as PXE, AZTEC_NODE_URL)
    const payableLocalRootProviders = await getPayableGigaRootRecipients(l1ChainId)
    //--------------------------------------------------------------------------

    // ----------------------- bridge! ----------------------------------------
    console.log({localRootProviders,payableLocalRootProviders})
    let bridgeIteration = 0
    const errorsLimit = 1000
    let errors:any[] = []
    let lastBridgePromise;
    do {
        if (errors.length > errorsLimit) {
            console.log(errors)
            throw new Error(`ran into too many errors: ${errors.length} errors`,{cause:errors[errors.length-1]})
        }
        bridgeIteration += 1
        console.log(`starting ${bridgeIteration}th L1<->L2 bridge run`)

        // quick and ugly try and catch wrapper
        const bridgeBetweenL1AndL2TryCatch = async (inputs:Parameters<typeof bridgeBetweenL1AndL2>) => {
            try {
                return await bridgeBetweenL1AndL2(...inputs)
            } catch (error) {
                errors.push(error)
                console.log(`whoops an error. Total errors since running: ${errors.length}, error limit: ${errorsLimit} `, error)
            }
        }

        lastBridgePromise = bridgeBetweenL1AndL2TryCatch([
            l1Wallet,
            L1Adapter,
            gigaBridge,
            L2Adapter,
            L2WarpToad,
            localRootProviders,
            payableLocalRootProviders,
            {
                isAztec: args.isAztec,
                PXE: PXE,
                sponsoredPaymentMethod: sponsoredPaymentMethod
            }
        ]).then((res)=>console.log(`completed ${bridgeIteration}th bridge run`,res?.txHashes))

        await sleep(600000) // 10 min
    } while (args.repeat)

    // incase --repeat is not set. We wait!
    await lastBridgePromise;


}

if (require.main === module) {
    main()
}
