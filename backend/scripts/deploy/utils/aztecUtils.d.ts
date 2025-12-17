import { AztecNode } from "@aztec/aztec.js/node";
import { TestWallet } from "@aztec/test-wallet/server";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
export declare function getPxeUrl(): string;
export declare function getEnvArgs(): {
    nativeTokenAddress: string;
    PXE_URL: string;
    privateKey: string | undefined;
};
export declare function initNodeClient(): Promise<AztecNode>;
export declare function getAztecTestAccount(chainId: bigint): Promise<TestWallet>;
export declare function getContractInstanceFromAddress(address: AztecAddress): Promise<ContractInstanceWithAddress>;
//# sourceMappingURL=aztecUtils.d.ts.map