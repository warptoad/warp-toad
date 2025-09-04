const hre = require("hardhat");
// import hre from "hardhat"
import { ethers } from "ethers";
import { deployPoseidon } from "../poseidon";

import L1WarpToadModule from "../../../ignition/modules/L1WarpToad"
import L1InfraModule from "../../../ignition/modules/L1Infra"
import { readFile } from 'fs/promises';

import { ERC20__factory, USDcoin__factory } from "../../../typechain-types";
//@ts-ignore
import er20Abi from "../../dev_op/erc20ABI.json"  with { type: 'json' }
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA } from "../../lib/constants";
import fs from "fs/promises";
import { checkFileExists, getContractAddressesEvm, getEvmDeployedAddressesFilePath, getEvmDeployedAddressesFolderPath, promptBool } from "../../dev_op/utils";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));


async function main() {
    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts  --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const provider = hre.ethers.provider as ethers.Provider
    const chainId = (await provider.getNetwork()).chainId

    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId)
    if(await checkFileExists(deployedAddressesPath)) {
        const contracts = await getContractAddressesEvm(chainId)
        const WarpToadDeployId = "L1WarpToadModule#L1WarpToad"
        if (WarpToadDeployId in contracts) {
            if(await promptBool(`A deployment of ${WarpToadDeployId} already exist at ${deployedAddressesPath} \n Are you sure want to override?`)) {
                await fs.rm(getEvmDeployedAddressesFolderPath(chainId),{force:true, recursive:true})
                console.log("overriding old deployment")
            } else {
                console.log("continuing without redeploying (just verifying)")
            }

        }
    }

    //-----------warptoad------------------------
    const PoseidonT3Address = await deployPoseidon();
    const nativeToken = new ethers.Contract(nativeTokenAddress, er20Abi, provider)
    const name = await nativeToken.name();
    const symbol = await nativeToken.symbol();

    const { L1WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib } = await hre.ignition.deploy(L1WarpToadModule, {
        parameters: {
            L1WarpToadModule: {
                PoseidonT3LibAddress: PoseidonT3Address,
                nativeToken: nativeTokenAddress,
                name: name,
                symbol: symbol,
            }
        },
    });
    const IS_MAINNET = chainId === 1n
    const L1ScrollMessengerAddress = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    //--------------------infra------------------------
    const { gigaBridge, L1AztecBridgeAdapter, L1ScrollBridgeAdapter } = await hre.ignition.deploy(L1InfraModule, {
        parameters: {
            L1InfraModule: {
                LazyIMTLibAddress: LazyIMTLib.target,
                L1WarpToadAddress: L1WarpToad.target,
                L1ScrollMessengerAddress: L1ScrollMessengerAddress
            }
        },
    });
    console.log("aaaaaaaaaaaa", { fragments: L1WarpToad })


    console.log(`
    deployed: 
        LazyIMTLib:                 ${LazyIMTLib.target}
        PoseidonT3Lib:              ${PoseidonT3Lib.target}

        gigaBridge:                 ${gigaBridge.target}
        L1WarpToad:                 ${L1WarpToad.target}
        withdrawVerifier:           ${withdrawVerifier.target}
        
        L1AztecBridgeAdapter:       ${L1AztecBridgeAdapter.target}
        L1ScrollBridgeAdapter:      ${L1ScrollBridgeAdapter.target}
    `)
    if (chainId !== 31337n) {
        // -------verify -----------------
        // TODO make this into a more reusable script / function
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

        const journalDataPerAddress =Object.fromEntries(Object.entries(journalDataPerId).map((v:any) =>{
            if ("contractAddress" in v[1]) {
                return [v[1]["contractAddress"], v[1]]
            } else {
                return [v[1]["result"]["address"], v[1]]
            }
        } ))

        // verify
        const waitTimeBetweenVerify = 1000 * 3
        // ----------- libraries ----------------
        console.log(`verifying: LazyIMTLib: ${LazyIMTLib.target}`)
        await hre.run("verify:verify", {
        address: LazyIMTLib.target,
        contract: "@zk-kit/lazy-imt.sol/LazyIMT.sol:LazyIMT",
        constructorArguments: journalDataPerAddress[LazyIMTLib.target].constructorArgs,
        libraries: journalDataPerAddress[LazyIMTLib.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)

        // console.log(`verifying: poseidon: ${PoseidonT3Lib.target}`)
        // await hre.run("verify:verify", {
        //   address: LazyIMTLib.target,
        //   contract: "poseidon-solidity/PoseidonT3.sol:PoseidonT3",
        //   constructorArguments: journalDataPerAddress[PoseidonT3Lib.target].constructorArgs,
        //   libraries: journalDataPerAddress[PoseidonT3Lib.target].libraries,
        // });
        // await sleep(waitTimeBetweenVerify)
        


        // ------------------- giga bridge -----------------
        console.log(`verifying: gigaBridge: ${gigaBridge.target}`)
        await hre.run("verify:verify", {
        address: gigaBridge.target,
        contract: "contracts/evm/GigaBridge.sol:GigaBridge",
        constructorArguments: journalDataPerAddress[gigaBridge.target].constructorArgs,
        libraries: journalDataPerAddress[gigaBridge.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)
        

        // --------------------- warp toad----------------------
        console.log(`verifying: L1WarpToad: ${L1WarpToad.target}`)
        await hre.run("verify:verify", {
        address: L1WarpToad.target,
        contract: "contracts/evm/warptoad/L1WarpToad.sol:L1WarpToad",
        constructorArguments: journalDataPerAddress[L1WarpToad.target].constructorArgs,
        libraries: journalDataPerAddress[L1WarpToad.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)

        console.log(`verifying: withdrawVerifier: ${withdrawVerifier.target}`)
        await hre.run("verify:verify", {
        address: withdrawVerifier.target,
        contract: "contracts/evm/withdrawVerifier.sol:WithdrawVerifier",
        constructorArguments: journalDataPerAddress[withdrawVerifier.target].constructorArgs,
        libraries: journalDataPerAddress[withdrawVerifier.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)


        //------------ L1 adapters -------------------------
        console.log(`verifying: L1AztecBridgeAdapter: ${L1AztecBridgeAdapter.target}`)
        await hre.run("verify:verify", {
        address: L1AztecBridgeAdapter.target,
        contract: "contracts/evm/adapters/L1AztecBridgeAdapter.sol:L1AztecBridgeAdapter",
        constructorArguments: journalDataPerAddress[L1AztecBridgeAdapter.target].constructorArgs,
        libraries: journalDataPerAddress[L1AztecBridgeAdapter.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)

        console.log(`verifying: L1ScrollBridgeAdapter: ${L1ScrollBridgeAdapter.target}`)
        await hre.run("verify:verify", {
        address: L1ScrollBridgeAdapter.target,
        contract: "contracts/evm/adapters/L1ScrollBridgeAdapter.sol:L1ScrollBridgeAdapter",
        constructorArguments: journalDataPerAddress[L1ScrollBridgeAdapter.target].constructorArgs,
        libraries: journalDataPerAddress[L1ScrollBridgeAdapter.target].libraries,
        });
        await sleep(waitTimeBetweenVerify)
    }

}
main()  