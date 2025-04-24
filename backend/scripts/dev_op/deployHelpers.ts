
import { ethers, NonceManager } from "ethers";
import poseidon from 'poseidon-solidity'

export async function deployPoseidon(signer:ethers.Signer) : Promise<ethers.AddressLike> {
    const provider: ethers.Provider = signer.provider!

    // First check if the proxy exists
    if (await provider.getCode(poseidon.proxy.address) === '0x') {
        // fund the keyless account
        (await signer.sendTransaction({
            to: poseidon.proxy.from,
            value: poseidon.proxy.gas,
        })).wait(1)

        //readme is wrong using provider.sendTransaction
        // then send the presigned transaction deploying the proxy
        await (await provider.broadcastTransaction(poseidon.proxy.tx)).wait(1)
    } else {
        console.log(`Proxy for poseidon was already deployed at: ${poseidon.proxy.address}`)
    }

    // Then deploy the hasher, if needed
    if (await provider.getCode(poseidon.PoseidonT3.address) === '0x') {
        //readme is wrong having typo here: send.sendTransaction instead of sender
        await (await signer.sendTransaction({
            to: poseidon.proxy.address,
            data: poseidon.PoseidonT3.data
        })).wait(1)
    } else {
        console.log(`PoseidonT3 was already deployed at: ${poseidon.PoseidonT3.address}`)
    }
    console.log(`PoseidonT3 deployed to: ${poseidon.PoseidonT3.address}`)
    return ethers.getAddress(poseidon.PoseidonT3.address)
}

export async function deployArtifact(abi: any, bytecode: any, signer:ethers.Signer, constructorArgs:ethers.BytesLike[],nativeTokenDeploymentArgs:any): Promise<ethers.BaseContract>{ //TODO :ethers.ContractMethodArgs) {
    const factory = new ethers.ContractFactory(abi, bytecode, signer)
    const contract:ethers.BaseContract = await factory.deploy(...constructorArgs,nativeTokenDeploymentArgs )
    await contract.waitForDeployment()
    return contract
  }


