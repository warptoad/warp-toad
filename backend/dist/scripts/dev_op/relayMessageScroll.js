"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../lib/constants");
const utils_1 = require("../dev_op/utils");
const hardhat_1 = __importDefault(require("hardhat"));
const bridging_1 = require("../lib/bridging");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function main() {
    const provider = hardhat_1.default.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    const IS_MAINNET = chainId === 1n;
    const L1_SCROLL_MESSENGER = IS_MAINNET ? constants_1.L1_SCROLL_MESSENGER_MAINNET : constants_1.L1_SCROLL_MESSENGER_SEPOLIA;
    const SCROLL_CHAINID = IS_MAINNET ? constants_1.SCROLL_CHAINID_MAINNET : constants_1.SCROLL_CHAINID_SEPOLIA;
    const signer = (await hardhat_1.default.ethers.getSigners())[0];
    const scrollContracts = await (0, utils_1.getContractAddressesEvm)(SCROLL_CHAINID);
    const sepoliaContracts = await (0, utils_1.getContractAddressesEvm)(constants_1.SEPOLIA_CHAINID);
    const adapterContract = scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]; //sepoliaContracts["L1InfraModule#L1ScrollBridgeAdapter"] //scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]
    const claimInfo = await (0, bridging_1.getClaimDataScroll)(adapterContract, "0xab8eaf99b303d69dcc763fd300e5513979c44d538b08e0d2720cc6c84717fef4");
    const tx = await (await (0, bridging_1.claimL1WithdrawScroll)(claimInfo, signer)).wait(1);
    console.log({ txhash: tx?.hash });
}
main();
