const hre = require("hardhat");
// import hre from "hardhat"
import { ethers } from "ethers";
import { deployPoseidon } from "./poseidon";

import L1WarpToadModule from "../../ignition/modules/L1WarpToad"
import L1InfraModule from "../../ignition/modules/L1Infra"

import { ERC20__factory, USDcoin__factory } from "../../typechain-types";

import er20Abi from "../dev_op/erc20ABI.json"

async function main() {
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const provider = hre.ethers.provider

    //-----------warptoad------------------------
    const PoseidonT3Address = await deployPoseidon();
    if(!Boolean(nativeTokenAddress)) { 
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts")
    }

    const nativeToken = new ethers.Contract(nativeTokenAddress,er20Abi,provider)

    const name = await nativeToken.name();
    const symbol = await nativeToken.symbol();

    const { L1WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib } = await hre.ignition.deploy(L1WarpToadModule, {
        parameters: {
            L1WarpToadModule: {
                PoseidonT3LibAddress: PoseidonT3Address,
                nativeToken: nativeTokenAddress,
                name:name,
                symbol:symbol,
            }
        },
    });

    //--------------------infra------------------------
    const  {gigaBridge, L1AztecRootBridgeAdapter} = await hre.ignition.deploy(L1InfraModule, {
        parameters: {
            L1InfraModule: {
                LazyIMTLibAddress:LazyIMTLib.target,
                L1WarpToadAddress:L1WarpToad.target
            }
        },
    });    

    console.log(`
    deployed: 
        LazyIMTLib:                 ${LazyIMTLib.target}
        PoseidonT3Lib:              ${PoseidonT3Lib.target}

        gigaBridge:                 ${gigaBridge.target}
        L1WarpToad:                 ${L1WarpToad.target}
        withdrawVerifier:           ${withdrawVerifier.target}
        
        L1AztecRootBridgeAdapter:   ${L1AztecRootBridgeAdapter.target}
    `)

}
main()  