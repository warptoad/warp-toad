// initializing more than one contract? use try and catch!
import hre from "hardhat";

import { getContractAddressesAztec, getContractAddressesEvm, getViemContract } from "../../scripts/utils";
import { initNodeClient } from "../utils/aztecUtils";


async function main() {
    // const wallets = await getInitialTestAccountsWallets(PXE);
    // const deployWallet = wallets[0]
    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const [signer] = await connection.viem.getWalletClients();

    //--------arguments-------------------
    // cant pass arguments like flags with hardhat. so it like `NATIVE_TOKEN_ADDRESS=0xurTokenAddress hardhat run` instead
    const nodeInfo = await (await initNodeClient()).getNodeInfo()
    const aztecNativeBridgeRegistryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();

    const chainId = BigInt(await publicClient.getChainId())
    const IS_MAINNET = chainId === 1n
    const scrollChainId = IS_MAINNET ? 534352n : 534351n
    const L1DeployedAddresses = await getContractAddressesEvm(chainId)
    const L2ScrollDeployedAddresses = await getContractAddressesEvm(scrollChainId)
    const aztecDeployedAddresses = await getContractAddressesAztec(chainId)
    const L1WarpToadAddress = L1DeployedAddresses["L1WarpToadModule#L1WarpToad"]
    const gigaBridgeAddress = L1DeployedAddresses["L1InfraModule#GigaBridge"]
    const L1AztecBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1AztecBridgeAdapter"]
    const L1ScrollBridgeAdapterAddress = L1DeployedAddresses["L1InfraModule#L1ScrollBridgeAdapter"]

    const {address:L2AztecAdapterAddress} = aztecDeployedAddresses["L2AztecBridgeAdapter"]
    const {address:AztecWarpToadAddress} = aztecDeployedAddresses["AztecWarpToad"]
    const L2ScrollBridgeAdapterAddress = L2ScrollDeployedAddresses ? L2ScrollDeployedAddresses["L2ScrollModule#L2ScrollBridgeAdapter"] : "0x0000000000000000000000000000000000000000"

    const L1AztecBridgeAdapter = await getViemContract("L1AztecBridgeAdapter", L1AztecBridgeAdapterAddress, publicClient, signer)
    const L1ScrollBridgeAdapter = await getViemContract("L1ScrollBridgeAdapter", L1ScrollBridgeAdapterAddress, publicClient, signer)
    const L1WarpToad = await getViemContract("L1WarpToad", L1WarpToadAddress, publicClient, signer)
    const initializationStatus: any = {}

    //aztec
    try {
        const hash = await L1AztecBridgeAdapter.write.initialize([aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress]);
        await publicClient.waitForTransactionReceipt({ hash });
        initializationStatus["L1AztecBridgeAdapter"] = true
    } catch (error: any) {
        if (error.message?.includes("cant initialize twice")) {
            console.warn(`couldn't initialize: L1AztecBridgeAdapter at: ${L1AztecBridgeAdapter.address}.
            It was already initialized!
            `)
            initializationStatus["L1AztecBridgeAdapter"] = "false (already initialized)"
        } else {
            console.log({errMessage:error.message})
            throw new Error(`couldn't initialize: L1AztecBridgeAdapter at: ${L1AztecBridgeAdapter.address}. `, { cause: error })
        }
    }

    // scroll
    try {
        const hash = await L1ScrollBridgeAdapter.write.initialize([L2ScrollBridgeAdapterAddress, gigaBridgeAddress]);
        await publicClient.waitForTransactionReceipt({ hash });
        initializationStatus["L1ScrollBridgeAdapter"] = true
    } catch {
        console.warn(`couldn't initialize: L1ScrollBridgeAdapter at: ${L1ScrollBridgeAdapter.address}.
        Was it already initialized?
        `)
        initializationStatus["L1ScrollBridgeAdapter"] = false
    }

    // wait for nonce to settle
    await new Promise(r => setTimeout(r, 3000));

    //warptoad
    try {
        const hash = await L1WarpToad.write.initialize([gigaBridgeAddress, L1WarpToad.address, BigInt(AztecWarpToadAddress as string)]) // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        await publicClient.waitForTransactionReceipt({ hash });
        initializationStatus["L1WarpToad"] = true
    } catch (error: any) {
        if (error.message?.includes("gigaRootProvider is already set")) {
            console.warn(`couldn't initialize: L1WarpToad at: ${L1WarpToad.address}.
            It was already initialized!
            `)
            initializationStatus["L1WarpToad"] = "false (already initialized)"
        } else {
            throw new Error(`couldn't initialize: L1WarpToad at: ${L1WarpToad.address}`, { cause: error })
        }
    }



    console.log(`
    initialized:
        L1ScrollBridgeAdapter:      ${L1ScrollBridgeAdapter.address}
        initializationSuccess?:     ${initializationStatus["L1ScrollBridgeAdapter"]}
        args:                       ${JSON.stringify({ L2ScrollBridgeAdapterAddress, gigaBridgeAddress }, null, 2)}
        gigaBridgeAddress:          ${await L1ScrollBridgeAdapter.read.gigaBridge()}

        L1AztecBridgeAdapter:       ${L1AztecBridgeAdapter.address}
        initializationSuccess?:     ${initializationStatus["L1AztecBridgeAdapter"]}
        args:                       ${JSON.stringify({ aztecNativeBridgeRegistryAddress, L2AztecAdapterAddress, gigaBridgeAddress }, null, 2)}
        gigaBridgeAddress:          ${await L1AztecBridgeAdapter.read.gigaBridge()}

        L1WarpToad:                 ${L1WarpToad.address}
        initializationSuccess?:     ${initializationStatus["L1WarpToad"]}
        args:                       ${JSON.stringify({ gigaBridgeAddress, L1WarpToad: L1WarpToad.address }, null, 2)}
    `)
}
main()  