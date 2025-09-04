//@ts-ignore
import { Contract } from "@aztec/aztec.js";
import { WarpToadCoreContractArtifact } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
export async function deployAztecWarpToad(nativeToken, deployerWallet, sponsoredPaymentMethod) {
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`;
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`;
    const decimals = 6n; // only 6 decimals what is this tether??
    const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals];
    const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({ timeout: 60 * 60 * 12 });
    return { AztecWarpToad };
}
