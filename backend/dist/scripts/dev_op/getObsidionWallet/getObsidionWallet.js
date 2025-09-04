"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObsidionDeployerFPCContractClass = void 0;
exports.getObsidionDeployerFPCWallet = getObsidionDeployerFPCWallet;
exports.getObsidionDeployerFPC = getObsidionDeployerFPC;
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
//@ts-ignore
const defaults_1 = require("@aztec/accounts/defaults");
const ObsidionDeployerFPC_1 = require("./ObsidionDeployerFPC");
//@ts-ignore
const contract_1 = require("@aztec/stdlib/contract");
/** Creates auth witnesses using Schnorr signatures. */
class SchnorrAuthWitnessProvider {
    signingPrivateKey;
    constructor(signingPrivateKey) {
        this.signingPrivateKey = signingPrivateKey;
    }
    async createAuthWit(messageHash) {
        const schnorr = new aztec_js_1.Schnorr();
        const signature = await schnorr.constructSignature(messageHash.toBuffer(), this.signingPrivateKey);
        return new aztec_js_1.AuthWitness(messageHash, [...signature.toBuffer()]);
    }
}
/**
 * Account contract that authenticates transactions using Schnorr signatures
 * verified against a Grumpkin public key stored in an immutable encrypted note.
 */
class ObsidionDeployerFPCContractClass extends defaults_1.DefaultAccountContract {
    signingPrivateKey;
    constructor(signingPrivateKey) {
        super();
        this.signingPrivateKey = signingPrivateKey;
    }
    async getDeploymentFunctionAndArgs() {
        const signingPublicKey = await new aztec_js_1.Schnorr().computePublicKey(this.signingPrivateKey);
        return {
            constructorName: "constructor",
            constructorArgs: [signingPublicKey.x, signingPublicKey.y],
        };
    }
    getContractArtifact() {
        return Promise.resolve(ObsidionDeployerFPC_1.ObsidionDeployerFPCContractArtifact);
    }
    getAuthWitnessProvider(_address) {
        return new SchnorrAuthWitnessProvider(this.signingPrivateKey);
    }
}
exports.ObsidionDeployerFPCContractClass = ObsidionDeployerFPCContractClass;
function getObsidionDeployerFPCWallet(pxe, address, signingPrivateKey) {
    //@ts-ignore
    return (0, aztec_js_1.getWallet)(pxe, address, new ObsidionDeployerFPCContractClass(signingPrivateKey));
}
async function getObsidionDeployerFPC(pxe, nodeUrl, obsidionDeployerFPCAddress, signingKey, //hex string
OBSIDION_DEPLOYER_SECRET_KEY //hex string
) {
    let obsidionDeployerFPC;
    try {
        obsidionDeployerFPC = await getObsidionDeployerFPCWallet(pxe, obsidionDeployerFPCAddress, aztec_js_1.GrumpkinScalar.fromString(signingKey));
    }
    catch (error) {
        console.log("obsidionDeployerFPCWallet not found in pxe, so fetching from node");
        // in case pxe is no longer the instance that deployed the contract
        const node = (0, aztec_js_1.createAztecNodeClient)(nodeUrl);
        const contract = await node.getContract(obsidionDeployerFPCAddress);
        if (!contract) {
            throw new Error("Contract not found");
        }
        //@ts-ignore
        obsidionDeployerFPC = await (
        //@ts-ignore
        await aztec_js_1.AccountManager.create(pxe, aztec_js_1.Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY), 
        //@ts-ignore
        new ObsidionDeployerFPCContractClass(aztec_js_1.GrumpkinScalar.fromString(signingKey)), contract.salt)).getWallet();
        await pxe.registerAccount(aztec_js_1.Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY), await (0, contract_1.computePartialAddress)(contract));
        await pxe.registerContract({
            instance: contract,
            artifact: ObsidionDeployerFPC_1.ObsidionDeployerFPCContractArtifact,
        });
    }
    console.log("obsidionDeployerFPC", obsidionDeployerFPC.getAddress().toString());
    return obsidionDeployerFPC;
}
