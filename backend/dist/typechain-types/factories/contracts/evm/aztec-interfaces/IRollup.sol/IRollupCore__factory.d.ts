import { type ContractRunner } from "ethers";
import type { IRollupCore, IRollupCoreInterface } from "../../../../../contracts/evm/aztec-interfaces/IRollup.sol/IRollupCore";
export declare class IRollupCore__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "blockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "bytes32";
            readonly name: "archive";
            readonly type: "bytes32";
        }, {
            readonly indexed: false;
            readonly internalType: "bytes32[]";
            readonly name: "versionedBlobHashes";
            readonly type: "bytes32[]";
        }];
        readonly name: "L2BlockProposed";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "blockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "proverId";
            readonly type: "address";
        }];
        readonly name: "L2ProofVerified";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "provenBlockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "pendingBlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "PrunedPending";
        readonly type: "event";
    }, {
        readonly inputs: readonly [];
        readonly name: "L1_BLOCK_AT_GENESIS";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_recipient";
            readonly type: "address";
        }, {
            readonly internalType: "Epoch[]";
            readonly name: "_epochs";
            readonly type: "uint256[]";
        }];
        readonly name: "claimProverRewards";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_recipient";
            readonly type: "address";
        }];
        readonly name: "claimSequencerRewards";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "archive";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly components: readonly [{
                    readonly internalType: "int256";
                    readonly name: "feeAssetPriceModifier";
                    readonly type: "int256";
                }];
                readonly internalType: "struct OracleInput";
                readonly name: "oracleInput";
                readonly type: "tuple";
            }, {
                readonly internalType: "bytes";
                readonly name: "header";
                readonly type: "bytes";
            }, {
                readonly internalType: "bytes32[]";
                readonly name: "txHashes";
                readonly type: "bytes32[]";
            }];
            readonly internalType: "struct ProposeArgs";
            readonly name: "_args";
            readonly type: "tuple";
        }, {
            readonly components: readonly [{
                readonly internalType: "bool";
                readonly name: "isEmpty";
                readonly type: "bool";
            }, {
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }];
            readonly internalType: "struct Signature[]";
            readonly name: "_signatures";
            readonly type: "tuple[]";
        }, {
            readonly internalType: "bytes";
            readonly name: "_blobInput";
            readonly type: "bytes";
        }];
        readonly name: "propose";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "prune";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "EthValue";
            readonly name: "_provingCostPerMana";
            readonly type: "uint256";
        }];
        readonly name: "setProvingCostPerMana";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "start";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "end";
                readonly type: "uint256";
            }, {
                readonly components: readonly [{
                    readonly internalType: "bytes32";
                    readonly name: "previousArchive";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "endArchive";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "previousBlockHash";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "endBlockHash";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "Timestamp";
                    readonly name: "endTimestamp";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "outHash";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "address";
                    readonly name: "proverId";
                    readonly type: "address";
                }];
                readonly internalType: "struct PublicInputArgs";
                readonly name: "args";
                readonly type: "tuple";
            }, {
                readonly internalType: "bytes32[]";
                readonly name: "fees";
                readonly type: "bytes32[]";
            }, {
                readonly internalType: "bytes";
                readonly name: "blobPublicInputs";
                readonly type: "bytes";
            }, {
                readonly internalType: "bytes";
                readonly name: "aggregationObject";
                readonly type: "bytes";
            }, {
                readonly internalType: "bytes";
                readonly name: "proof";
                readonly type: "bytes";
            }];
            readonly internalType: "struct SubmitEpochRootProofArgs";
            readonly name: "_args";
            readonly type: "tuple";
        }];
        readonly name: "submitEpochRootProof";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "updateL1GasFeeOracle";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IRollupCoreInterface;
    static connect(address: string, runner?: ContractRunner | null): IRollupCore;
}
