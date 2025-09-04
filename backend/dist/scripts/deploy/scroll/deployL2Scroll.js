"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//const hre = require("hardhat");
const hardhat_1 = __importDefault(require("hardhat"));
const ethers_1 = require("ethers");
const poseidon_1 = require("../poseidon");
const L2Scroll_1 = __importDefault(require("../../../ignition/modules/L2Scroll"));
//@ts-ignore
const erc20ABI_json_1 = __importDefault(require("../../dev_op/erc20ABI.json"));
const utils_1 = require("../../dev_op/utils");
const promises_1 = require("fs/promises");
const promises_2 = __importDefault(require("fs/promises"));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const config_js_1 = require("hardhat/config.js");
const constants_1 = require("../../lib/constants");
const SEPOLIA_URL = config_js_1.vars.get("SEPOLIA_URL");
async function main() {
    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox");
    }
    else if (!ethers_1.ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`);
    }
    const provider = hardhat_1.default.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    const deployedAddressesPath = (0, utils_1.getEvmDeployedAddressesFilePath)(chainId);
    if (await (0, utils_1.checkFileExists)(deployedAddressesPath)) {
        if (await (0, utils_1.promptBool)(`A deployment already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
            await promises_2.default.rm((0, utils_1.getEvmDeployedAddressesFolderPath)(chainId), { force: true, recursive: true });
            console.log("overriding old deployment");
        }
        else {
            console.log("continuing without redeploying (just verifying)");
        }
    }
    const IS_SCROLL_MAINNET = chainId === 534352n;
    if (IS_SCROLL_MAINNET) {
        throw new Error("l1Provider not setup for mainnet TODO");
    }
    const nativeTokenAddress = ethers_1.ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS);
    const l1Provider = new ethers_1.ethers.JsonRpcProvider(SEPOLIA_URL);
    const l1ChainId = (await l1Provider.getNetwork()).chainId;
    //-----------warptoad------------------------
    const PoseidonT3Address = await (0, poseidon_1.deployPoseidon)();
    const nativeToken = new ethers_1.ethers.Contract(nativeTokenAddress, erc20ABI_json_1.default, l1Provider);
    const name = await nativeToken.name();
    const symbol = await nativeToken.symbol();
    const L1DeployedAddresses = await (0, utils_1.getContractAddressesEvm)(l1ChainId);
    const GigaBridgeAddress = L1DeployedAddresses["L1InfraModule#GigaBridge"];
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"];
    const l2ScrollMessengerAddress = IS_SCROLL_MAINNET ? constants_1.L2_SCROLL_MESSENGER_MAINNET : constants_1.L2_SCROLL_MESSENGER_SEPOLIA;
    const { L2WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ScrollBridgeAdapter } = await hardhat_1.default.ignition.deploy(L2Scroll_1.default, {
        parameters: {
            L2ScrollModule: {
                PoseidonT3LibAddress: PoseidonT3Address,
                nativeToken: nativeTokenAddress,
                name: name,
                symbol: symbol,
                L1ScrollBridgeAdapter: L1ScrollBridgeAdapterAddress,
                l2ScrollMessengerAddress: l2ScrollMessengerAddress
            }
        },
    });
    console.log(`
    deployed: 
        LazyIMTLib:                 ${LazyIMTLib.target}
        PoseidonT3Lib:              ${PoseidonT3Lib.target}

        L2WarpToad:                 ${L2WarpToad.target}
        withdrawVerifier:           ${withdrawVerifier.target}
        
        L2ScrollBridgeAdapter:      ${L2ScrollBridgeAdapter.target}
    `);
    // -------verify -----------------
    // gather data for constructor arguments and libraries
    const journalFilePath = `ignition/deployments/chain-${(await provider.getNetwork()).chainId}/journal.jsonl`;
    const journal = await (0, promises_1.readFile)(journalFilePath, 'utf8');
    const parsedJournal = journal.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    const journalDataPerId = parsedJournal.reduce((allData, currentLine) => {
        if ("futureId" in currentLine) {
            const contractName = currentLine["futureId"].split("#")[1];
            if (contractName in allData) {
                allData[contractName] = { ...currentLine, ...allData[contractName] };
            }
            else {
                allData[contractName] = currentLine;
            }
        }
        return allData;
    }, {});
    const journalDataPerAddress = Object.fromEntries(Object.entries(journalDataPerId).map((v) => {
        if ("contractAddress" in v[1]) {
            return [v[1]["contractAddress"], v[1]];
        }
        else {
            return [v[1]["result"]["address"], v[1]];
        }
    }));
    // verify
    const waitTimeBetweenVerify = 1000 * 3;
    // ----------- libraries ----------------
    // not possible with sane dev ux with hardhat, since this contract was compiled in a very old version of solidity.
    // usually poseidon is already deployed and verified, or you can let etherscan know on which chain it already is verified.
    // other just clone the original repo and verify it from there (copy pasting into etherscan didn't work for me either)
    // console.log(`verifying: poseidon: ${PoseidonT3Address}`)
    // await hre.run("verify:verify", {
    //     force: true,
    //     address: PoseidonT3Address,
    //     contract: "poseidon-solidity/PoseidonT3.sol:PoseidonT3",
    //     constructorArguments: journalDataPerAddress[PoseidonT3Address as string].constructorArgs,
    //     libraries: journalDataPerAddress[PoseidonT3Address as string].libraries,
    //     compilerVersion: "v0.7.6",
    //     optimizations: {
    //         enabled: true, 
    //         runs: 2**32-1, 
    //     },
    // });
    // await sleep(waitTimeBetweenVerify)
    console.log(`verifying: LazyIMTLib: ${LazyIMTLib.target}`);
    await hardhat_1.default.run("verify:verify", {
        address: LazyIMTLib.target,
        contract: "@zk-kit/lazy-imt.sol/LazyIMT.sol:LazyIMT",
        constructorArguments: journalDataPerAddress[LazyIMTLib.target].constructorArgs,
        libraries: journalDataPerAddress[LazyIMTLib.target].libraries,
    });
    await sleep(waitTimeBetweenVerify);
    // --------------------- warp toad----------------------
    console.log(`verifying: L2WarpToad: ${L2WarpToad.target}`);
    await hardhat_1.default.run("verify:verify", {
        address: L2WarpToad.target,
        contract: "contracts/evm/warptoad/L2WarpToad.sol:L2WarpToad",
        constructorArguments: journalDataPerAddress[L2WarpToad.target].constructorArgs,
        libraries: journalDataPerAddress[L2WarpToad.target].libraries,
    });
    await sleep(waitTimeBetweenVerify);
    console.log(`verifying: withdrawVerifier: ${withdrawVerifier.target}`);
    await hardhat_1.default.run("verify:verify", {
        address: withdrawVerifier.target,
        contract: "contracts/evm/withdrawVerifier.sol:WithdrawVerifier",
        constructorArguments: journalDataPerAddress[withdrawVerifier.target].constructorArgs,
        libraries: journalDataPerAddress[withdrawVerifier.target].libraries,
    });
    await sleep(waitTimeBetweenVerify);
    //------------ L1 adapters -------------------------
    console.log(`verifying: L2ScrollBridgeAdapter: ${L2ScrollBridgeAdapter.target}`);
    await hardhat_1.default.run("verify:verify", {
        address: L2ScrollBridgeAdapter.target,
        contract: "contracts/evm/adapters/L2ScrollBridgeAdapter.sol:L2ScrollBridgeAdapter",
        constructorArguments: journalDataPerAddress[L2ScrollBridgeAdapter.target].constructorArgs,
        libraries: journalDataPerAddress[L2ScrollBridgeAdapter.target].libraries,
    });
    await sleep(waitTimeBetweenVerify);
}
main();
