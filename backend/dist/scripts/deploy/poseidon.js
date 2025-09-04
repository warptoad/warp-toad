"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployPoseidon = deployPoseidon;
const hre = require("hardhat");
const poseidon_solidity_1 = __importDefault(require("poseidon-solidity"));
const poseidon_lite_1 = require("poseidon-lite");
const ethers_1 = require("ethers");
const typechain_types_1 = require("../../typechain-types");
async function deployPoseidon() {
    //https://github.com/chancehudson/poseidon-solidity/tree/main?tab=readme-ov-file#deploy
    //readme is wrong using ethers.provider instead of hre.ethers.provider
    const provider = hre.ethers.provider;
    // common js imports struggles
    const proxy = poseidon_solidity_1.default.proxy;
    const PoseidonT3 = poseidon_solidity_1.default.PoseidonT3;
    const [sender] = await hre.ethers.getSigners();
    // First check if the proxy exists
    if (await provider.getCode(proxy.address) === '0x') {
        // fund the keyless account
        await sender.sendTransaction({
            to: proxy.from,
            value: proxy.gas,
        });
        //readme is wrong using provider.sendTransaction
        // then send the presigned transaction deploying the proxy
        await provider.broadcastTransaction(proxy.tx);
    }
    else {
        console.log(`Proxy for poseidon was already deployed at: ${proxy.address}`);
    }
    // Then deploy the hasher, if needed
    if (await provider.getCode(PoseidonT3.address) === '0x') {
        //readme is wrong having typo here: send.sendTransaction instead of sender
        await sender.sendTransaction({
            to: proxy.address,
            data: PoseidonT3.data
        });
    }
    else {
        console.log(`PoseidonT3 was already deployed at: ${PoseidonT3.address}`);
    }
    const preImg = [1234n, 5678n];
    const jsHash = (0, poseidon_lite_1.poseidon2)(preImg);
    const PoseidonT3Contract = typechain_types_1.PoseidonT3__factory.connect(PoseidonT3.address, provider);
    //@ts-ignore
    const solHash = await PoseidonT3Contract.hash(preImg);
    //@ts-ignore
    ethers_1.ethers.assert(jsHash === solHash, "whoop hash didn't match something is really wrong!!");
    console.log(`PoseidonT3 deployed to: ${PoseidonT3.address}`);
    return PoseidonT3.address;
}
