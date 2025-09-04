import { type ContractRunner } from "ethers";
import type { IRollup, IRollupInterface } from "../../../../../contracts/evm/aztec-interfaces/IRollup.sol/IRollup";
export declare class IRollup__factory {
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
        readonly inputs: readonly [];
        readonly name: "archive";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "archiveAt";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "_archive";
            readonly type: "bytes32";
        }];
        readonly name: "canProposeAtTime";
        readonly outputs: readonly [{
            readonly internalType: "Slot";
            readonly name: "";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "canPruneAtTime";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
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
            readonly internalType: "uint256";
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getBlobPublicInputsHash";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getBlock";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "archive";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "Slot";
                readonly name: "slotNumber";
                readonly type: "uint256";
            }];
            readonly internalType: "struct BlockLog";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getBurnAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "_epoch";
            readonly type: "uint256";
        }];
        readonly name: "getCollectiveProverRewardsForEpoch";
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
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getEpochForBlock";
        readonly outputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_start";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_end";
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
            readonly name: "_args";
            readonly type: "tuple";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "_fees";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes";
            readonly name: "_blobPublicInputs";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes";
            readonly name: "_aggregationObject";
            readonly type: "bytes";
        }];
        readonly name: "getEpochProofPublicInputs";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getFeeAsset";
        readonly outputs: readonly [{
            readonly internalType: "contract IERC20";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getFeeAssetPerEth";
        readonly outputs: readonly [{
            readonly internalType: "FeeAssetPerEthE9";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getFeeAssetPortal";
        readonly outputs: readonly [{
            readonly internalType: "contract IFeeJuicePortal";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getFeeHeader";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "excessMana";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "manaUsed";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "feeAssetPriceNumerator";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "congestionCost";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "provingCost";
                readonly type: "uint256";
            }];
            readonly internalType: "struct FeeHeader";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Epoch";
            readonly name: "_epoch";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_length";
            readonly type: "uint256";
        }, {
            readonly internalType: "address";
            readonly name: "_prover";
            readonly type: "address";
        }];
        readonly name: "getHasSubmitted";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getInbox";
        readonly outputs: readonly [{
            readonly internalType: "contract IInbox";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_timestamp";
            readonly type: "uint256";
        }];
        readonly name: "getL1FeesAt";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "baseFee";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "blobFee";
                readonly type: "uint256";
            }];
            readonly internalType: "struct L1FeeData";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_timestamp";
            readonly type: "uint256";
        }, {
            readonly internalType: "bool";
            readonly name: "_inFeeAsset";
            readonly type: "bool";
        }];
        readonly name: "getManaBaseFeeAt";
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
            readonly name: "_timestamp";
            readonly type: "uint256";
        }, {
            readonly internalType: "bool";
            readonly name: "_inFeeAsset";
            readonly type: "bool";
        }];
        readonly name: "getManaBaseFeeComponentsAt";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "congestionCost";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "congestionMultiplier";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "dataCost";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "gasCost";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "provingCost";
                readonly type: "uint256";
            }];
            readonly internalType: "struct ManaBaseFeeComponents";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getManaLimit";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getManaTarget";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getOutbox";
        readonly outputs: readonly [{
            readonly internalType: "contract IOutbox";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getPendingBlockNumber";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getProofSubmissionWindow";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getProvenBlockNumber";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getProvingCostPerManaInEth";
        readonly outputs: readonly [{
            readonly internalType: "EthValue";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getProvingCostPerManaInFeeAsset";
        readonly outputs: readonly [{
            readonly internalType: "FeeAssetValue";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getRewardDistributor";
        readonly outputs: readonly [{
            readonly internalType: "contract IRewardDistributor";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_sequencer";
            readonly type: "address";
        }];
        readonly name: "getSequencerRewards";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
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
        }, {
            readonly internalType: "address";
            readonly name: "_prover";
            readonly type: "address";
        }];
        readonly name: "getSpecificProverRewardsForEpoch";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getTips";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "pendingBlockNumber";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "provenBlockNumber";
                readonly type: "uint256";
            }];
            readonly internalType: "struct ChainTips";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getVersion";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
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
            readonly internalType: "uint256";
            readonly name: "_myHeaderBlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "status";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "provenBlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "provenArchive";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "pendingBlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "pendingArchive";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "archiveOfMyBlock";
            readonly type: "bytes32";
        }, {
            readonly internalType: "Epoch";
            readonly name: "provenEpochNumber";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
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
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "_blobsInputs";
            readonly type: "bytes";
        }];
        readonly name: "validateBlobs";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "_header";
            readonly type: "bytes";
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
            readonly internalType: "bytes32";
            readonly name: "_digest";
            readonly type: "bytes32";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "_currentTime";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "_blobsHash";
            readonly type: "bytes32";
        }, {
            readonly components: readonly [{
                readonly internalType: "bool";
                readonly name: "ignoreDA";
                readonly type: "bool";
            }, {
                readonly internalType: "bool";
                readonly name: "ignoreSignatures";
                readonly type: "bool";
            }];
            readonly internalType: "struct BlockHeaderValidationFlags";
            readonly name: "_flags";
            readonly type: "tuple";
        }];
        readonly name: "validateHeader";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IRollupInterface;
    static connect(address: string, runner?: ContractRunner | null): IRollup;
}
