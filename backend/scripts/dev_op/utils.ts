import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";

export async function checkFileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

export async function promptBool(question: string): Promise<boolean> {
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}

const projectRootEVM = `${__dirname}/../..`
const projectRootAZTEC = `${__dirname}/../..`
export const AZTEC_DEPLOYED_FOLDER_PATH = `${projectRootAZTEC}/scripts/deploy/aztec/aztecDeployments`
export const EVM_DEPLOYMENT_FOLDER_PATH = `${projectRootEVM}/ignition/deployments`


export function getAztecDeployedAddressesFolderPath(chainId: bigint) {
    return `${AZTEC_DEPLOYED_FOLDER_PATH}/${Number(chainId)}`
}

export function getAztecDeployedAddressesFilePath(chainId: bigint) {
    return `${getAztecDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`
}

export function getEvmDeployedAddressesFolderPath(chainId: bigint) {
    return `${EVM_DEPLOYMENT_FOLDER_PATH}/chain-${Number(chainId)}`
}

export function getEvmDeployedAddressesFilePath(chainId: bigint) {
    return `${getEvmDeployedAddressesFolderPath(chainId)}/deployed_addresses.json`
}

/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId 
 * @returns 
 */
export async function getContractAddressesAztec(chainId: bigint) {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId)
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
    //return aztecDeployments[Number(chainId)]
}

/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId 
 * @returns 
 */
export async function getContractAddressesEvm(chainId: bigint) {
    const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId)
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
}