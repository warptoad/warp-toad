
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, SponsoredFeePaymentMethod } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,Wallet as AztecWallet  } from "@aztec/aztec.js"
import { USDcoin } from '../../../typechain-types';

export async function deployAztecWarpToad(nativeToken: USDcoin|any, deployerWallet:AztecWallet, sponsoredPaymentMethod:SponsoredFeePaymentMethod|undefined) {
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
    const decimals = 6n; // only 6 decimals what is this tether??

    const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals]
    const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({timeout:60*60*12}) as AztecWarpToadCore;

    return { AztecWarpToad };
}
