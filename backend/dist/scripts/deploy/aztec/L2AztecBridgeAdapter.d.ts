import { SponsoredFeePaymentMethod } from "@aztec/aztec.js";
import { L2AztecBridgeAdapterContract } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { Wallet as AztecWallet } from "@aztec/aztec.js";
import { ethers } from "ethers";
export declare function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter: ethers.AddressLike, deployerWallet: AztecWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined): Promise<{
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract;
}>;
