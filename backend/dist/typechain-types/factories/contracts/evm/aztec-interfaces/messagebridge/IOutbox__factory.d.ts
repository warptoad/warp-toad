import { type ContractRunner } from "ethers";
import type { IOutbox, IOutboxInterface } from "../../../../../contracts/evm/aztec-interfaces/messagebridge/IOutbox";
export declare class IOutbox__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "bytes32";
            readonly name: "root";
            readonly type: "bytes32";
        }, {
            readonly indexed: true;
            readonly internalType: "bytes32";
            readonly name: "messageHash";
            readonly type: "bytes32";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "leafIndex";
            readonly type: "uint256";
        }];
        readonly name: "MessageConsumed";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "bytes32";
            readonly name: "root";
            readonly type: "bytes32";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "minHeight";
            readonly type: "uint256";
        }];
        readonly name: "RootAdded";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly internalType: "bytes32";
                    readonly name: "actor";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "version";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.L2Actor";
                readonly name: "sender";
                readonly type: "tuple";
            }, {
                readonly components: readonly [{
                    readonly internalType: "address";
                    readonly name: "actor";
                    readonly type: "address";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "chainId";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct DataStructures.L1Actor";
                readonly name: "recipient";
                readonly type: "tuple";
            }, {
                readonly internalType: "bytes32";
                readonly name: "content";
                readonly type: "bytes32";
            }];
            readonly internalType: "struct DataStructures.L2ToL1Msg";
            readonly name: "_message";
            readonly type: "tuple";
        }, {
            readonly internalType: "uint256";
            readonly name: "_l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_leafIndex";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "_path";
            readonly type: "bytes32[]";
        }];
        readonly name: "consume";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_l2BlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getRootData";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "root";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "minHeight";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_leafIndex";
            readonly type: "uint256";
        }];
        readonly name: "hasMessageBeenConsumedAtBlockAndIndex";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "_root";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "_minHeight";
            readonly type: "uint256";
        }];
        readonly name: "insert";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IOutboxInterface;
    static connect(address: string, runner?: ContractRunner | null): IOutbox;
}
