import { type ContractRunner } from "ethers";
import type { IGovernanceProposer, IGovernanceProposerInterface } from "../../../../contracts/evm/aztec-interfaces/IGovernanceProposer";
export declare class IGovernanceProposer__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "contract IPayload";
            readonly name: "proposal";
            readonly type: "address";
        }, {
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "round";
            readonly type: "uint256";
        }];
        readonly name: "ProposalExecuted";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "contract IPayload";
            readonly name: "proposal";
            readonly type: "address";
        }, {
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "round";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "voter";
            readonly type: "address";
        }];
        readonly name: "VoteCast";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "_slot";
            readonly type: "uint256";
        }];
        readonly name: "computeRound";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_roundNumber";
            readonly type: "uint256";
        }];
        readonly name: "executeProposal";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getExecutor";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getInstance";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "_proposal";
            readonly type: "address";
        }];
        readonly name: "vote";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_instance";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "_round";
            readonly type: "uint256";
        }, {
            readonly internalType: "contract IPayload";
            readonly name: "_proposal";
            readonly type: "address";
        }];
        readonly name: "yeaCount";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): IGovernanceProposerInterface;
    static connect(address: string, runner?: ContractRunner | null): IGovernanceProposer;
}
