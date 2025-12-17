import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { L2AztecBridgeAdapterContract } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { TestWallet } from "@aztec/test-wallet/server";
import { EthAddressLike } from "@aztec/aztec.js/abi";
import { Fr } from "@aztec/foundation/fields";
export declare function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter: EthAddressLike, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined, contractAddressSalt?: Fr): Promise<{
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract;
    constructorArgs: [EthAddressLike];
    contractAddressSalt: Fr;
    deployer: import("@aztec/stdlib/aztec-address").AztecAddress;
}>;
//# sourceMappingURL=L2AztecBridgeAdapter.d.ts.map