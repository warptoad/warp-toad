"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployL2AztecBridgeAdapter = deployL2AztecBridgeAdapter;
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
//@ts-ignore
const L2AztecBridgeAdapter_1 = require("../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter");
const { PXE_URL = 'http://localhost:8080' } = process.env;
async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter, deployerWallet, sponsoredPaymentMethod) {
    const constructorArgs = [L1AztecBridgeAdapter];
    const L2AztecBridgeAdapter = await aztec_js_1.Contract.deploy(deployerWallet, L2AztecBridgeAdapter_1.L2AztecBridgeAdapterContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({ timeout: 60 * 60 * 12 });
    return { L2AztecBridgeAdapter };
}
