import fs from "fs/promises";

export async function getContractAddressesAztec(chainId:number) {
    const folderPath = `${__dirname}/../deploy/aztec/aztecDeployments/${Number(chainId)}`
    const deployedAddressesPath = `${folderPath}/deployed_addresses.json`
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
    
}

export async function getContractAddressesEvm(chainId: bigint) {
    const deployedAddressesPath = `${__dirname}/../../ignition/deployments/chain-${chainId.toString()}/deployed_addresses.json`
    const json = (await fs.readFile(deployedAddressesPath)).toString()
    return JSON.parse(json)
}
