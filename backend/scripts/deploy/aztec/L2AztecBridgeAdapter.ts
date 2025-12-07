import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
//@ts-ignore
import { L2AztecBridgeAdapterContract } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter'

import { TestWallet } from "@aztec/test-wallet/server";
import { EthAddressLike } from "@aztec/aztec.js/abi";
import { Fr } from "@aztec/foundation/fields";

export async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter: EthAddressLike, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined, contractAddressSalt?: Fr) {
    contractAddressSalt ??= Fr.random()
    const constructorArgs: [EthAddressLike] = [L1AztecBridgeAdapter]
    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.deploy(deployerWallet, ...constructorArgs).send({ contractAddressSalt: contractAddressSalt, fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 }) as L2AztecBridgeAdapterContract;
    const deployer = (await deployerWallet.getAccounts())[0].item
    return { L2AztecBridgeAdapter, constructorArgs, contractAddressSalt, deployer };
}
