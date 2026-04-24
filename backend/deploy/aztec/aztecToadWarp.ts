
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
// TODO: Update these imports once Aztec codegen and Hardhat v3 typed artifacts are generated
// import { WarpToadCoreContract as AztecWarpToad } from '../../aztec/WarpToadCore/src/artifacts/WarpToadCore';
// import { USDcoin } from '../../artifacts/...';
// TODO: TestWallet was removed in v4, use @aztec/wallets equivalent
import { EthAddressLike } from "@aztec/aztec.js/abi";
import { Fr } from '@aztec/aztec.js/fields';
import { deployAndCreateDeploymentArtifact } from "../utils/aztecUtilsNoEnv";
export async function deployAztecWarpToad(nativeToken: USDcoin | any, deployerWallet: TestWallet, sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined, contractAddressSalt?:Fr) {
    contractAddressSalt ??= Fr.random()
    console.log("deploying Aztec Warptoad")
    const name = `wrapped-warptoad-${await nativeToken.name()}`;
    const symbol = `wrptd-${(await nativeToken.symbol()).toUpperCase()}`;
    const decimals = 6n; // only 6 decimals what is this tether??\

    const constructorArgs:[EthAddressLike, string,string,bigint] = [nativeToken.target as EthAddressLike, name, symbol, decimals]
    const deployer = (await deployerWallet.getAccounts())[0].item
    //const AztecWarpToad = await WarpToadCoreContract.deploy(deployerWallet, ...constructorArgs).send({contractAddressSalt: contractAddressSalt, from: deployer, fee:{paymentMethod:sponsoredPaymentMethod} }).deployed();
    const  {deployedContract,deploymentArtifact} = await deployAndCreateDeploymentArtifact(deployerWallet, deployer, AztecWarpToad.artifact, constructorArgs)
    return { AztecWarpToad:deployedContract as AztecWarpToad, deploymentArtifact };
}