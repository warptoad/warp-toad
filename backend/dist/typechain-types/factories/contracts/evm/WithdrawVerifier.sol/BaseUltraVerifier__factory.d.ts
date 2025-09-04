import { type ContractRunner } from "ethers";
import type { BaseUltraVerifier, BaseUltraVerifierInterface } from "../../../../contracts/evm/WithdrawVerifier.sol/BaseUltraVerifier";
export declare class BaseUltraVerifier__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "INVALID_VERIFICATION_KEY";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "MOD_EXP_FAILURE";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "OPENING_COMMITMENT_FAILED";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "PAIRING_FAILED";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "PAIRING_PREAMBLE_FAILED";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "POINT_NOT_ON_CURVE";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "expected";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "actual";
            readonly type: "uint256";
        }];
        readonly name: "PUBLIC_INPUT_COUNT_INVALID";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "PUBLIC_INPUT_GE_P";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "PUBLIC_INPUT_INVALID_BN128_G1_POINT";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "getVerificationKeyHash";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
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
    static createInterface(): BaseUltraVerifierInterface;
    static connect(address: string, runner?: ContractRunner | null): BaseUltraVerifier;
}
