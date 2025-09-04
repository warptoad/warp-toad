import { type ContractRunner } from "ethers";
import type { IInbox, IInboxInterface } from "../../../../../contracts/evm/aztec-interfaces/messagebridge/IInbox";
export declare class IInbox__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "l2BlockNumber";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "index";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "bytes32";
            readonly name: "hash";
            readonly type: "bytes32";
        }];
        readonly name: "MessageSent";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_toConsume";
            readonly type: "uint256";
        }];
        readonly name: "consume";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_blockNumber";
            readonly type: "uint256";
        }];
        readonly name: "getRoot";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
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
            readonly name: "_recipient";
            readonly type: "tuple";
        }, {
            readonly internalType: "bytes32";
            readonly name: "_content";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "_secretHash";
            readonly type: "bytes32";
        }];
        readonly name: "sendL2Message";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IInboxInterface;
    static connect(address: string, runner?: ContractRunner | null): IInbox;
}
