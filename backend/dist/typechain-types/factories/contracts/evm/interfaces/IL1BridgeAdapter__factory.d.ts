import { type ContractRunner } from "ethers";
import type { IL1BridgeAdapter, IL1BridgeAdapterInterface } from "../../../../contracts/evm/interfaces/IL1BridgeAdapter";
export declare class IL1BridgeAdapter__factory {
    static readonly abi: readonly [{
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "uint256";
            readonly name: "newL2Root";
            readonly type: "uint256";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "l2Block";
            readonly type: "uint256";
        }];
        readonly name: "ReceivedNewL2Root";
        readonly type: "event";
    }];
    static createInterface(): IL1BridgeAdapterInterface;
    static connect(address: string, runner?: ContractRunner | null): IL1BridgeAdapter;
}
