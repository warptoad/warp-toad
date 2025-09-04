"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
exports.default = (0, modules_1.buildModule)("TestToken", (m) => {
    const USDcoin = m.contract("USDcoin", [], {});
    return { USDcoin };
});
