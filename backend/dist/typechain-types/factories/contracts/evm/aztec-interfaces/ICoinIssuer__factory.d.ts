import { type ContractRunner } from "ethers";
import type { ICoinIssuer, ICoinIssuerInterface } from "../../../../contracts/evm/aztec-interfaces/ICoinIssuer";
export declare class ICoinIssuer__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "_to";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "mint";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "mintAvailable";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): ICoinIssuerInterface;
    static connect(address: string, runner?: ContractRunner | null): ICoinIssuer;
}
