import { type ContractRunner } from "ethers";
import type { IValidatorSelection, IValidatorSelectionInterface } from "../../../../../contracts/evm/aztec-interfaces/IValidatorSelection.sol/IValidatorSelection";
export declare class IValidatorSelection__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "getAttesters";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "getCommitteeAt";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentEpoch";
        readonly outputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentEpochCommittee";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentProposer";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentSampleSeed";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getCurrentSlot";
        readonly outputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "getEpochAt";
        readonly outputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "_slotNumber";
            readonly type: "uint256";
        }];
        readonly name: "getEpochAtSlot";
        readonly outputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "_epoch";
            readonly type: "uint256";
        }];
        readonly name: "getEpochCommittee";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getEpochDuration";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getGenesisTime";
        readonly outputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "getProposerAt";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "getSampleSeedAt";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "getSlotAt";
        readonly outputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getSlotDuration";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getTargetCommitteeSize";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "_slotNumber";
            readonly type: "uint256";
        }];
        readonly name: "getTimestampForSlot";
        readonly outputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "setupEpoch";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IValidatorSelectionInterface;
    static connect(address: string, runner?: ContractRunner | null): IValidatorSelection;
}
