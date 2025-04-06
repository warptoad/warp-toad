import hre from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

import { WarpToadCoreContractArtifact } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
// import WarpToadCoreContractArtifactJson from '../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'
// export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);


//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"


import { poseidon2 } from 'poseidon-lite'


//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
import { ethers } from "ethers";
const { PXE_URL = 'http://localhost:8080' } = process.env;

const MAX_TREE_DEPTH = 4n

async function connectPXE() {
    console.log("creating PXE client")
    const pxe = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(pxe);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(pxe);
    return { wallets, pxe }
}



describe("AztecAndL1WarpToad", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployL1WarpToad(maxTreeDepth=MAX_TREE_DEPTH) {
        // Contracts are deployed using the first signer/account by default
        //const [owner, otherAccount] = await hre.ethers.getSigners();
        hre.ethers.getContractFactory("PoseidonT3",)
        const gigaBridge = "0x0000000000000000000000000000000000000000"
        const nativeToken = await hre.ethers.deployContract("USDcoin",[],{ value: 0n, libraries: {} })
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
     
        const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
        const BinaryIMTLib = await hre.ethers.deployContract("BinaryIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
        const L1WarpToad = await hre.ethers.deployContract("L1WarpToad", [maxTreeDepth,gigaBridge,nativeToken.target,wrappedTokenSymbol,wrappedTokenName], {
          value: 0n,
          libraries: {
            BinaryIMT: BinaryIMTLib,
            PoseidonT3: PoseidonT3Lib 
          }
        });
    
        return { L1WarpToad,nativeToken,  BinaryIMTLib, PoseidonT3Lib };
      }
    


    async function deployL2AztecWarpToad(maxTreeDepth=MAX_TREE_DEPTH){//,nativeToken:ethers.Contract|any) {
        // Contracts are deployed using the first signer/account by default
        //const [owner, otherAccount] = await hre.ethers.getSigners();

        const { wallets } = await connectPXE();
        const deployerWallet = wallets[0]
        console.log({initArgs: [maxTreeDepth]})
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, [maxTreeDepth]).send().deployed();

        return { AztecWarpToad, wallets };
    }

    // describe("Deployment", function () {
    //     it("Should deploy", async function () {
    //         const { L1WarpToad,nativeToken} = await loadFixture(deployL1WarpToad);
    //         const { AztecWarpToad } = await deployL2AztecWarpToad(MAX_TREE_DEPTH);

    //         expect(AztecWarpToad).not.equal(undefined);
    //     });

    // });

    describe("Burn", function () {
        it("Should burn", async function () {

            const { L1WarpToad, nativeToken} = await loadFixture(deployL1WarpToad);
            const { AztecWarpToad } = await deployL2AztecWarpToad(MAX_TREE_DEPTH);

            // const AztecWarpToadReloaded = await Contract.at(AztecWarpToad.address, WarpToadCoreContractArtifact, wallets[0]);
            // console.log({AztecWarpToadReloaded})

            const amount = 100n
            const preCommitment1 = 1234n // TODO hash it!
            const commitment = poseidon2([preCommitment1,amount])

            const AztecL2rootPreBurn = await AztecWarpToad.methods.get_root().simulate();

            await AztecWarpToad.methods._insertLeaf(commitment).send().wait();
            const AztecL2RootPostBurn =  await AztecWarpToad.methods.get_root().simulate();



            expect(AztecL2rootPreBurn).not.equal(AztecL2RootPostBurn);

            console.log("evm")
            await nativeToken.getFreeShit(amount);
            await nativeToken.approve(L1WarpToad.target,amount);

            await L1WarpToad.wrap(amount)

            const L1RootPreBurn = await L1WarpToad.localRoot()
            await L1WarpToad.burn(preCommitment1,amount)
            const L1RootPostBurn = await L1WarpToad.localRoot()


            console.log({AztecL2rootPreBurn,L1RootPreBurn, AztecL2RootPostBurn,L1RootPostBurn})
            expect(AztecL2rootPreBurn).to.equal(L1RootPreBurn);
            expect(AztecL2RootPostBurn).to.equal(L1RootPostBurn);
        });
    });
});
