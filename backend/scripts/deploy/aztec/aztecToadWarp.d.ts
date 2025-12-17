import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { WarpToadCoreContract } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore';
import { USDcoin } from '../../../typechain-types';
import { TestWallet } from "@aztec/test-wallet/server";
import { EthAddressLike } from "@aztec/aztec.js/abi";
import { Fr } from "@aztec/foundation/fields";
export declare function deployAztecWarpToad(nativeToken: USDcoin | any, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined, contractAddressSalt?: Fr): Promise<{
    AztecWarpToad: WarpToadCoreContract;
    constructorArgs: [EthAddressLike, string, string, bigint];
    contractAddressSalt: Fr;
    deployer: import("@aztec/stdlib/aztec-address").AztecAddress;
}>;
//# sourceMappingURL=aztecToadWarp.d.ts.map