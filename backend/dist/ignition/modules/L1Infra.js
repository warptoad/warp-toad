"use strict";
// @NOTICE will be changed to deploy the full WarpToad 
Object.defineProperty(exports, "__esModule", { value: true });
//@ts-ignore
const modules_1 = require("@nomicfoundation/hardhat-ignition/modules");
const constants_1 = require("../../scripts/lib/constants");
exports.default = (0, modules_1.buildModule)("L1InfraModule", (m) => {
    const L1ScrollMessengerAddress = m.getParameter("L1ScrollMessengerAddress");
    const LazyIMTLibAddress = m.getParameter("LazyIMTLibAddress");
    const L1WarpToadAddress = m.getParameter("L1WarpToadAddress");
    const LazyIMTLib = m.contractAt("LazyIMT", LazyIMTLibAddress);
    const L1WarpToad = m.contractAt("L1WarpToad", L1WarpToadAddress);
    const L1AztecBridgeAdapter = m.contract("L1AztecBridgeAdapter", [], {
        value: 0n,
        libraries: {},
    });
    const L1ScrollBridgeAdapter = m.contract("L1ScrollBridgeAdapter", [L1ScrollMessengerAddress], {
        value: 0n,
        libraries: {},
    });
    // TODO l1ScrollAdapter
    const L1Adapters = [L1AztecBridgeAdapter, L1ScrollBridgeAdapter]; // TODO add l1ScrollAdapter
    const gigaRootRecipients = [L1WarpToad, ...L1Adapters];
    const gigaBridgeConstructorArgs = [gigaRootRecipients, constants_1.GIGA_TREE_DEPTH];
    const gigaBridge = m.contract("GigaBridge", gigaBridgeConstructorArgs, {
        value: 0n,
        libraries: {
            LazyIMT: LazyIMTLib,
        }
    });
    return { gigaBridge, L1AztecBridgeAdapter, L1ScrollBridgeAdapter };
});
