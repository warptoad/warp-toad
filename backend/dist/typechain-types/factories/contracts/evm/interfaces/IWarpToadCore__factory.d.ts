import { type ContractRunner } from "ethers";
import type { IWarpToadCore, IWarpToadCoreInterface } from "../../../../contracts/evm/interfaces/IWarpToadCore";
export declare class IWarpToadCore__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "commitment";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "amount";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "index";
            readonly type: "uint256";
        }];
        readonly name: "Burn";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_nullifier";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_chainId";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_gigaRoot";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_localRoot";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_feeFactor";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_priorityFee";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_maxFee";
            readonly type: "uint256";
        }, {
            readonly internalType: "address";
            readonly name: "_relayer";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "_recipient";
            readonly type: "address";
        }];
        readonly name: "_formatPublicInputs";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_preCommitment";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "burn";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_gigaRootProvider";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "_l1BridgeAdapter";
            readonly type: "address";
        }];
        readonly name: "initialize";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_gigaRoot";
            readonly type: "uint256";
        }];
        readonly name: "isValidGigaRoot";
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
            readonly name: "_localRoot";
            readonly type: "uint256";
        }];
        readonly name: "isValidLocalRoot";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "localRoot";
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
            readonly name: "_nullifier";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_gigaRoot";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_localRoot";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_feeFactor";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_priorityFee";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "_maxFee";
            readonly type: "uint256";
        }, {
            readonly internalType: "address";
            readonly name: "_relayer";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "_recipient";
            readonly type: "address";
        }, {
            readonly internalType: "bytes";
            readonly name: "_poof";
            readonly type: "bytes";
        }];
        readonly name: "mint";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "storeLocalRootInHistory";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IWarpToadCoreInterface;
    static connect(address: string, runner?: ContractRunner | null): IWarpToadCore;
}
