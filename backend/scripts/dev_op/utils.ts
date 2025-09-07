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

const projectRoot = `${__dirname}/../../`
export const AZTEC_DEPLOYED_FOLDER_PATH = `${projectRoot}/scripts/deploy/aztec/aztecDeployments/`
export const EVM_DEPLOYMENT_FOLDER_PATH = `${projectRoot}/ignition/deployments`


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