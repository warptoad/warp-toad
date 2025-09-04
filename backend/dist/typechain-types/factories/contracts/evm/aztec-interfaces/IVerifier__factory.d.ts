import { type ContractRunner } from "ethers";
import type { IVerifier, IVerifierInterface } from "../../../../contracts/evm/aztec-interfaces/IVerifier";
export declare class IVerifier__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "_proof";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "_publicInputs";
            readonly type: "bytes32[]";
        }];
        readonly name: "verify";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): IVerifierInterface;
    static connect(address: string, runner?: ContractRunner | null): IVerifier;
}
