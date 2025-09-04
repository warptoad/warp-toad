import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../../common";
import type { BlobLib, BlobLibInterface } from "../../../../../contracts/evm/aztec-interfaces/rollup/BlobLib";
type BlobLibConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class BlobLib__factory extends ContractFactory {
    constructor(...args: BlobLibConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<BlobLib & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): BlobLib__factory;
    static readonly bytecode = "0x60bb6032600b8282823980515f1a607314602657634e487b7160e01b5f525f60045260245ffd5b305f52607381538281f3fe73000000000000000000000000000000000000000030146080604052600436106032575f3560e01c8063a9a1c6f4146036575b5f5ffd5b605c7f885cb69240a935d632d79c317109709ecfa91a80626ff3989d68f67f5b1dd12d81565b60405173ffffffffffffffffffffffffffffffffffffffff909116815260200160405180910390f3fea2646970667358221220f5a5507ad453d2669882ab55d10e798a052162b2636814e78b5f4da96ba526db64736f6c634300081d0033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly name: "VM_ADDRESS";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }];
    static createInterface(): BlobLibInterface;
    static connect(address: string, runner?: ContractRunner | null): BlobLib;
}
export {};
