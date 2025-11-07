
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { WarpToadCoreContract } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
//@ts-ignore
import { USDcoin } from '../../../typechain-types';
import { TestWallet } from "@aztec/test-wallet/server";

export async function deployAztecWarpToad(nativeToken: USDcoin | any, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined) {
    console.log("deploying Aztec Warptoad")
    const name = `wrapped-warptoad-${await nativeToken.name()}`;
    const symbol = `wrptd-${(await nativeToken.symbol()).toUpperCase()}`;
    const decimals = 6n; // only 6 decimals what is this tether??

    const AztecWarpToad = await WarpToadCoreContract.deploy(deployerWallet, nativeToken.target, name, symbol, decimals).send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 });

    return { AztecWarpToad };
}