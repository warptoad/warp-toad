// initializing more than one contract? use try and catch!
//@ts-ignore
import { AztecAddress, Contract, createAztecNodeClient, createPXEClient, waitForPXE , Fr, GrumpkinScalar, PXE} from "@aztec/aztec.js";
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from "../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { getContractAddressesAztec, getContractAddressesEvm } from "../dev_op/getDeployedAddresses";
//@ts-ignore
import { computePartialAddress } from "@aztec/stdlib/contract";
import { ObsidionDeployerFPCContractArtifact } from "../dev_op/getObsidionWallet/ObsidionDeployerFPC";
import { getObsidionDeployerFPCWallet } from "../dev_op/getObsidionWallet/getObsidionWallet";


const hre = require("hardhat")

const obsidionDeployerFPCAddress = AztecAddress.fromField(Fr.fromHexString("0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5")) //0x19f8873315cad78e160bdcb686bcdc8bd3760ca215966b677b79ba2cfb68c1b5
//lian told me it was 0>
const OBSIDION_DEPLOYER_SECRET_KEY = "0x00"
const AZTEC_NODE_URL = "https://full-node.alpha-testnet.aztec.network"
const delay = async (timeInMs: number) => await new Promise((resolve) => setTimeout(resolve, timeInMs))
export async function getAztecWallet(pxe: PXE, privateKey: string, nodeUrl: string, chainId: bigint) {
    if (chainId == 31337n) { 
        console.warn("assuming ur on sanbox since chainId is 31337")
        return (await getInitialTestAccountsWallets(pxe))[0]

    }else {
        const obsidionDeployerFPCSigningKey = GrumpkinScalar.fromHexString(privateKey as string)
        console.warn("assuming ur on testnet/mainnet since chainId is NOT 31337")
        //await getObsidionDeployerFPC(pxe, nodeUrl,obsidionDeployerFPCAddress,obsidionDeployerFPCSigningKey.toField().toString(),OBSIDION_DEPLOYER_SECRET_KEY)
        const node = createAztecNodeClient(nodeUrl)
        const contract = await node.getContract(obsidionDeployerFPCAddress as any)
        if (!contract) {
            throw new Error("Contract not found")
        }
        await delay(60000)
        // const obsidionDeployerFPC = await (
        //     await AccountManager.create(
        //         pxe,
        //         Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY),
        //         new ObsidionDeployerFPCContractClass(obsidionDeployerFPCSigningKey),
        //         contract.salt as unknown as Salt,
        //     )
        // ).getWallet()

        await pxe.registerAccount(
            Fr.fromString(OBSIDION_DEPLOYER_SECRET_KEY),
            await computePartialAddress(contract as any) as any as Fr,
        )
        await delay(60000)
        await pxe.registerContract({
            instance: contract as any,
            artifact: ObsidionDeployerFPCContractArtifact,
        })
        await delay(60000)
        const wallet = await getObsidionDeployerFPCWallet(pxe, obsidionDeployerFPCAddress, obsidionDeployerFPCSigningKey)
        return wallet

    }
}


function getEnvArgs() {
    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }

    if (!Boolean(process.env.PRIVATE_KEY)) {
        throw new Error("PRIVATE_KEY not set")
    }


    const PXE_URL = process.env.PXE_URL as string
    return { PXE_URL, privateKey:process.env.PRIVATE_KEY }

}


async function main() {
    const {PXE_URL, privateKey} = getEnvArgs()
    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);



    const provider = hre.ethers.provider
    const chainId = (await provider.getNetwork()).chainId

    const aztecWallet = await getAztecWallet(PXE,privateKey as string,AZTEC_NODE_URL ,chainId)
    const evmContractAddresses = await getContractAddressesEvm(chainId)
    const aztecContractAddresses = await getContractAddressesAztec(chainId)
    console.log({aztecContractAddresses})

    const L1AztecBridgeAdapter = evmContractAddresses["L1InfraModule#L1AztecBridgeAdapter"]

    const AztecWarpToadAddress = aztecContractAddresses["AztecWarpToad"]
    const L2AztecAdapterAddress =  aztecContractAddresses["L2AztecBridgeAdapter"]

    const node = createAztecNodeClient(AZTEC_NODE_URL)
    await node.getContract(AztecWarpToadAddress as any)
    await delay(60000)
    await node.getContract(L2AztecAdapterAddress as any)
    await delay(60000)
    const AztecWarpToad = await Contract.at(AztecWarpToadAddress, WarpToadCoreContractArtifact, aztecWallet) as WarpToadCoreContract
    
    const initializationStatus:any = {}

    try{
        await AztecWarpToad.methods.initialize(L2AztecAdapterAddress, L1AztecBridgeAdapter).send().wait() // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
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
            initializationSuccess?:     ${initializationStatus["AztecWarpToad"] }
            args:                       ${JSON.stringify({L2AztecAdapterAddress, L1AztecBridgeAdapter}, null, 2)}
        `)

}
main()