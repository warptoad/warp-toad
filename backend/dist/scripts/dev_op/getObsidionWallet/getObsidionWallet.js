//@ts-ignore
import { AccountManager, AuthWitness, createAztecNodeClient, Fr, getWallet, GrumpkinScalar, Schnorr, } from "@aztec/aztec.js";
//@ts-ignore
import { DefaultAccountContract } from "@aztec/accounts/defaults";
import { ObsidionDeployerFPCContractArtifact } from "./ObsidionDeployerFPC";
//@ts-ignore
import { computePartialAddress } from "@aztec/stdlib/contract";
/** Creates auth witnesses using Schnorr signatures. */
class SchnorrAuthWitnessProvider {
    signingPrivateKey;
    constructor(signingPrivateKey) {
        this.signingPrivateKey = signingPrivateKey;
    }
    async createAuthWit(messageHash) {
        const schnorr = new Schnorr();
        const signature = await schnorr.constructSignature(messageHash.toBuffer(), this.signingPrivateKey);
        return new AuthWitness(messageHash, [...signature.toBuffer()]);
    }
}
/**
 * Account contract that authenticates transactions using Schnorr signatures
 * verified against a Grumpkin public key stored in an immutable encrypted note.
 */
export class ObsidionDeployerFPCContractClass extends DefaultAccountContract {
    signingPrivateKey;
    constructor(signingPrivateKey) {
        super();
        this.signingPrivateKey = signingPrivateKey;
    }
    async getDeploymentFunctionAndArgs() {
        const signingPublicKey = await new Schnorr().computePublicKey(this.signingPrivateKey);
        return {
            constructorName: "constructor",
            constructorArgs: [signingPublicKey.x, signingPublicKey.y],
        };
    }
    getContractArtifact() {
        return Promise.resolve(ObsidionDeployerFPCContractArtifact);
    }
    getAuthWitnessProvider(_address) {
        return new SchnorrAuthWitnessProvider(this.signingPrivateKey);
    }
}
export function getObsidionDeployerFPCWallet(pxe, address, signingPrivateKey) {
    //@ts-ignore
    return getWallet(pxe, address, new ObsidionDeployerFPCContractClass(signingPrivateKey));
}
export async function getObsidionDeployerFPC(pxe, nodeUrl, obsidionDeployerFPCAddress, signingKey, //hex string
OBSIDION_DEPLOYER_SECRET_KEY //hex string
) {
    let obsidionDeployerFPC;
    try {
        obsidionDeployerFPC = await getObsidionDeployerFPCWallet(pxe, obsidionDeployerFPCAddress, GrumpkinScalar.fromString(signingKey));
    }
    catch (error) {
        console.log("obsidionDeployerFPCWallet not found in pxe, so fetching from node");
        // in case pxe is no longer the instance that deployed the contract
        const node = createAztecNodeClient(nodeUrl);
        const contract = await node.getContract(obsidionDeployerFPCAddress);
        if (!contract) {
            throw new Error("Contract not found");
        }
        //@ts-ignore
        obsidionDeployerFPC = await (
        //@ts-ignore
        await AccountManager.create(pxe, Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY), 
        //@ts-ignore
        new ObsidionDeployerFPCContractClass(GrumpkinScalar.fromString(signingKey)), contract.salt)).getWallet();
        await pxe.registerAccount(Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY), await computePartialAddress(contract));
        await pxe.registerContract({
            instance: contract,
            artifact: ObsidionDeployerFPCContractArtifact,
        });
    }
    console.log("obsidionDeployerFPC", obsidionDeployerFPC.getAddress().toString());
    return obsidionDeployerFPC;
}
