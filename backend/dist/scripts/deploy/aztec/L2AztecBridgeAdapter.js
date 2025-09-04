//@ts-ignore
import { Contract } from "@aztec/aztec.js";
//@ts-ignore
import { L2AztecBridgeAdapterContractArtifact } from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
const { PXE_URL = 'http://localhost:8080' } = process.env;
export async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter, deployerWallet, sponsoredPaymentMethod) {
    const constructorArgs = [L1AztecBridgeAdapter];
    const L2AztecBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecBridgeAdapterContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({ timeout: 60 * 60 * 12 });
    return { L2AztecBridgeAdapter };
}
