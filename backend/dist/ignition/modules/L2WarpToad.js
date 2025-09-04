"use strict";
// @NOTICE will be changed to deploy the full WarpToad 
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
const constants_1 = require("../../scripts/lib/constants");
// unused. L2s can usually deploy their L2Adapter and warptoad in one module
exports.default = (0, modules_1.buildModule)("L2WarpToadModule", (m) => {
    const nativeToken = m.getParameter("nativeToken");
    const name = m.getParameter("name");
    const symbol = m.getParameter("symbol");
    const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
    const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress);
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
    return { L2WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib };
});
