"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
const promises_1 = __importDefault(require("fs/promises"));
const ethers_1 = require("ethers");
const aztecToadWarp_1 = require("./aztecToadWarp");
//@ts-ignore
const erc20ABI_json_1 = __importDefault(require("../../dev_op/erc20ABI.json"));
const L2AztecBridgeAdapter_1 = require("./L2AztecBridgeAdapter");
const hardhat_1 = __importDefault(require("hardhat"));
const utils_1 = require("../../dev_op/utils");
const utils_2 = require("../../dev_op/utils");
//import { ObsidionDeployerFPCContractArtifact } from "../dev_op/getObsidionWallet/ObsidionDeployerFPC"
const delay = async (timeInMs) => await new Promise((resolve) => setTimeout(resolve, timeInMs));
function getEnvArgs() {
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox");
    }
    else if (!ethers_1.ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`);
    }
    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox");
    }
    // if (!Boolean(process.env.PRIVATE_KEY)) {
    //     throw new Error("PRIVATE_KEY not set")
    // }
    const nativeTokenAddress = ethers_1.ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS);
    const PXE_URL = process.env.PXE_URL;
    return { nativeTokenAddress, PXE_URL, privateKey: process.env.PRIVATE_KEY };
}
async function main() {
    //----arguments------
    const { nativeTokenAddress, PXE_URL, privateKey } = getEnvArgs();
    //@ts-ignore
    const provider = hardhat_1.default.ethers.provider;
    const nativeToken = new ethers_1.ethers.Contract(nativeTokenAddress, erc20ABI_json_1.default, provider);
    const chainId = (await provider.getNetwork()).chainId;
    const deployedAddresses = await (0, utils_1.getContractAddressesEvm)(chainId);
    const L1AztecAdapterAddress = deployedAddresses["L1InfraModule#L1AztecBridgeAdapter"];
    const folderPath = (0, utils_1.getAztecDeployedAddressesFolderPath)(chainId);
    const deployedAddressesPath = (0, utils_1.getAztecDeployedAddressesFilePath)(chainId);
    if (await (0, utils_1.checkFileExists)(deployedAddressesPath)) {
        if (await (0, utils_1.promptBool)(`A deployment already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
            await promises_1.default.rm(deployedAddressesPath);
            console.log("overriding old deployment");
        }
        else {
            console.log("canceling deployment");
            return 0;
        }
    }
    //----PXE and wallet-----
    console.log("creating PXE client");
    const PXE = (0, aztec_js_1.createPXEClient)(PXE_URL);
    console.log("waiting on PXE client", PXE_URL);
    await (0, aztec_js_1.waitForPXE)(PXE);
    //const wallets = await getInitialTestAccountsWallets(PXE);
    const { wallet, sponsoredPaymentMethod } = await (0, utils_2.getAztecTestWallet)(PXE, chainId); //(await getAztecWallet(PXE, privateKey as string, "https://aztec-alpha-testnet-fullnode.zkv.xyz", chainId))//wallets[0]
    // get PXE to know about fee contract
    // https://github.com/obsidionlabs/obsidion-wallet/blob/e514a5cea462b66704fa3fd94f14e198dc14a614/packages/backend/index.ts#L320
    console.log({ deployWalletAddress: wallet.getAddress() });
    //------deploy-------------
    const { AztecWarpToad } = await (0, aztecToadWarp_1.deployAztecWarpToad)(nativeToken, wallet, sponsoredPaymentMethod);
    console.log({ AztecWarpToad: AztecWarpToad.address });
    const { L2AztecBridgeAdapter } = await (0, L2AztecBridgeAdapter_1.deployL2AztecBridgeAdapter)(L1AztecAdapterAddress, wallet, sponsoredPaymentMethod);
    console.log({ L2AztecBridgeAdapter: L2AztecBridgeAdapter.address });
    const deployments = { AztecWarpToad: AztecWarpToad.address, L2AztecBridgeAdapter: L2AztecBridgeAdapter.address };
    try {
        await promises_1.default.mkdir(folderPath);
    }
    catch {
        console.warn(`praying the folder already exist ${folderPath}`);
    }
    await promises_1.default.writeFile(deployedAddressesPath, JSON.stringify(deployments, null, 2));
    console.log(`
    deployed: 
        AztecWarpToad:              ${AztecWarpToad.address}
        L2AztecBridgeAdapter:       ${L2AztecBridgeAdapter.address}
    `);
}
main();
