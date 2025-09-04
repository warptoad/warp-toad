"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployAztecWarpToad = deployAztecWarpToad;
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
const WarpToadCore_1 = require("../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore");
async function deployAztecWarpToad(nativeToken, deployerWallet, sponsoredPaymentMethod) {
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`;
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`;
    const decimals = 6n; // only 6 decimals what is this tether??
    const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals];
    const AztecWarpToad = await aztec_js_1.Contract.deploy(deployerWallet, WarpToadCore_1.WarpToadCoreContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({ timeout: 60 * 60 * 12 });
    return { AztecWarpToad };
}
