import { type ContractRunner } from "ethers";
import type { IGigaRootRecipient, IGigaRootRecipientInterface } from "../../../../../contracts/evm/interfaces/IRootMessengers.sol/IGigaRootRecipient";
export declare class IGigaRootRecipient__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_gigaRoot";
            readonly type: "uint256";
        }];
        readonly name: "receiveGigaRoot";
        readonly outputs: readonly [];
        readonly stateMutability: "payable";
        readonly type: "function";
    }];
    static createInterface(): IGigaRootRecipientInterface;
    static connect(address: string, runner?: ContractRunner | null): IGigaRootRecipient;
}
