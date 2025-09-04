import { AccountWallet, AuthWitnessProvider, AztecAddress, CompleteAddress, ContractArtifact, Fr, GrumpkinScalar, PXE } from "@aztec/aztec.js";
import { DefaultAccountContract } from "@aztec/accounts/defaults";
/**
 * Account contract that authenticates transactions using Schnorr signatures
 * verified against a Grumpkin public key stored in an immutable encrypted note.
 */
export declare class ObsidionDeployerFPCContractClass extends DefaultAccountContract {
    private signingPrivateKey;
    constructor(signingPrivateKey: GrumpkinScalar);
    getDeploymentFunctionAndArgs(): Promise<{
        constructorName: string;
        constructorArgs: Fr[];
    }>;
    getContractArtifact(): Promise<ContractArtifact>;
    getAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider;
}
export declare function getObsidionDeployerFPCWallet(pxe: PXE, address: AztecAddress, signingPrivateKey: GrumpkinScalar): Promise<AccountWallet>;
export declare function getObsidionDeployerFPC(pxe: PXE, nodeUrl: string, obsidionDeployerFPCAddress: AztecAddress, signingKey: string, //hex string
OBSIDION_DEPLOYER_SECRET_KEY: string): Promise<AccountWallet>;
