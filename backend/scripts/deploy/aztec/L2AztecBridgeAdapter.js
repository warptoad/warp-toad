//@ts-ignore
import { L2AztecBridgeAdapterContract } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
import { Fr } from "@aztec/foundation/fields";
export async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter, deployerWallet, sponsoredPaymentMethod, contractAddressSalt) {
    contractAddressSalt ??= Fr.random();
    const constructorArgs = [L1AztecBridgeAdapter];
    const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.deploy(deployerWallet, ...constructorArgs).send({ contractAddressSalt: contractAddressSalt, fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 });
    const deployer = (await deployerWallet.getAccounts())[0].item;
    return { L2AztecBridgeAdapter, constructorArgs, contractAddressSalt, deployer };
}
//# sourceMappingURL=L2AztecBridgeAdapter.js.map