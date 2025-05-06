// initializing more than one contract? use try and catch!
//@ts-ignore
import { Contract, createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { WarpToadCoreContract, WarpToadCoreContractArtifact } from "../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";
//@ts-ignore
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { getContractAddressesAztec, getContractAddressesEvm } from "../dev_op/getDeployedAddresses";
const hre = require("hardhat")


function getArgs() {
    if(!Boolean(process.env.PXE_URL) ) { 
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts  --network aztecSandbox")
    }

    //const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL as string
    return { PXE_URL}

}

async function main() {
    const {PXE_URL} = getArgs()
    //----PXE and wallet-----
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    console.warn("using getInitialTestAccountsWallets. This will break on testnet!!")
    const wallets = await getInitialTestAccountsWallets(PXE);
    const aztecWallet = wallets[0]

    const provider = hre.ethers.provider
    const chainId = (await provider.getNetwork()).chainId
    const evmContractAddresses = await getContractAddressesEvm(chainId)
    const aztecContractAddresses = await getContractAddressesAztec(chainId)

    const L1AztecBridgeAdapter = evmContractAddresses["L1InfraModule#L1AztecBridgeAdapter"]

    const AztecWarpToadAddress = aztecContractAddresses["AztecWarpToad"]
    const L2AztecAdapterAddress =  aztecContractAddresses["L2AztecBridgeAdapter"]

    
    const AztecWarpToad = await Contract.at(AztecWarpToadAddress, WarpToadCoreContractArtifact, aztecWallet) as WarpToadCoreContract
    
    const initializationStatus:any = {}

    try{
        await AztecWarpToad.methods.initialize(L2AztecAdapterAddress, L1AztecBridgeAdapter).send().wait() // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        initializationStatus["AztecWarpToad"] = true
    } catch {
        console.warn(`couldn't initialize: AztecWarpToad at: ${AztecWarpToad.address}. 
        Was it already initialized?     
        `)
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