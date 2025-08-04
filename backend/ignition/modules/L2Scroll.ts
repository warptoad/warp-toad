// @NOTICE will be changed to deploy the full WarpToad 

//@ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { EVM_TREE_DEPTH } from "../../scripts/lib/constants";
import { ethers } from "ethers";
import { IgnitionModuleBuilder } from "@nomicfoundation/ignition-core";

export default buildModule("L2ScrollModule", (m: any) => {
    
    const nativeToken = m.getParameter("nativeToken");
    const name = m.getParameter("name");
    const symbol = m.getParameter("symbol");
    const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
    const L1ScrollBridgeAdapterAddress = m.getParameter("L1ScrollBridgeAdapter");
    const l2ScrollMessengerAddress = m.getParameter("l2ScrollMessengerAddress");
    const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress)
    const L1ScrollBridgeAdapter = m.contractAt("L1ScrollBridgeAdapter", L1ScrollBridgeAdapterAddress)
    const LazyIMTLib = m.library("LazyIMT", {
        value: 0n,
        libraries: {
            PoseidonT3: PoseidonT3Lib,
        },
    });

    const withdrawVerifier = m.contract("WithdrawVerifier", [], {
        value: 0n,
        libraries: {
        },
    });

    const L2WarpToad = m.contract("L2WarpToad", [EVM_TREE_DEPTH, withdrawVerifier, nativeToken, name, symbol], {
        value: 0n,
        libraries: {
            LazyIMT: LazyIMTLib,
            PoseidonT3: PoseidonT3Lib
        },
    });

    const L2ScrollBridgeAdapter = m.contract("L2ScrollBridgeAdapter", [l2ScrollMessengerAddress, L1ScrollBridgeAdapter, L2WarpToad], {
        value: 0n,
        libraries: {
        },
    });

    return { L2WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ScrollBridgeAdapter };
});
