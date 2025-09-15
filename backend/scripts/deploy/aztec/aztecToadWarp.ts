
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, SponsoredFeePaymentMethod } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,Wallet as AztecWallet  } from "@aztec/aztec.js"
import { USDcoin } from '../../../typechain-types';

export async function deployAztecWarpToad(nativeToken: USDcoin|any, deployerWallet:AztecWallet, sponsoredPaymentMethod:SponsoredFeePaymentMethod|undefined) {
    const name = `wrapped-warptoad-${await nativeToken.name()}`;
    const symbol = `wrptd-${(await nativeToken.symbol()).toUpperCase()}`;
    const decimals = 6n; // only 6 decimals what is this tether??

    const constructorArgs = [nativeToken.target, name, symbol, decimals]
    const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({timeout:60*60*12}) as AztecWarpToadCore;

    return { AztecWarpToad };
}
