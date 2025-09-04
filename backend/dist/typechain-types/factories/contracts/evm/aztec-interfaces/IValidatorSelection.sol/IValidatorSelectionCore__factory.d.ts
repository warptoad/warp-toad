import { type ContractRunner } from "ethers";
import type { IValidatorSelectionCore, IValidatorSelectionCoreInterface } from "../../../../../contracts/evm/aztec-interfaces/IValidatorSelection.sol/IValidatorSelectionCore";
export declare class IValidatorSelectionCore__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "setupEpoch";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IValidatorSelectionCoreInterface;
    static connect(address: string, runner?: ContractRunner | null): IValidatorSelectionCore;
}
