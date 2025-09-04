import { type ContractRunner } from "ethers";
import type { ILocalRootProvider, ILocalRootProviderInterface } from "../../../../../contracts/evm/interfaces/IRootMessengers.sol/ILocalRootProvider";
export declare class ILocalRootProvider__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "getLocalRootAndBlock";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): ILocalRootProviderInterface;
    static connect(address: string, runner?: ContractRunner | null): ILocalRootProvider;
}
