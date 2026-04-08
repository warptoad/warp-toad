import hre from "hardhat";
import poseidonSolidity from 'poseidon-solidity'
import { poseidon2 } from "poseidon-lite";
import { getContract, type Address, type Hex } from "viem";

const POSEIDON_T3_ABI = [
    { type: "function", name: "hash", stateMutability: "pure", inputs: [{ name: "input", type: "uint256[2]" }], outputs: [{ type: "uint256" }] },
] as const;

export async function deployPoseidon(): Promise<Address> {
    // https://github.com/chancehudson/poseidon-solidity/tree/main?tab=readme-ov-file#deploy
    const connection = await hre.network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const [sender] = await connection.viem.getWalletClients();

    // common js imports struggles
    const proxy = poseidonSolidity.proxy
    const PoseidonT3 = poseidonSolidity.PoseidonT3

    // First check if the proxy exists
    if (await publicClient.getCode({ address: proxy.address as Address }) === undefined) {
        // fund the keyless account
        const fundHash = await sender.sendTransaction({
            to: proxy.from as Address,
            value: BigInt(proxy.gas),
        });
        await publicClient.waitForTransactionReceipt({ hash: fundHash });

        // then send the presigned transaction deploying the proxy
        const proxyHash = await publicClient.sendRawTransaction({ serializedTransaction: proxy.tx as Hex });
        await publicClient.waitForTransactionReceipt({ hash: proxyHash });
    } else {
        console.log(`Proxy for poseidon was already deployed at: ${proxy.address}`)
    }

    // Then deploy the hasher, if needed
    if (await publicClient.getCode({ address: PoseidonT3.address as Address }) === undefined) {
        const hash = await sender.sendTransaction({
            to: proxy.address as Address,
            data: PoseidonT3.data as Hex,
        });
        await publicClient.waitForTransactionReceipt({ hash });
    } else {
        console.log(`PoseidonT3 was already deployed at: ${PoseidonT3.address}`)
    }

    const preImg: [bigint, bigint] = [1234n, 5678n];
    const jsHash = poseidon2(preImg);
    const PoseidonT3Contract = getContract({
        address: PoseidonT3.address as Address,
        abi: POSEIDON_T3_ABI,
        client: publicClient,
    });
    const solHash = await PoseidonT3Contract.read.hash([preImg]);
    if (BigInt(jsHash) !== BigInt(solHash)) {
        throw new Error("whoop hash didn't match something is really wrong!!");
    }
    console.log(`PoseidonT3 deployed to: ${PoseidonT3.address}`)
    return PoseidonT3.address as Address;
}
