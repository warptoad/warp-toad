import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../../common";
import type { Errors, ErrorsInterface } from "../../../../../contracts/evm/aztec-interfaces/CoreErrors.sol/Errors";
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
    static readonly bytecode = "0x60556032600b8282823980515f1a607314602657634e487b7160e01b5f525f60045260245ffd5b305f52607381538281f3fe730000000000000000000000000000000000000000301460806040525f5ffdfea2646970667358221220dfe859e23e0b2b9e63fd148d5e549cc55cd5169270fbf869afa285012014f94164736f6c634300081d0033";
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "expected";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "actual";
            readonly type: "address";
        }];
        readonly name: "DevNet__InvalidProposer";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "DevNet__NoPruningAllowed";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "FeeJuicePortal__AlreadyInitialized";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "FeeJuicePortal__InvalidInitialization";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "FeeJuicePortal__Unauthorized";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "FeeLib__InvalidFeeAssetPriceModifier";
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
        readonly name: "HeaderLib__InvalidHeaderSize";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "expected";
            readonly type: "uint256";
        }, {
            readonly internalType: "Slot";
            readonly name: "actual";
            readonly type: "uint256";
        }];
        readonly name: "HeaderLib__InvalidSlotNumber";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "actor";
            readonly type: "bytes32";
        }];
        readonly name: "Inbox__ActorTooLarge";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "content";
            readonly type: "bytes32";
        }];
        readonly name: "Inbox__ContentTooLarge";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Inbox__MustBuildBeforeConsume";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "secretHash";
            readonly type: "bytes32";
        }];
        readonly name: "Inbox__SecretHashTooLarge";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Inbox__Unauthorized";
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
        readonly name: "Inbox__VersionMismatch";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "leaf";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "leafIndex";
            readonly type: "uint256";
        }];
        readonly name: "MerkleLib__InvalidRoot";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "leafIndex";
            readonly type: "uint256";
        }];
        readonly name: "Outbox__AlreadyNullified";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "Outbox__BlockNotProven";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "messageHash";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint64";
            readonly name: "storedFee";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint64";
            readonly name: "feePassed";
            readonly type: "uint64";
        }, {
            readonly internalType: "uint32";
            readonly name: "storedVersion";
            readonly type: "uint32";
        }, {
            readonly internalType: "uint32";
            readonly name: "versionPassed";
            readonly type: "uint32";
        }, {
            readonly internalType: "uint32";
            readonly name: "storedDeadline";
            readonly type: "uint32";
        }, {
            readonly internalType: "uint32";
            readonly name: "deadlinePassed";
            readonly type: "uint32";
        }];
        readonly name: "Outbox__IncompatibleEntryArguments";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Outbox__InvalidChainId";
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
        readonly name: "Outbox__InvalidPathLength";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "expected";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "actual";
            readonly type: "address";
        }];
        readonly name: "Outbox__InvalidRecipient";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "messageHash";
            readonly type: "bytes32";
        }];
        readonly name: "Outbox__NothingToConsume";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "Outbox__NothingToConsumeAtBlock";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "Outbox__RootAlreadySetAtBlock";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Outbox__Unauthorized";
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
        readonly name: "Outbox__VersionMismatch";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "balance";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "requested";
            readonly type: "uint256";
        }];
        readonly name: "ProofCommitmentEscrow__InsufficientBalance";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "caller";
            readonly type: "address";
        }];
        readonly name: "ProofCommitmentEscrow__NotOwner";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "current";
            readonly type: "uint256";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "readyAt";
            readonly type: "uint256";
        }];
        readonly name: "ProofCommitmentEscrow__WithdrawRequestNotReady";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "prover";
            readonly type: "address";
        }, {
            readonly internalType: "Epoch";
            readonly name: "epoch";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__AlreadyClaimed";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "minimum";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "provided";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__InsufficientBondAmount";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "required";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "available";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__InsufficientFundsInEscrow";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidArchive";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "basisPointFee";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__InvalidBasisPointFee";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "blobHash";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidBlobHash";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "blobHash";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidBlobProof";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidBlobPublicInputsHash";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidBlockHash";
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
        readonly name: "Rollup__InvalidBlockNumber";
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
        readonly name: "Rollup__InvalidChainId";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidInHash";
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
        readonly name: "Rollup__InvalidManaBaseFee";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidPreviousArchive";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidPreviousBlockHash";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__InvalidProof";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "expected";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "actual";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__InvalidProposedArchive";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "expected";
            readonly type: "uint256";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "actual";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__InvalidTimestamp";
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
        readonly name: "Rollup__InvalidVersion";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__ManaLimitExceeded";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__NoEpochToProve";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__NonSequentialProving";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__NonZeroDaFee";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "deadline";
            readonly type: "uint256";
        }, {
            readonly internalType: "Slot";
            readonly name: "currentSlot";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__NotPastDeadline";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__NothingToPrune";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "deadline";
            readonly type: "uint256";
        }, {
            readonly internalType: "Slot";
            readonly name: "currentSlot";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__PastDeadline";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "prover";
            readonly type: "address";
        }, {
            readonly internalType: "Epoch";
            readonly name: "epoch";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__ProverHaveAlreadySubmitted";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "lastSlot";
            readonly type: "uint256";
        }, {
            readonly internalType: "Slot";
            readonly name: "proposedSlot";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__SlotAlreadyInChain";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "start";
            readonly type: "uint256";
        }, {
            readonly internalType: "Epoch";
            readonly name: "end";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__StartAndEndNotSameEpoch";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__StartIsNotBuildingOnProven";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__StartIsNotFirstBlockOfEpoch";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "max";
            readonly type: "uint256";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "actual";
            readonly type: "uint256";
        }];
        readonly name: "Rollup__TimestampInFuture";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__TimestampTooOld";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "Rollup__TryingToProveNonExistingBlock";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "txsHash";
            readonly type: "bytes32";
        }];
        readonly name: "Rollup__UnavailableTxs";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "requested";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "bound";
            readonly type: "uint256";
        }];
        readonly name: "SampleLib__IndexOutOfBounds";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "sample";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "index";
            readonly type: "uint256";
        }];
        readonly name: "SampleLib__SampleLargerThanIndex";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "SignatureLib__CannotVerifyEmpty";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "expected";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "recovered";
            readonly type: "address";
        }];
        readonly name: "SignatureLib__InvalidSignature";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "attester";
            readonly type: "address";
        }];
        readonly name: "Staking__AlreadyActive";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__AlreadyRegistered";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__CannotSlashExitedStake";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__FailedToRemove";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly name: "Staking__InsufficientStake";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "attester";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "proposer";
            readonly type: "address";
        }];
        readonly name: "Staking__InvalidDeposit";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__NoOneToSlash";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__NotExiting";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__NotSlasher";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__NotWithdrawer";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly name: "Staking__NothingToExit";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "";
            readonly type: "uint256";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly name: "Staking__WithdrawalNotUnlockedYet";
        readonly type: "error";
    }, {
        readonly inputs: readonly [];
        readonly name: "ValidatorSelection__EpochNotSetup";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "minimumNeeded";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "provided";
            readonly type: "uint256";
        }];
        readonly name: "ValidatorSelection__InsufficientAttestations";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "minimumNeeded";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "provided";
            readonly type: "uint256";
        }];
        readonly name: "ValidatorSelection__InsufficientAttestationsProvided";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "attester";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "proposer";
            readonly type: "address";
        }];
        readonly name: "ValidatorSelection__InvalidDeposit";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "expected";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "actual";
            readonly type: "address";
        }];
        readonly name: "ValidatorSelection__InvalidProposer";
        readonly type: "error";
    }];
    static createInterface(): ErrorsInterface;
    static connect(address: string, runner?: ContractRunner | null): Errors;
}
export {};
