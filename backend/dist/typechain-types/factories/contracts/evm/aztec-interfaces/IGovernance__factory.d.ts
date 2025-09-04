import { type ContractRunner } from "ethers";
import type { IGovernance, IGovernanceInterface } from "../../../../contracts/evm/aztec-interfaces/IGovernance";
export declare class IGovernance__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "Timestamp";
            readonly name: "time";
            readonly type: "uint256";
        }];
        readonly name: "ConfigurationUpdated";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "depositor";
            readonly type: "address";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "onBehalfOf";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "Deposit";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "governanceProposer";
            readonly type: "address";
        }];
        readonly name: "GovernanceProposerUpdated";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "proposalId";
            readonly type: "uint256";
        }];
        readonly name: "ProposalExecuted";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "proposalId";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "proposal";
            readonly type: "address";
        }];
        readonly name: "Proposed";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "proposalId";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "voter";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "bool";
            readonly name: "support";
            readonly type: "bool";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "VoteCast";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "withdrawalId";
            readonly type: "uint256";
        }];
        readonly name: "WithdrawFinalised";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "withdrawalId";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "recipient";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }];
        readonly name: "WithdrawInitiated";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_onBehalfOf";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "deposit";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_proposalId";
            readonly type: "uint256";
        }];
        readonly name: "dropProposal";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_proposalId";
            readonly type: "uint256";
        }];
        readonly name: "execute";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_withdrawalId";
            readonly type: "uint256";
        }];
        readonly name: "finaliseWithdraw";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getConfiguration";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly internalType: "Timestamp";
                    readonly name: "lockDelay";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "lockAmount";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.ProposeConfiguration";
                readonly name: "proposeConfig";
                readonly type: "tuple";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "votingDelay";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "votingDuration";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "executionDelay";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "gracePeriod";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "quorum";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "voteDifferential";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "minimumVotes";
                readonly type: "uint256";
            }];
            readonly internalType: "struct DataStructures.Configuration";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_proposalId";
            readonly type: "uint256";
        }];
        readonly name: "getProposal";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly components: readonly [{
                        readonly internalType: "Timestamp";
                        readonly name: "lockDelay";
                        readonly type: "uint256";
                    }, {
                        readonly internalType: "uint256";
                        readonly name: "lockAmount";
                        readonly type: "uint256";
                    }];
                    readonly internalType: "struct DataStructures.ProposeConfiguration";
                    readonly name: "proposeConfig";
                    readonly type: "tuple";
                }, {
                    readonly internalType: "Timestamp";
                    readonly name: "votingDelay";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "Timestamp";
                    readonly name: "votingDuration";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "Timestamp";
                    readonly name: "executionDelay";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "Timestamp";
                    readonly name: "gracePeriod";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "quorum";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "voteDifferential";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "minimumVotes";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.Configuration";
                readonly name: "config";
                readonly type: "tuple";
            }, {
                readonly internalType: "enum DataStructures.ProposalState";
                readonly name: "state";
                readonly type: "uint8";
            }, {
                readonly internalType: "contract IPayload";
                readonly name: "payload";
                readonly type: "address";
            }, {
                readonly internalType: "address";
                readonly name: "governanceProposer";
                readonly type: "address";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "creation";
                readonly type: "uint256";
            }, {
                readonly components: readonly [{
                    readonly internalType: "uint256";
                    readonly name: "yea";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "nea";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.Ballot";
                readonly name: "summedBallot";
                readonly type: "tuple";
            }];
            readonly internalType: "struct DataStructures.Proposal";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_proposalId";
            readonly type: "uint256";
        }];
        readonly name: "getProposalState";
        readonly outputs: readonly [{
            readonly internalType: "enum DataStructures.ProposalState";
            readonly name: "";
            readonly type: "uint8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_withdrawalId";
            readonly type: "uint256";
        }];
        readonly name: "getWithdrawal";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256";
                readonly name: "amount";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "unlocksAt";
                readonly type: "uint256";
            }, {
                readonly internalType: "address";
                readonly name: "recipient";
                readonly type: "address";
            }, {
                readonly internalType: "bool";
                readonly name: "claimed";
                readonly type: "bool";
            }];
            readonly internalType: "struct DataStructures.Withdrawal";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_to";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "initiateWithdraw";
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
            readonly name: "_owner";
            readonly type: "address";
        }, {
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "powerAt";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "_proposal";
            readonly type: "address";
        }];
        readonly name: "propose";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "_proposal";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "_to";
            readonly type: "address";
        }];
        readonly name: "proposeWithLock";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "Timestamp";
            readonly name: "_ts";
            readonly type: "uint256";
        }];
        readonly name: "totalPowerAt";
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
                readonly components: readonly [{
                    readonly internalType: "Timestamp";
                    readonly name: "lockDelay";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "lockAmount";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.ProposeConfiguration";
                readonly name: "proposeConfig";
                readonly type: "tuple";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "votingDelay";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "votingDuration";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "executionDelay";
                readonly type: "uint256";
            }, {
                readonly internalType: "Timestamp";
                readonly name: "gracePeriod";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "quorum";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "voteDifferential";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "minimumVotes";
                readonly type: "uint256";
            }];
            readonly internalType: "struct DataStructures.Configuration";
            readonly name: "_configuration";
            readonly type: "tuple";
        }];
        readonly name: "updateConfiguration";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_governanceProposer";
            readonly type: "address";
        }];
        readonly name: "updateGovernanceProposer";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_proposalId";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }, {
            readonly internalType: "bool";
            readonly name: "_support";
            readonly type: "bool";
        }];
        readonly name: "vote";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IGovernanceInterface;
    static connect(address: string, runner?: ContractRunner | null): IGovernance;
}
