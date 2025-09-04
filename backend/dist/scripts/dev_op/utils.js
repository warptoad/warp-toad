"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports.EVM_DEPLOYMENT_FOLDER_PATH = exports.AZTEC_DEPLOYED_FOLDER_PATH = void 0;
exports.getAztecDeployedAddressesFolderPath = getAztecDeployedAddressesFolderPath;
exports.getAztecDeployedAddressesFilePath = getAztecDeployedAddressesFilePath;
exports.getEvmDeployedAddressesFolderPath = getEvmDeployedAddressesFolderPath;
exports.getEvmDeployedAddressesFilePath = getEvmDeployedAddressesFilePath;
exports.getContractAddressesAztec = getContractAddressesAztec;
exports.getContractAddressesEvm = getContractAddressesEvm;
exports.getL1Adapter = getL1Adapter;
exports.getL1Contracts = getL1Contracts;
exports.getL2EvmContracts = getL2EvmContracts;
exports.getL2AZTECContracts = getL2AZTECContracts;
exports.getL2Contracts = getL2Contracts;
exports.createRandomAztecPrivateKey = createRandomAztecPrivateKey;
exports.deploySchnorrAccount = deploySchnorrAccount;
exports.getSponsoredFPCInstance = getSponsoredFPCInstance;
exports.getAztecTestWallet = getAztecTestWallet;
exports.checkFileExists = checkFileExists;
exports.promptBool = promptBool;
const promises_1 = require("readline/promises");
const process_1 = require("process");
const promises_2 = __importDefault(require("fs/promises"));
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
//@ts-ignore
const SponsoredFPC_1 = require("@aztec/noir-contracts.js/SponsoredFPC");
//@ts-ignore
const schnorr_1 = require("@aztec/accounts/schnorr");
//@ts-ignore
const keys_1 = require("@aztec/stdlib/keys");
//@ts-ignore
const testing_1 = require("@aztec/accounts/testing");
//@ts-ignore
const constants_1 = require("@aztec/constants");
const constants_2 = require("../lib/constants");
// evm 
const typechain_types_1 = require("../../typechain-types");
// aztec
const WarpToadCore_1 = require("../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore");
const L2AztecBridgeAdapter_1 = require("../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter");
// constants
const projectRoot = `${__dirname}/../../`;
exports.AZTEC_DEPLOYED_FOLDER_PATH = `${projectRoot}/scripts/deploy/aztec/aztecDeployments/`;
exports.EVM_DEPLOYMENT_FOLDER_PATH = `${projectRoot}/ignition/deployments`;
const delay = async (timeInMs) => await new Promise((resolve) => setTimeout(resolve, timeInMs));
exports.delay = delay;
function getAztecDeployedAddressesFolderPath(chainId) {
    return `${exports.AZTEC_DEPLOYED_FOLDER_PATH}/${Number(chainId)}`;
}
function getAztecDeployedAddressesFilePath(chainId) {
    return `${getAztecDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
function getEvmDeployedAddressesFolderPath(chainId) {
    return `${exports.EVM_DEPLOYMENT_FOLDER_PATH}/chain-${Number(chainId)}`;
}
function getEvmDeployedAddressesFilePath(chainId) {
    return `${getEvmDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
async function getContractAddressesAztec(chainId) {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId);
    const json = (await promises_2.default.readFile(deployedAddressesPath)).toString();
    return JSON.parse(json);
}
async function getContractAddressesEvm(chainId) {
    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId);
    const json = (await promises_2.default.readFile(deployedAddressesPath)).toString();
    return JSON.parse(json);
}
function getL1Adapter(l2ChainId, isAztec = false, signer, allL1Contracts) {
    if ((!l2ChainId) && (!isAztec)) {
        throw new Error("either set isAztec to true, or provide a l2ChainId both cannot be falsy");
    }
    if (isAztec) {
        return typechain_types_1.L1AztecBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1AztecBridgeAdapter"], signer);
    }
    switch (l2ChainId) {
        case constants_2.SCROLL_CHAINID_MAINNET:
        case constants_2.SCROLL_CHAINID_SEPOLIA:
            return typechain_types_1.L1ScrollBridgeAdapter__factory.connect(allL1Contracts["L1InfraModule#L1ScrollBridgeAdapter"], signer);
        default:
            throw new Error("unknown chainId :/");
    }
}
async function getL1Contracts(l1ChainId, l2ChainId, signer, isAztec = false) {
    const l1Contracts = await getContractAddressesEvm(l1ChainId);
    const L1Adapter = getL1Adapter(l2ChainId, isAztec, signer, l1Contracts);
    const gigaBridge = typechain_types_1.GigaBridge__factory.connect(l1Contracts["L1InfraModule#GigaBridge"], signer);
    return { L1Adapter, gigaBridge };
}
async function getL2EvmContracts(l2ChainId, signer) {
    const l2Contracts = await getContractAddressesEvm(l2ChainId);
    let L2Adapter;
    let L2WarpToad;
    switch (l2ChainId) {
        case constants_2.SCROLL_CHAINID_MAINNET:
        case constants_2.SCROLL_CHAINID_SEPOLIA:
            L2Adapter = typechain_types_1.L2ScrollBridgeAdapter__factory.connect(l2Contracts["L2ScrollModule#L2ScrollBridgeAdapter"], signer);
            L2WarpToad = typechain_types_1.L2WarpToad__factory.connect(l2Contracts["L2ScrollModule#L2WarpToad"], signer);
        default:
            // throw new Error("unknown chainId :/")
            break;
    }
    return { L2Adapter: L2Adapter, L2WarpToad: L2WarpToad };
}
async function getL2AZTECContracts(l1ChainId, l2Wallet, PXE, aztecNodeUrl) {
    console.log({ l1ChainId });
    const isSandBox = BigInt(l1ChainId) === 31337n;
    const contracts = await getContractAddressesAztec(l1ChainId);
    const L2AztecAdapterAddress = contracts["L2AztecBridgeAdapter"];
    const AztecWarpToadAddress = contracts["AztecWarpToad"];
    if (!isSandBox) {
        const node = (0, aztec_js_1.createAztecNodeClient)(aztecNodeUrl);
        const AztecWarpToadContract = await node.getContract(AztecWarpToadAddress);
        await PXE.registerContract({
            instance: AztecWarpToadContract,
            artifact: WarpToadCore_1.WarpToadCoreContractArtifact,
        });
        await (0, exports.delay)(10000);
        const L2AztecAdapterContract = await node.getContract(L2AztecAdapterAddress);
        await PXE.registerContract({
            instance: L2AztecAdapterContract,
            artifact: L2AztecBridgeAdapter_1.L2AztecBridgeAdapterContractArtifact,
        });
        await (0, exports.delay)(10000);
    }
    const L2AztecBridgeAdapter = await L2AztecBridgeAdapter_1.L2AztecBridgeAdapterContract.at(L2AztecAdapterAddress, l2Wallet);
    const AztecWarpToad = await WarpToadCore_1.WarpToadCoreContract.at(AztecWarpToadAddress, l2Wallet);
    return { L2Adapter: L2AztecBridgeAdapter, L2WarpToad: AztecWarpToad };
}
async function getL2Contracts(l2Wallet, l1ChainId, l2ChainId, isAztec, PXE, aztecNodeUrl) {
    if (isAztec) {
        return await getL2AZTECContracts(l1ChainId, l2Wallet, PXE, aztecNodeUrl);
    }
    else {
        return await getL2EvmContracts(l2ChainId, l2Wallet);
    }
}
function createRandomAztecPrivateKey() {
    const privKey = aztec_js_1.GrumpkinScalar.random();
    const scalar = privKey.toBigInt(); // bigint
    const hex = '0x' + scalar.toString(16).padStart(64, '0');
    return hex;
}
// from https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/src/utils/deploy_account.ts#L9
async function deploySchnorrAccount(pxe, hexSecretKey, saltString) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPC_1.SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new aztec_js_1.SponsoredFeePaymentMethod(sponsoredFPC.address);
    let secretKey = aztec_js_1.Fr.fromHexString(hexSecretKey ? hexSecretKey : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122"); //0x46726565416c65787950657274736576416e64526f6d616e53746f726d2121
    let salt = aztec_js_1.Fr.fromHexString(saltString ? saltString : "0x46726565416c65787950657274736576416e64526f6d616e53746f726d2122"); //Fr.random();
    let schnorrAccount = await (0, schnorr_1.getSchnorrAccount)(pxe, secretKey, (0, keys_1.deriveSigningKey)(secretKey), salt.toBigInt());
    try {
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: 60 * 60 * 12 });
    }
    catch (error) {
        const exceptedError = "Invalid tx: Existing nullifier";
        //@ts-ignore
        if (error.message.startsWith(exceptedError)) {
            //@ts-ignore
            console.log(`Ran into a error: ${error.message} deploying account: ${schnorrAccount.getAddress()}.\n Assuming that means the account already exist!`);
        }
        else {
            console.error(`Couldn't deploy schnorr account and it is also likely not already deployed since this isn't caused by the error: ${exceptedError}`, { cause: error });
        }
    }
    let wallet = await schnorrAccount.getWallet();
    return schnorrAccount;
}
async function getSponsoredFPCInstance() {
    //@ts-ignore
    return await (0, aztec_js_1.getContractInstanceFromDeployParams)(SponsoredFPC_1.SponsoredFPCContract.artifact, {
        salt: new aztec_js_1.Fr(constants_1.SPONSORED_FPC_SALT),
    });
}
// based of https://github.com/AztecProtocol/aztec-starter/blob/d9a8377aa240c4e75e3bf7912f3c58681927ba7e/scripts/deploy_contract.ts#L22
async function getTestnetWallet(pxe) {
    const sponsoredFPC = await getSponsoredFPCInstance();
    //@ts-ignore
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPC_1.SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new aztec_js_1.SponsoredFeePaymentMethod(sponsoredFPC.address);
    let accountManager = await deploySchnorrAccount(pxe);
    const wallet = await accountManager.getWallet();
    return { wallet, sponsoredPaymentMethod };
}
/**
 * get test wallet for either testnet or sandbox. Probably breaks on mainnet since it relies on a faucet fee sponsor (FPC)
 * @param PXE
 * @param chainId
 * @returns
 */
async function getAztecTestWallet(PXE, chainId) {
    if (chainId == 31337n) {
        console.warn("assuming ur on sandbox since chainId is 31337");
        return { wallet: (await (0, testing_1.getInitialTestAccountsWallets)(PXE))[0], sponsoredPaymentMethod: undefined };
    }
    else {
        console.warn("assuming ur on testnet since chainId is NOT 31337");
        return await getTestnetWallet(PXE);
    }
}
async function checkFileExists(filePath) {
    try {
        await promises_2.default.access(filePath);
        return true;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}
async function promptBool(question) {
    const rl = (0, promises_1.createInterface)({ input: process_1.stdin, output: process_1.stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}
