import { type ContractRunner } from "ethers";
import type { IPayload, IPayloadInterface } from "../../../../contracts/evm/aztec-interfaces/IPayload";
export declare class IPayload__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "getActions";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "target";
                readonly type: "address";
            }, {
                readonly internalType: "bytes";
                readonly name: "data";
                readonly type: "bytes";
            }];
            readonly internalType: "struct IPayload.Action[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): IPayloadInterface;
    static connect(address: string, runner?: ContractRunner | null): IPayload;
}
