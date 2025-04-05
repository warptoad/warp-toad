import hre from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

// import { WarpToadCoreContractArtifact } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import WarpToadCoreContractArtifactJson from '../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);


//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
const { PXE_URL = 'http://localhost:8080' } = process.env;



async function connectPXE() {
    console.log("creating PXE client")
    const pxe = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(pxe);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(pxe);
    return { wallets, pxe }
}



describe("L1WarpToad", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployWarpToad() {
        // Contracts are deployed using the first signer/account by default
        //const [owner, otherAccount] = await hre.ethers.getSigners();
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })

        const maxTreeDepth = 4n // 32n is too big for L2gas limit anything above 4n is too high
        // const L1WarpToad = await hre.ethers.deployContract(
        //     "L1WarpToad", [maxTreeDepth,gigaBridge,nativeToken.target,wrappedTokenSymbol,wrappedTokenName], {
        //     value: 0n,
        //     libraries: {
        //         LeanIMT: LeanIMTLib,
        //         PoseidonT3: PoseidonT3Lib 
        //     }
        // });
        const { wallets } = await connectPXE();
        const deployerWallet = wallets[0]
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, [maxTreeDepth])
            .send()
            .deployed();

        return { AztecWarpToad, nativeToken, wallets };
    }

    describe("Deployment", function () {
        it("Should deploy", async function () {
            const { AztecWarpToad } = await deployWarpToad();

            expect(AztecWarpToad).not.equal(undefined);
        });

    });

    describe("Burn", function () {
        it("Should burn", async function () {


            const { AztecWarpToad } = await deployWarpToad();

            // const AztecWarpToadReloaded = await Contract.at(AztecWarpToad.address, WarpToadCoreContractArtifact, wallets[0]);
            // console.log({AztecWarpToadReloaded})

            const rootPreBurn = await AztecWarpToad.methods.get_root().simulate();
            await AztecWarpToad.methods._insertLeaf(1234n).send().wait();
            const rootPostBurn =  await AztecWarpToad.methods.get_root().simulate();
            console.log({rootPostBurn, rootPreBurn})


            expect(rootPreBurn).not.equal(rootPostBurn);
        });
    });
});
