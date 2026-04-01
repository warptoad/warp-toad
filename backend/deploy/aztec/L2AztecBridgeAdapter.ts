import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
// TODO: Update import once Aztec codegen is generated
// import { L2AztecBridgeAdapterContract } from '../../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter';
// TODO: TestWallet was removed in v4, use @aztec/wallets equivalent
import { EthAddressLike } from "@aztec/aztec.js/abi";
import { Fr } from "@aztec/aztec.js/fields";
import { deployAndCreateDeploymentArtifact } from "../utils/aztecUtilsNoEnv";

export async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter: EthAddressLike, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined, contractAddressSalt?: Fr) {
    contractAddressSalt ??= Fr.random()
    const constructorArgs: [EthAddressLike] = [L1AztecBridgeAdapter]
    //const L2AztecBridgeAdapter = await L2AztecBridgeAdapterContract.deploy(deployerWallet, ...constructorArgs).send({ contractAddressSalt: contractAddressSalt, fee: { paymentMethod: sponsoredPaymentMethod }, from: (await deployerWallet.getAccounts())[0].item }).deployed({ timeout: 60 * 60 * 12 }) as L2AztecBridgeAdapterContract;
    const deployer = (await deployerWallet.getAccounts())[0].item
    const  {deployedContract,deploymentArtifact} = await deployAndCreateDeploymentArtifact(deployerWallet, deployer, L2AztecBridgeAdapterContract.artifact, constructorArgs)
    return { L2AztecBridgeAdapter:deployedContract as L2AztecBridgeAdapterContract, deploymentArtifact };
}
