import { AztecNode } from "@aztec/aztec.js/node";
import { PXE } from "@aztec/pxe/server";
import { TestWallet } from "@aztec/test-wallet/server";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
export declare function initPXE(node: AztecNode, chainId: bigint): Promise<PXE>;
export declare function setupWallet(node: AztecNode): Promise<TestWallet>;
export declare function getAztecTestAccounts(aztecNode: AztecNode): Promise<TestWallet[]>;
export declare function initNodeClientNoEnv(nodeUrl: string): Promise<AztecNode>;
export declare function getAztecTestAccountNoEnv(chainId: bigint, nodeUrl: string): Promise<TestWallet>;
export declare function getContractInstanceFromAddressNoEnv(address: AztecAddress, nodeUrl: string): Promise<ContractInstanceWithAddress>;
//# sourceMappingURL=aztecUtilsNoEnv.d.ts.map