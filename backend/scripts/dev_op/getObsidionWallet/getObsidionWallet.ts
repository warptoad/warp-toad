//@ts-ignore
import { AccountWallet, AuthWitness, AuthWitnessProvider, AztecAddress, AztecNode, CompleteAddress, ContractArtifact, Fr, getWallet, GrumpkinScalar, PXE, Schnorr, } from "@aztec/aztec.js";
//@ts-ignore
import { DefaultAccountContract } from "@aztec/accounts/defaults";

import { ObsidionDeployerFPCContractArtifact } from "./ObsidionDeployerFPC"

/** Creates auth witnesses using Schnorr signatures. */
class SchnorrAuthWitnessProvider implements AuthWitnessProvider {
    constructor(private signingPrivateKey: GrumpkinScalar) {}
  
    async createAuthWit(messageHash: Fr): Promise<AuthWitness> {
      const schnorr = new Schnorr()
      const signature = await schnorr.constructSignature(
        messageHash.toBuffer(),
        this.signingPrivateKey,
      )
      return new AuthWitness(messageHash, [...signature.toBuffer()])
    }
  }

/**
 * Account contract that authenticates transactions using Schnorr signatures
 * verified against a Grumpkin public key stored in an immutable encrypted note.
 */
export class ObsidionDeployerFPCContractClass extends DefaultAccountContract {
  constructor(private signingPrivateKey: GrumpkinScalar) {
    super()
  }

  async getDeploymentFunctionAndArgs() {
    const signingPublicKey = await new Schnorr().computePublicKey(this.signingPrivateKey)
    return {
      constructorName: "constructor",
      constructorArgs: [signingPublicKey.x, signingPublicKey.y],
    }
  }

  getContractArtifact(): Promise<ContractArtifact> {
    return Promise.resolve(ObsidionDeployerFPCContractArtifact)
  }

  getAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    return new SchnorrAuthWitnessProvider(this.signingPrivateKey)
  }
}

export function getObsidionDeployerFPCWallet(
    pxe: PXE,
    address: AztecAddress,
    signingPrivateKey: GrumpkinScalar,
  ): Promise<AccountWallet> {
    
    return getWallet(pxe, address, new ObsidionDeployerFPCContractClass(signingPrivateKey))
  }