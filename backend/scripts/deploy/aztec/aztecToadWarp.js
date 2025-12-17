import { WarpToadCoreContract } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { Fr } from "@aztec/foundation/fields";
export async function deployAztecWarpToad(nativeToken, deployerWallet, sponsoredPaymentMethod, contractAddressSalt) {
    contractAddressSalt ??= Fr.random();
    console.log("deploying Aztec Warptoad");
    const name = `wrapped-warptoad-${await nativeToken.name()}`;
    const symbol = `wrptd-${(await nativeToken.symbol()).toUpperCase()}`;
    const decimals = 6n; // only 6 decimals what is this tether??\
    const constructorArgs = [nativeToken.target, name, symbol, decimals];
    const AztecWarpToad = await WarpToadCoreContract.deploy(deployerWallet, ...constructorArgs).send({ contractAddressSalt: contractAddressSalt, fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 });
    const deployer = (await deployerWallet.getAccounts())[0].item;
    return { AztecWarpToad, constructorArgs, contractAddressSalt, deployer };
}
//# sourceMappingURL=aztecToadWarp.js.map