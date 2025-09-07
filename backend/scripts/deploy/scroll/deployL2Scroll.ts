//const hre = require("hardhat");
import hre from "hardhat"
import { ethers } from "ethers";
import { deployPoseidon } from "../poseidon";

import L2Scroll from "../../../ignition/modules/L2Scroll"
//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' }
import { getContractAddressesEvm } from "../../dev_op/deployment";
import {  checkFileExists, getEvmDeployedAddressesFilePath, getEvmDeployedAddressesFolderPath, promptBool } from "../../dev_op/utils";

import { readFile } from 'fs/promises';
import fs from 'fs/promises';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

import { vars } from "hardhat/config.js";
import { L2_SCROLL_MESSENGER_MAINNET, L2_SCROLL_MESSENGER_SEPOLIA } from "../../lib/constants";

const SEPOLIA_URL = vars.get("SEPOLIA_URL")

async function main() {
    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    const provider = hre.ethers.provider
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId)
    if(await checkFileExists(deployedAddressesPath)) {
        if(await promptBool(`A deployment already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
            await fs.rm(getEvmDeployedAddressesFolderPath(chainId),{force:true, recursive:true})
            console.log("overriding old deployment")
        } else {
            console.log("continuing without redeploying (just verifying)")
        }
    }
    const IS_SCROLL_MAINNET = chainId === 534352n
    if (IS_SCROLL_MAINNET) { throw new Error("l1Provider not setup for mainnet TODO") }

    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const l1Provider = new ethers.JsonRpcProvider(SEPOLIA_URL)
    const l1ChainId = (await l1Provider.getNetwork()).chainId

    //-----------warptoad------------------------
    const PoseidonT3Address = await deployPoseidon();
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, l1Provider)
    const name = await nativeToken.name();
    const symbol = await nativeToken.symbol();


    const L1DeployedAddresses = await getContractAddressesEvm(l1ChainId)
    const GigaBridgeAddress = L1DeployedAddresses["L1InfraModule#GigaBridge"]
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"]
    const l2ScrollMessengerAddress = IS_SCROLL_MAINNET ? L2_SCROLL_MESSENGER_MAINNET : L2_SCROLL_MESSENGER_SEPOLIA

    const { L2WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ScrollBridgeAdapter } = await hre.ignition.deploy(L2Scroll, {
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
    `)

    // -------verify -----------------

    // gather data for constructor arguments and libraries
    const journalFilePath = `ignition/deployments/chain-${(await provider.getNetwork()).chainId}/journal.jsonl`
    const journal = await readFile(journalFilePath, 'utf8');
    const parsedJournal = journal.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    const journalDataPerId = parsedJournal.reduce((allData, currentLine) => {
        if ("futureId" in currentLine) {
            const contractName = currentLine["futureId"].split("#")[1]
            if (contractName in allData) {
                allData[contractName] = { ...currentLine, ...allData[contractName] }
            } else {
                allData[contractName] = currentLine
            }
        }
        return allData
    }, {})

    const journalDataPerAddress = Object.fromEntries(Object.entries(journalDataPerId).map((v: any) => {
        if ("contractAddress" in v[1]) {
            return [v[1]["contractAddress"], v[1]]
        } else {
            return [v[1]["result"]["address"], v[1]]
        }
    }))

    // verify
    const waitTimeBetweenVerify = 1000 * 3


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


    console.log(`verifying: LazyIMTLib: ${LazyIMTLib.target}`)
    await hre.run("verify:verify", {
        address: LazyIMTLib.target,
        contract: "@zk-kit/lazy-imt.sol/LazyIMT.sol:LazyIMT",
        constructorArguments: journalDataPerAddress[LazyIMTLib.target as string].constructorArgs,
        libraries: journalDataPerAddress[LazyIMTLib.target as string].libraries,
    });
    await sleep(waitTimeBetweenVerify)

    // --------------------- warp toad----------------------
    console.log(`verifying: L2WarpToad: ${L2WarpToad.target}`)
    await hre.run("verify:verify", {
        address: L2WarpToad.target,
        contract: "contracts/evm/warptoad/L2WarpToad.sol:L2WarpToad",
        constructorArguments: journalDataPerAddress[L2WarpToad.target as string].constructorArgs,
        libraries: journalDataPerAddress[L2WarpToad.target as string].libraries,
    });
    await sleep(waitTimeBetweenVerify)

    console.log(`verifying: withdrawVerifier: ${withdrawVerifier.target}`)
    await hre.run("verify:verify", {
        address: withdrawVerifier.target,
        contract: "contracts/evm/withdrawVerifier.sol:WithdrawVerifier",
        constructorArguments: journalDataPerAddress[withdrawVerifier.target as string].constructorArgs,
        libraries: journalDataPerAddress[withdrawVerifier.target as string].libraries,
    });
    await sleep(waitTimeBetweenVerify)


    //------------ L1 adapters -------------------------
    console.log(`verifying: L2ScrollBridgeAdapter: ${L2ScrollBridgeAdapter.target}`)
    await hre.run("verify:verify", {
        address: L2ScrollBridgeAdapter.target,
        contract: "contracts/evm/adapters/L2ScrollBridgeAdapter.sol:L2ScrollBridgeAdapter",
        constructorArguments: journalDataPerAddress[L2ScrollBridgeAdapter.target as string].constructorArgs,
        libraries: journalDataPerAddress[L2ScrollBridgeAdapter.target as string].libraries,
    });
    await sleep(waitTimeBetweenVerify)
}
main()  