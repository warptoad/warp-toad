import { type ContractRunner } from "ethers";
import type { IGigaBridge, IGigaBridgeInterface } from "../../../../contracts/evm/interfaces/IGigaBridge";
export declare class IGigaBridge__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "newGigaRoot";
            readonly type: "uint256";
        }];
        readonly name: "ConstructedNewGigaRoot";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "newLocalRoot";
            readonly type: "uint256";
        }, {
            readonly indexed: true;
            readonly internalType: "uint40";
            readonly name: "localRootIndex";
            readonly type: "uint40";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "localRootBlockNumber";
            readonly type: "uint256";
        }];
        readonly name: "ReceivedNewLocalRoot";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_localRootProvider";
            readonly type: "address";
        }];
        readonly name: "getLocalRootProvidersIndex";
        readonly outputs: readonly [{
            readonly internalType: "uint40";
            readonly name: "";
            readonly type: "uint40";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_localRootProvider";
            readonly type: "address";
        }];
        readonly name: "isLocalRootProviders";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "_gigaRootRecipients";
            readonly type: "address[]";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "_amounts";
            readonly type: "uint256[]";
        }];
        readonly name: "sendGigaRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "_localRootProvider";
            readonly type: "address[]";
        }];
        readonly name: "updateGigaRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IGigaBridgeInterface;
    static connect(address: string, runner?: ContractRunner | null): IGigaBridge;
}
