import { SponsoredFeePaymentMethod } from "@aztec/aztec.js";
import { WarpToadCoreContract as AztecWarpToadCore } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { Wallet as AztecWallet } from "@aztec/aztec.js";
import { USDcoin } from '../../../typechain-types';
export declare function deployAztecWarpToad(nativeToken: USDcoin | any, deployerWallet: AztecWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined): Promise<{
    AztecWarpToad: AztecWarpToadCore;
}>;
