import { type ContractRunner } from "ethers";
import type { IRewardDistributor, IRewardDistributorInterface } from "../../../../contracts/evm/aztec-interfaces/IRewardDistributor";
export declare class IRewardDistributor__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "canonicalRollup";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_to";
            readonly type: "address";
        }];
        readonly name: "claim";
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
            readonly name: "_to";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "claimBlockRewards";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): IRewardDistributorInterface;
    static connect(address: string, runner?: ContractRunner | null): IRewardDistributor;
}
