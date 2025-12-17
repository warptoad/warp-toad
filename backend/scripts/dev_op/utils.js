import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";
export async function checkFileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}
export async function promptBool(question) {
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}
const projectRootEVM = `${__dirname}/../..`;
const projectRootAZTEC = `${__dirname}/../..`;
export const AZTEC_DEPLOYED_FOLDER_PATH = `${projectRootAZTEC}/scripts/deploy/aztec/aztecDeployments`;
export const EVM_DEPLOYMENT_FOLDER_PATH = `${projectRootEVM}/ignition/deployments`;
export function getAztecDeployedAddressesFolderPath(chainId) {
    return `${AZTEC_DEPLOYED_FOLDER_PATH}/${Number(chainId)}`;
}
export function getAztecDeployedAddressesFilePath(chainId) {
    return `${getAztecDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
export function getEvmDeployedAddressesFolderPath(chainId) {
    return `${EVM_DEPLOYMENT_FOLDER_PATH}/chain-${Number(chainId)}`;
}
export function getEvmDeployedAddressesFilePath(chainId) {
    return `${getEvmDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`;
}
/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId
 * @returns
 */
export async function getContractAddressesAztec(chainId) {
    // try {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId);
    const json = (await fs.readFile(deployedAddressesPath)).toString();
    return JSON.parse(json);
    // } catch (error) {
    //     console.warn(`issue with getting contract addresses for chainId:${chainId.toString()}`)
    //     console.log(error)
    //     return undefined
    // }
    //return aztecDeployments[Number(chainId)]
}
/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId
 * @returns
 */
export async function getContractAddressesEvm(chainId) {
    try {
        const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId);
        const json = (await fs.readFile(deployedAddressesPath)).toString();
        return JSON.parse(json);
    }
    catch (error) {
        console.warn(`issue with getting contract addresses for chainId:${chainId.toString()}`);
        console.log(error);
        return undefined;
    }
}
//# sourceMappingURL=utils.js.map