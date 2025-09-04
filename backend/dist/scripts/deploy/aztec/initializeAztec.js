// initializing more than one contract? use try and catch!
//@ts-ignore
import { Contract, createAztecNodeClient, createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { WarpToadCoreContractArtifact } from "../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";
//@ts-ignore
// import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { getContractAddressesAztec, getContractAddressesEvm } from "../../dev_op/utils";
//@ts-ignore
// import { computePartialAddress } from "@aztec/stdlib/contract";
// import { ObsidionDeployerFPCContractArtifact } from "../dev_op/getObsidionWallet/ObsidionDeployerFPC";
// import { getObsidionDeployerFPCWallet } from "../dev_op/getObsidionWallet/getObsidionWallet";
import { L2AztecBridgeAdapterContractArtifact } from "../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter";
import { getAztecTestWallet } from "../../dev_op/utils";
const hre = require("hardhat");
const AZTEC_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz";
const delay = async (timeInMs) => await new Promise((resolve) => setTimeout(resolve, timeInMs));
function getEnvArgs() {
    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox");
    }
    // if (!Boolean(process.env.PRIVATE_KEY)) {
    //     throw new Error("PRIVATE_KEY not set")
    // }
    const PXE_URL = process.env.PXE_URL;
    return { PXE_URL, privateKey: process.env.PRIVATE_KEY };
}
async function main() {
    const { PXE_URL, privateKey } = getEnvArgs();
    //----PXE and wallet-----
    console.log("creating PXE client");
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL);
    await waitForPXE(PXE);
    const provider = hre.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    const { wallet, sponsoredPaymentMethod } = await getAztecTestWallet(PXE, chainId); //await getAztecWallet(PXE,privateKey as string,AZTEC_NODE_URL ,chainId)
    const evmContractAddresses = await getContractAddressesEvm(chainId);
    const aztecContractAddresses = await getContractAddressesAztec(chainId);
    console.log({ aztecContractAddresses });
    const L1AztecBridgeAdapter = evmContractAddresses["L1InfraModule#L1AztecBridgeAdapter"];
    const AztecWarpToadAddress = aztecContractAddresses["AztecWarpToad"];
    const L2AztecAdapterAddress = aztecContractAddresses["L2AztecBridgeAdapter"];
    if (chainId !== 31337n) {
        console.log("assuming ur not on sand box so registering the contracts with aztec testnet node");
        const node = createAztecNodeClient(AZTEC_NODE_URL);
        const AztecWarpToadContract = await node.getContract(AztecWarpToadAddress);
        await PXE.registerContract({
            instance: AztecWarpToadContract,
            artifact: WarpToadCoreContractArtifact,
        });
        await delay(10000);
        const L2AztecAdapterContract = await node.getContract(L2AztecAdapterAddress);
        await PXE.registerContract({
            instance: L2AztecAdapterContract,
            artifact: L2AztecBridgeAdapterContractArtifact,
        });
        await delay(10000);
    }
    const AztecWarpToad = await Contract.at(AztecWarpToadAddress, WarpToadCoreContractArtifact, wallet);
    const initializationStatus = {};
    try {
        await AztecWarpToad.methods.initialize(L2AztecAdapterAddress, L1AztecBridgeAdapter).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 }); // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["AztecWarpToad"] = true;
    }
    catch (error) {
        console.warn(`couldn't initialize: AztecWarpToad at: ${AztecWarpToad.address}. 
        Was it already initialized?     
        `);
        console.warn(error);
        initializationStatus["AztecWarpToad"] = false;
    }
    console.log(`
        initialized: 
            AztecWarpToad:              ${AztecWarpToad.address}
            initializationSuccess?:     ${initializationStatus["AztecWarpToad"]}
            args:                       ${JSON.stringify({ L2AztecAdapterAddress, L1AztecBridgeAdapter }, null, 2)}
        `);
}
main();
