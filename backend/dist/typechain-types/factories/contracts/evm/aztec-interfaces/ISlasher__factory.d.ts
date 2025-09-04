import { type ContractRunner } from "ethers";
import type { ISlasher, ISlasherInterface } from "../../../../contracts/evm/aztec-interfaces/ISlasher";
export declare class ISlasher__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "contract IPayload";
            readonly name: "_payload";
            readonly type: "address";
        }];
        readonly name: "slash";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): ISlasherInterface;
    static connect(address: string, runner?: ContractRunner | null): ISlasher;
}
