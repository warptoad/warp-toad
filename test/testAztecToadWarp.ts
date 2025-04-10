import hre, { ethers } from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

//@ts-ignore
import { WarpToadCoreContractArtifact } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
// import WarpToadCoreContractArtifactJson from '../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"
// export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);


//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
const { PXE_URL = 'http://localhost:8080' } = process.env;



async function connectPXE() {
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(PXE);
    return { wallets, PXE }
}



describe("L1WarpToad", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployWarpToad() {
        // Contracts are deployed using the first signer/account by default
        //const [owner, otherAccount] = await hre.ethers.getSigners();
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })

        // const initialSupply = 100n
        const gigaRootHistorySize = 4n;
        const { wallets, PXE } = await connectPXE();
        const deployerWallet = wallets[0]
        const constructorArgs = [gigaRootHistorySize]
        console.log({constructorArgs})
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed();

        return { AztecWarpToad, nativeToken, wallets, PXE };
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

            const sender = wallets[0]
            const initialBalanceSender = 100n
            await AztecWarpToad.methods.mint_for_testing(initialBalanceSender,sender.getAddress()).send().wait();

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


            const { AztecWarpToad, wallets, PXE } = await deployWarpToad();

            const sender = wallets[0]
            const recipient =  wallets[1]

            const initialBalanceSender = 100n
            await AztecWarpToad.methods.mint_for_testing(initialBalanceSender,sender.getAddress()).send().wait();

            const blockNumberPreBurn = await PXE.getBlockNumber()
            const balancePreBurn= await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            const amountToBurn = 2n
            console.log({balancePreBurn, blockNumberPreBurn})
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
            const burnTx = await AztecWarpToad.methods.burn(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg, sender.getAddress()).send().wait()


            // TODO cleanup
            const balancePostSend = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            console.log({balancePostSend})
            expect(balancePostSend).to.equal(balancePreBurn-amountToBurn);

            const gigaRoot1 = 42069n
            await AztecWarpToad.methods.receive_giga_root(gigaRoot1).send().wait();
            const historicalGigaRoot1 = await AztecWarpToad.methods.get_historical_giga_root().simulate()
            console.log({gigaRoot1, historicalGigaRoot1})

            const gigaRoot2 = 6969n
            await AztecWarpToad.methods.receive_giga_root(gigaRoot2).send().wait();
            const allGigaRoots = await AztecWarpToad.methods.get_all_giga_roots().simulate();
            console.log({allGigaRoots})

            const historicalGigaRoot2 = await AztecWarpToad.methods.get_historical_giga_root_by_index(1n).simulate();
            console.log({historicalGigaRoot2,gigaRoot2})

            console.log("mintinnnggg")
            const commitmentReproduced = ethers.toBeHex(await  AztecWarpToad.methods.hash_commit(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg).simulate())
            
            const blockNumber = await PXE.getBlockNumber()
            const txEffect = (await PXE.getTxEffect(burnTx.txHash))
            console.log({burnTx, noteHashes:  txEffect?.data.noteHashes, nullifierBurn: txEffect?.data.nullifiers})
            const burnTxNullifier = txEffect?.data.nullifiers[0]
            
            // TODO how tf do i find the index of a noteHash if the note hash depends on the index???
            const noteIndexOfCommitment = 1n // just a guess lmao
            // txEffect?.data.noteHashes.findIndex((note)=>note === Fr.fromHexString(commitmentReproduced))

            const unique_note_hash = ethers.toBeHex(await  AztecWarpToad.methods.hash_siloed_commit(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg,burnTxNullifier,noteIndexOfCommitment).simulate())
            console.log({commitmentReproduced,unique_note_hash, blockNumber})
            

            await AztecWarpToad.methods.mint_local(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg,recipient.getAddress(),blockNumber,burnTxNullifier,noteIndexOfCommitment).send().wait()
            const balanceRecipient = await AztecWarpToad.methods.get_balance(recipient.getAddress()).simulate()

            expect(balanceRecipient).to.equal(commitmentPreImg.amount);
        });
    });
});
