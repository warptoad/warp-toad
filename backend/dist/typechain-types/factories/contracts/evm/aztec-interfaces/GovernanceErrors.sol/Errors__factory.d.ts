import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../../common";
import type { Errors, ErrorsInterface } from "../../../../../contracts/evm/aztec-interfaces/GovernanceErrors.sol/Errors";
type ErrorsConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class Errors__factory extends ContractFactory {
    constructor(...args: ErrorsConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<Errors & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): Errors__factory;
    static readonly bytecode = "0x60556032600b8282823980515f1a607314602657634e487b7160e01b5f525f60045260245ffd5b305f52607381538281f3fe730000000000000000000000000000000000000000301460806040525f5ffdfea264697066735822122030ac278acd94c2ea11a5517b436eede93f6bd0e2f3d83c787ba701645dc93bd564736f6c634300081d0033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "available";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "needed";
            readonly type: "uint256";
        }];
        readonly name: "CoinIssuer__InsufficientMintAvailable";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "GovernanceProposer__CanOnlyExecuteProposalInPast";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "proposal";
            readonly type: "address";
        }];
        readonly name: "GovernanceProposer__FailedToPropose";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "instance";
            readonly type: "address";
        }];
        readonly name: "GovernanceProposer__InstanceHaveNoCode";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "votesCast";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "votesNeeded";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__InsufficientVotes";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "n";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "m";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__InvalidNAndMValues";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "n";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "m";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__NCannotBeLargerTHanM";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "caller";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "proposer";
            readonly type: "address";
        }];
        readonly name: "GovernanceProposer__OnlyProposerCanVote";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "roundNumber";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__ProposalAlreadyExecuted";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "GovernanceProposer__ProposalCannotBeAddressZero";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "proposal";
            readonly type: "address";
        }];
        readonly name: "GovernanceProposer__ProposalHaveNoCode";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "roundNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "currentRoundNumber";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__ProposalTooOld";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "slot";
            readonly type: "uint256";
        }];
        readonly name: "GovernanceProposer__VoteAlreadyCastForSlot";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }];
        readonly name: "Governance__CallFailed";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "caller";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "governanceProposer";
            readonly type: "address";
        }];
        readonly name: "Governance__CallerNotGovernanceProposer";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "caller";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "self";
            readonly type: "address";
        }];
        readonly name: "Governance__CallerNotSelf";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__CannotCallAsset";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__DifferentialTooBig";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__DifferentialTooSmall";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__InvalidMinimumVotes";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__LockAmountTooSmall";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__QuorumTooBig";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ConfigurationLib__QuorumTooSmall";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "Governance__ConfigurationLib__TimeTooBig";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "Governance__ConfigurationLib__TimeTooSmall";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "voter";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "have";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "required";
            readonly type: "uint256";
        }];
        readonly name: "Governance__InsufficientPower";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__InvalidConfiguration";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__NoCheckpointsFound";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalAlreadyDropped";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalCannotBeDropped";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "proposalId";
            readonly type: "uint256";
        }];
        readonly name: "Governance__ProposalDoesNotExists";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalLib__MoreVoteThanExistNeeded";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalLib__MoreYeaVoteThanExistNeeded";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalLib__ZeroMinimum";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalLib__ZeroVotesNeeded";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalLib__ZeroYeaVotesNeeded";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalNotActive";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__ProposalNotExecutable";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__UserLib__NotInPast";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Governance__WithdrawalAlreadyclaimed";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "currentTime";
            readonly type: "uint256";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "unlocksAt";
            readonly type: "uint256";
        }];
        readonly name: "Governance__WithdrawalNotUnlockedYet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Registry__NoRollupsRegistered";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "rollup";
            readonly type: "address";
        }];
        readonly name: "Registry__RollupAlreadyRegistered";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "version";
            readonly type: "uint256";
        }];
        readonly name: "Registry__RollupNotRegistered";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "caller";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "canonical";
            readonly type: "address";
        }];
        readonly name: "RewardDistributor__InvalidCaller";
        readonly type: "error";
    }];
    static createInterface(): ErrorsInterface;
    static connect(address: string, runner?: ContractRunner | null): Errors;
}
export {};
