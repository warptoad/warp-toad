"use strict";
// @NOTICE will be changed to deploy the full WarpToad 
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
const constants_1 = require("../../scripts/lib/constants");
exports.default = (0, modules_1.buildModule)("L2ScrollModule", (m) => {
    const nativeToken = m.getParameter("nativeToken");
    const name = m.getParameter("name");
    const symbol = m.getParameter("symbol");
    const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
    const L1ScrollBridgeAdapterAddress = m.getParameter("L1ScrollBridgeAdapter");
    const l2ScrollMessengerAddress = m.getParameter("l2ScrollMessengerAddress");
    const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress);
    const L1ScrollBridgeAdapter = m.contractAt("L1ScrollBridgeAdapter", L1ScrollBridgeAdapterAddress);
    const LazyIMTLib = m.library("LazyIMT", {
        value: 0n,
        libraries: {
            PoseidonT3: PoseidonT3Lib,
        },
    });
    const withdrawVerifier = m.contract("WithdrawVerifier", [], {
        value: 0n,
        libraries: {},
    });
    const L2WarpToad = m.contract("L2WarpToad", [constants_1.EVM_TREE_DEPTH, withdrawVerifier, nativeToken, name, symbol], {
        value: 0n,
        libraries: {
            LazyIMT: LazyIMTLib,
            PoseidonT3: PoseidonT3Lib
        },
    });
    const L2ScrollBridgeAdapter = m.contract("L2ScrollBridgeAdapter", [l2ScrollMessengerAddress, L1ScrollBridgeAdapter, L2WarpToad], {
        value: 0n,
        libraries: {},
    });
    return { L2WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ScrollBridgeAdapter };
});
