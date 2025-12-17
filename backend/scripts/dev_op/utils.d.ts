export declare function checkFileExists(filePath: string): Promise<boolean>;
export declare function promptBool(question: string): Promise<boolean>;
export declare const AZTEC_DEPLOYED_FOLDER_PATH: string;
export declare const EVM_DEPLOYMENT_FOLDER_PATH: string;
export declare function getAztecDeployedAddressesFolderPath(chainId: bigint): string;
export declare function getAztecDeployedAddressesFilePath(chainId: bigint): string;
export declare function getEvmDeployedAddressesFolderPath(chainId: bigint): string;
export declare function getEvmDeployedAddressesFilePath(chainId: bigint): string;
/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId
 * @returns
 */
export declare function getContractAddressesAztec(chainId: bigint): Promise<any>;
/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId
 * @returns
 */
export declare function getContractAddressesEvm(chainId: bigint): Promise<any>;
//# sourceMappingURL=utils.d.ts.map