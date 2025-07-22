
//@ts-ignore
import { Contract, SponsoredFeePaymentMethod} from "@aztec/aztec.js"
//@ts-ignore
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact} from '../../../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.js'

//@ts-ignore
import { Contract,Wallet as AztecWallet  } from "@aztec/aztec.js"
import { ethers } from "ethers";

const { PXE_URL = 'http://localhost:8080' } = process.env;

export  async function deployL2AztecBridgeAdapter(L1AztecBridgeAdapter:ethers.AddressLike,deployerWallet:AztecWallet, sponsoredPaymentMethod:SponsoredFeePaymentMethod|undefined) {

    const constructorArgs = [L1AztecBridgeAdapter]
    const L2AztecBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecBridgeAdapterContractArtifact, constructorArgs).send({ fee: { paymentMethod: sponsoredPaymentMethod } }).deployed({timeout:60*60*12}) as L2AztecBridgeAdapterContract;

    return { L2AztecBridgeAdapter };
}
