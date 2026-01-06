import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";
import { DeploymentStringyfiedArtifact } from 'scripts/deploy/utils/aztecUtilsNoEnv';

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
    // try {
    const deployedAddressesPath = getAztecDeployedAddressesFilePath(chainId)
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
    // } catch (error) {
    //     console.warn(`issue with getting contract addresses for chainId:${chainId.toString()}`)
    //     console.log(error)
    //     return undefined
    // }

    //return aztecDeployments[Number(chainId)]
}

/**
 * NOTE: contractName can be "AztecWarpToad" or "L2AztecBridgeAdapter"
 * TODO these names are inconsistent. AztecWarpToad is also named WarpToadCore in the nr code!!
 * @param chainId 
 * @param contractName 
 * @returns 
 */
export async function getDeploymentArtifactAztec(chainId: bigint, contractName:string) {
    const filePath = `${getAztecDeployedAddressesFolderPath(chainId)}/${contractName}DeployArtifact.json`
    const json = (await fs.readFile(filePath)).toString()
    return JSON.parse(json) as DeploymentStringyfiedArtifact
}

/**
 * @WARNING uses relative file paths, only use in deploy scripts that are not exported as npm packages!
 * @param chainId 
 * @returns 
 */
export async function getContractAddressesEvm(chainId: bigint) {
    try {
        const deployedAddressesPath = getEvmDeployedAddressesFilePath(chainId)
        const json = (await fs.readFile(deployedAddressesPath)).toString()
        return JSON.parse(json)
    } catch (error) {
        console.warn(`issue with getting contract addresses for chainId:${chainId.toString()}`)
        console.log(error)
        return undefined
    }
}