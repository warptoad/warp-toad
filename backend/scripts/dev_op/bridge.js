import { ethers, NonceManager } from 'ethers';
import { ArgumentParser } from 'argparse';
// local
import { getL1Contracts, getL2Contracts } from "../dev_op/deployment"; //'@warp-toad/backend/deployment';
import { getLocalRootProviders, getPayableGigaRootRecipients, bridgeBetweenL1AndL2, sleep } from "../lib/bridging"; //'@warp-toad/backend/bridging';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { getAztecTestAccounts, initPXE } from 'scripts/deploy/utils/aztecUtilsNoEnv';
const AZTEC_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz";
async function connectAztec(PXE_URL, chainId) {
    const aztecNode = createAztecNodeClient(PXE_URL);
    const PXE = await initPXE(aztecNode, chainId);
    //const { wallet, sponsoredPaymentMethod } = await getAztecTestWallet(PXE, chainId,AZTEC_NODE_URL)
    const wallet = (await getAztecTestAccounts(aztecNode))[0];
    return { PXE, aztecNode, aztecWallet: wallet, sponsoredPaymentMethod: undefined };
}
async function main() {
    const parser = new ArgumentParser({
        description: 'quick lil script bridge some root',
        usage: `TODO`
    });
    parser.add_argument('-a', '--isAztec', { help: 'is it aztec L2 or EVM L2?', required: false, default: false, action: 'store_true' });
    parser.add_argument('-ep', '--evmPrivatekey', { help: 'give me ur evmPrivatekey you can trust me! Defaults to standard anvil key', required: false, default: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" });
    // TODO actually use this key. Rn it's using a hardcoded default
    parser.add_argument('-ap', '--aztecPrivatekey', { help: 'give me ur aztecPrivatekey you can trust me! Defaults to getInitialTestAccountsWallets() but that only works on sandbox', required: false, default: "sandbox" });
    parser.add_argument('-l', '--localRootProviders', { help: 'a list of contracts to get the local roots from on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str', nargs: "+" });
    //parser.add_argument('-g', '--gigaRootRecipients', { help: 'a list of contracts to send the gigaRoot to on L1 (can be L1Warptoad or/and any L1<l2name>adapter)', required: false, type: 'str' });
    parser.add_argument('-L1', '--L1Rpc', { help: 'url for the ethereum L1 rpc', required: false, type: 'str', default: "http://localhost:8545" });
    parser.add_argument('-L2', '--L2Rpc', { help: 'url for L2 rpc', required: false, type: 'str', default: "http://localhost:8080" });
    parser.add_argument('-r', '--repeat', { help: 'if set repeatably bridges every 10 min', required: false, default: false, action: 'store_true' });
    const args = parser.parse_args();
    // ------------------- process user inputs -------------------
    const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);
    const l1Wallet = new NonceManager(new ethers.Wallet(args.evmPrivatekey, l1Provider));
    const l1ChainId = (await l1Provider.getNetwork()).chainId;
    if (args.evmPrivatekey === "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" && l1ChainId !== 31337n) {
        console.warn("default anvil key used on a l1 network that is not chainId 31337!");
    }
    // aztec is not evm!
    const l2Data = {}; //TODO 
    if (args.isAztec) {
        console.log("conecting to aztec ----------------------------------------------------------------------------");
        const { PXE, aztecWallet, sponsoredPaymentMethod, aztecNode } = await connectAztec(args.L2Rpc, l1ChainId);
        console.log("done connecting to aztec ----------------------------------------------------------------------------");
        l2Data.l2Wallet = aztecWallet;
        l2Data.PXE = PXE;
        l2Data.sponsoredPaymentMethod = sponsoredPaymentMethod;
        l2Data.aztecNode = aztecNode;
    }
    else {
        l2Data.l2Provider = new ethers.JsonRpcProvider(args.L2Rpc);
        l2Data.l2Wallet = new NonceManager(new ethers.Wallet(args.evmPrivatekey, l2Data.l2Provider));
        l2Data.l2ChainId = (await l2Data.l2Provider.getNetwork()).chainId;
    }
    const { l2Provider, l2Wallet, l2ChainId, PXE, sponsoredPaymentMethod } = l2Data;
    //----------------------------------------------------------------
    //------------------- get contract details -------------------------------
    const localRootProviders = args.localRootProviders ? args.localRootProviders : await getLocalRootProviders(l1ChainId);
    if (!args.localRootProviders) {
        console.log("selecting all adapters as gigaRoot recipients. THIS WILL BREAK ON SANDBOX!!!!!!!!!!!!!!!!!!!!!!!!!\n if you dont want that, manually put in the addresses of L1Warptoad and L1AztecAdapter with the flag: --localRootProviders");
    }
    const { L1Adapter, gigaBridge, l1Warptoad } = await getL1Contracts(l1ChainId, l2ChainId, l1Wallet, args.isAztec);
    const { L2Adapter, L2WarpToad } = await getL2Contracts(l2Wallet, l1ChainId, l2ChainId, args.isAztec, PXE, AZTEC_NODE_URL);
    const payableLocalRootProviders = await getPayableGigaRootRecipients(l1ChainId);
    //--------------------------------------------------------------------------
    // ----------------------- bridge! ----------------------------------------
    console.log({ localRootProviders, payableLocalRootProviders });
    let bridgeIteration = 0;
    const errorsLimit = 1000;
    let errors = [];
    let lastBridgePromise;
    do {
        if (errors.length > errorsLimit) {
            console.log(errors);
            throw new Error(`ran into too many errors: ${errors.length} errors`, { cause: errors[errors.length - 1] });
        }
        bridgeIteration += 1;
        console.log(`starting ${bridgeIteration}th L1<->L2 bridge run`);
        // quick and ugly try and catch wrapper
        const bridgeBetweenL1AndL2TryCatch = async (inputs) => {
            try {
                return await bridgeBetweenL1AndL2(...inputs);
            }
            catch (error) {
                //throw error
                errors.push(error);
                console.log(`whoops an error. Total errors since running: ${errors.length}, error limit: ${errorsLimit} `, error);
            }
        };
        const L1AdapterGigaBridge = await L1Adapter.gigaBridge();
        console.log({
            L1AdapterGigaBridge,
            gigaBridge: gigaBridge.target
        });
        //console.warn("JIMJIM DONT FORGET YOU COMMENTED OUT payableLocalRootProviders TO DISABLE SCROLL!!!")
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
                sponsoredPaymentMethod: sponsoredPaymentMethod,
                aztecNode: l2Data.aztecNode,
                aztecWallet: l2Wallet
            }
        ]).then((res) => console.log(`completed ${bridgeIteration}th bridge run`, res?.txHashes));
        await sleep(600000); // 10 min
    } while (args.repeat);
    // incase --repeat is not set. We wait!
    await lastBridgePromise;
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=bridge.js.map