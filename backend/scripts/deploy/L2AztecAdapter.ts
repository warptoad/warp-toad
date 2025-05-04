
//@ts-ignore
import { Contract} from "@aztec/aztec.js"
//@ts-ignore
import { L2AztecRootBridgeAdapterContract, L2AztecRootBridgeAdapterContractArtifact} from '../../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter.ts'

//@ts-ignore
import { Contract,Wallet as AztecWallet  } from "@aztec/aztec.js"
import { ethers } from "ethers";

const { PXE_URL = 'http://localhost:8080' } = process.env;

export  async function deployL2AztecAdapter(L1AztecRootBridgeAdapter:ethers.AddressLike,deployerWallet:AztecWallet) {

    const constructorArgs = [L1AztecRootBridgeAdapter]
    const L2AztecRootBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecRootBridgeAdapterContractArtifact, constructorArgs).send().deployed() as L2AztecRootBridgeAdapterContract;

    return { L2AztecRootBridgeAdapter };
}
