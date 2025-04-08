import hre from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

//@ts-ignore
import { WarpToadCoreContractArtifact } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
// import WarpToadCoreContractArtifactJson from '../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
// export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);


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

        const initialSupply = 100n
        const { wallets } = await connectPXE();
        const deployerWallet = wallets[0]
        const constructorArgs = [initialSupply, deployerWallet.getAddress().toString()]
        console.log({constructorArgs})
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
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

    describe("transfer", function () {
        it("Should do a private transfer", async function () {


            const { AztecWarpToad, wallets } = await deployWarpToad();

            const balancePreSend = await AztecWarpToad.methods.get_balance(wallets[0].getAddress()).simulate()
            const amountToSend = 1n
            console.log({balancePreSend})
            await AztecWarpToad.methods.transfer(1n,wallets[0].getAddress(), wallets[1].getAddress()).send().wait()

            const balancePostSend = await AztecWarpToad.methods.get_balance(wallets[0].getAddress()).simulate()
            console.log({balancePostSend})

            expect(balancePostSend).to.equal(balancePreSend-amountToSend);
        });
    });

    describe("burn and mint happy path", function () {
        it("Should burn and mint", async function () {


            const { AztecWarpToad, wallets } = await deployWarpToad();

            const sender = wallets[0]
            const recipient =  wallets[1]

            const balancePreBurn= await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            const amountToBurn = 2n
            console.log({balancePreBurn})
            const walletChainId =  sender.getChainId().toBigInt();
            const chainIdAztecFromContract =  hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id().simulate())
            // chain is same as hardhat evm?? thats bad lmao

            console.log({walletChainId, chainIdAztecFromContract})
            expect(chainIdAztecFromContract).to.equal(walletChainId);

            const commitmentPreImg = {
                amount: amountToBurn,
                destination_chain_id: sender.getChainId(),
                secret: 1234n,
                nullifier_preimg: 4321n,
    
            }
            await AztecWarpToad.methods.burn(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg, sender.getAddress()).send().wait()

            const balancePostSend = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            console.log({balancePostSend})
            expect(balancePostSend).to.equal(balancePreBurn-amountToBurn);

            console.log("mintinnnggg")
            await AztecWarpToad.methods.mint_local(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg,recipient.getAddress()).send().wait()
            const balanceRecipient = await AztecWarpToad.methods.get_balance(recipient.getAddress()).simulate()

            expect(balanceRecipient).to.equal(commitmentPreImg.amount);
        });
    });
});
