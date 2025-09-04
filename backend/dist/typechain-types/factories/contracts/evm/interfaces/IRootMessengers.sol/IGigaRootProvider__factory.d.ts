import { type ContractRunner } from "ethers";
import type { IGigaRootProvider, IGigaRootProviderInterface } from "../../../../../contracts/evm/interfaces/IRootMessengers.sol/IGigaRootProvider";
export declare class IGigaRootProvider__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "gigaRoot";
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
            readonly name: "_gigaRootRecipient";
            readonly type: "address";
        }];
        readonly name: "sendGigaRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }];
    static createInterface(): IGigaRootProviderInterface;
    static connect(address: string, runner?: ContractRunner | null): IGigaRootProvider;
}
