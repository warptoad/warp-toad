import { type ContractRunner } from "ethers";
import type { ITestRollup, ITestRollupInterface } from "../../../../../contracts/evm/aztec-interfaces/IRollup.sol/ITestRollup";
export declare class ITestRollup__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "manaTarget";
            readonly type: "uint256";
        }];
        readonly name: "ManaTargetUpdated";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "attester";
                readonly type: "address";
            }, {
                readonly internalType: "address";
                readonly name: "proposer";
                readonly type: "address";
            }, {
                readonly internalType: "address";
                readonly name: "withdrawer";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "amount";
                readonly type: "uint256";
            }];
            readonly internalType: "struct CheatDepositArgs[]";
            readonly name: "_args";
            readonly type: "tuple[]";
        }];
        readonly name: "cheat__InitialiseValidatorSet";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_verifier";
            readonly type: "address";
        }];
        readonly name: "setEpochVerifier";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "_protocolContractTreeRoot";
            readonly type: "bytes32";
        }];
        readonly name: "setProtocolContractTreeRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "_vkTreeRoot";
            readonly type: "bytes32";
        }];
        readonly name: "setVkTreeRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_manaTarget";
            readonly type: "uint256";
        }];
        readonly name: "updateManaTarget";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): ITestRollupInterface;
    static connect(address: string, runner?: ContractRunner | null): ITestRollup;
}
