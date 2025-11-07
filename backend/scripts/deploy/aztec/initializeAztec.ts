// initializing more than one contract? use try and catch!
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from "../../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";
import { getAztecTestAccounts, initNodeClient, initPXE } from "../utils/aztecUtils";
import * as hre from "hardhat";
import { aztecDeployments, evmDeployments } from "../../dev_op/deployment";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { L2AztecBridgeAdapterContractArtifact } from "contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter";

export const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))


async function main() {


    const provider = hre.ethers.provider
    const chainId = (await provider.getNetwork()).chainId

    const wallet = await getAztecTestAccounts(chainId)

    const sponsoredPaymentMethod = undefined;
    const evmContractAddresses = evmDeployments[Number(chainId)]
    const aztecContractAddresses = aztecDeployments[Number(chainId)]
    console.log({ aztecContractAddresses })

    const L1AztecBridgeAdapter = evmContractAddresses["L1InfraModule#L1AztecBridgeAdapter"]

    const AztecWarpToadAddress = aztecContractAddresses["AztecWarpToad"]
    const L2AztecAdapterAddress = aztecContractAddresses["L2AztecBridgeAdapter"]


    if (chainId !== 31337n) {
        console.log("assuming ur not on sand box so registering the contracts with aztec testnet node")
        const nodeClient = await initNodeClient()
        const PXE = await initPXE(nodeClient);


        await PXE.registerContract({
            instance: WarpToadCoreContract as any,
            artifact: WarpToadCoreContractArtifact,
        })
        await delay(10000)
        const L2AztecAdapterContract = await nodeClient.getContract(L2AztecAdapterAddress as any)
        await PXE.registerContract({
            instance: L2AztecAdapterContract as any,
            artifact: L2AztecBridgeAdapterContractArtifact,
        })
        await delay(10000)

    }


    console.log(AztecAddress.fromString(AztecWarpToadAddress));

    const AztecWarpToad = await WarpToadCoreContract.at(AztecAddress.fromString(AztecWarpToadAddress), wallet)

    const initializationStatus: any = {}

    try {
        await AztecWarpToad.methods.initialize(L2AztecAdapterAddress, L1AztecBridgeAdapter).send({ fee: { paymentMethod: sponsoredPaymentMethod }, from: (await wallet.getAccounts())[0].item }).wait({ timeout: 60 * 60 * 12 }) // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["AztecWarpToad"] = true
    } catch (error) {
        console.warn(`couldn't initialize: AztecWarpToad at: ${AztecWarpToad.address}. 
        Was it already initialized?     
        `)
        console.warn(error)
        initializationStatus["AztecWarpToad"] = false
    }

    console.log(`
        initialized: 
            AztecWarpToad:              ${AztecWarpToad.address}
            initializationSuccess?:     ${initializationStatus["AztecWarpToad"]}
            args:                       ${JSON.stringify({ L2AztecAdapterAddress, L1AztecBridgeAdapter }, null, 2)}
        `)

}
main()