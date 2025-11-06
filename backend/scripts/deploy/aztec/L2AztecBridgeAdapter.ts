import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
//@ts-ignore
import { L2AztecBridgeAdapterContract } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter'

import { TestWallet } from "@aztec/test-wallet/server";
import { EthAddressLike } from "@aztec/aztec.js/abi";

export async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter: EthAddressLike, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined) {

    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.deploy(deployerWallet, L1AztecBridgeAdapter).send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 }) as L2AztecBridgeAdapterContract;

    return { L2AztecBridgeAdapter };
}
