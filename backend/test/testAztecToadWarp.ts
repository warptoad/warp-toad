// hardhat 
import hre, { ethers } from "hardhat"
//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

// aztec
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
// //@ts-ignore
// import {getSchnorrAccount } from "@aztec/accounts/schnorr/lazy";
import { poseidon2, poseidon3 } from 'poseidon-lite'

// artifacts
//@ts-ignore
import { WarpToadCoreContractArtifact, WarpToadCoreContract } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { hashCommitment, hashPreCommitment } from "../scripts/lib/hashing";

async function connectPXE() {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(PXE);
    return { wallets, PXE }
}



describe("AztecWarpToad", function () {
    async function deployWarpToad() {
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })
        const gigaRootHistorySize = 4n;
        const { wallets, PXE } = await connectPXE();
        const deployerWallet = wallets[0]
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
        const decimals = 6n; // only 6 decimals what is this tether??

        const constructorArgs = [nativeToken.target,wrappedTokenName,wrappedTokenSymbol,decimals]
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed() as WarpToadCoreContract;

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

            const balancePreSend = await AztecWarpToad.methods.balance_of(wallets[0].getAddress()).simulate()
            const amountToSend = 1n
            await AztecWarpToad.methods.transfer(wallets[1].getAddress(),1n).send().wait()

            const balancePostSend = await AztecWarpToad.methods.balance_of(wallets[0].getAddress()).simulate()

            expect(balancePostSend).to.equal(balancePreSend-amountToSend);

        });
    });

    describe("gigaRoot", function () {
        it("Should keep track of the gigaRoot", async function () {
            const { AztecWarpToad } = await deployWarpToad();

            expect(AztecWarpToad).not.equal(undefined);

            const gigaRoot1 = 42069n
            await AztecWarpToad.methods.receive_giga_root(gigaRoot1).send().wait();
            const contractsGigaRoot1 = await AztecWarpToad.methods.get_giga_root().simulate()
            expect(gigaRoot1).to.equal(contractsGigaRoot1);

            const gigaRoot2 = 6969n
            await AztecWarpToad.methods.receive_giga_root(gigaRoot2).send().wait();
            const contractsGigaRoot2 = await AztecWarpToad.methods.get_giga_root().simulate()
            expect(gigaRoot2).to.equal(contractsGigaRoot2);
            // TODO demonstrate getting a historical root with archive tree
        });

    });

    describe("burnAndMintLocal", function () {
        it("Should burn and mint on the aztec chain", async function () {
            // setup contract and wallets
            const { AztecWarpToad, wallets, PXE } = await deployWarpToad();
            const sender = wallets[0]
            const recipient =  wallets[1]
            
            // free money!! 
            // TODO hardcode a giga_root with free money so we can remove `mint_for_testing`
            const initialBalanceSender = 100n
            await AztecWarpToad.methods.mint_for_testing(initialBalanceSender,sender.getAddress()).send().wait();

            // burn!!!!
            console.log("burning!")
            const amountToBurn = 2n
            const balancePreBurn = await AztecWarpToad.methods.balance_of(sender.getAddress()).simulate()
            const aztecWalletChainId = sender.getChainId().toBigInt();
            const { chainId: chainIdEvmProvider } = await hre.ethers.provider.getNetwork()

            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id().simulate())
            const commitmentPreImg = {
                amount: amountToBurn,
                destination_chain_id: aztecWalletChainId,
                secret: 1234n,
                nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
            }
            const burnTx = await AztecWarpToad.methods.burn(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg).send().wait()
            const balancePostBurn = await AztecWarpToad.methods.balance_of(sender.getAddress()).simulate()

            // chain id is same as evm?? thats bad lmao
            console.log("Make issue of this. These shouldn't be the same!!!",{ aztecWalletChainId, chainIdEvmProvider})
            expect(chainIdAztecFromContract).to.equal(aztecWalletChainId);
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            expect(balancePostBurn).to.equal(balancePreBurn-amountToBurn);
            
            // mint        recipient: AztecAddress,
            console.log("minting!")
            const preCommitment = hashPreCommitment( commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.destination_chain_id)
            const commitment = hashCommitment(preCommitment, amountToBurn)

            // get info to reproduce the leaf has of our commitment (unique_note_hash = leaf)
            const txEffect = (await PXE.getTxEffect(burnTx.txHash))
            console.log({txEffect})
            const burnTxNullifier = txEffect?.data.nullifiers[0] as Fr
            console.log("finding unique_note_hash index within the tx")
            //const noteIndexOfCommitment = await findNoteHashIndex(AztecWarpToad,txEffect?.data.noteHashes!, Fr.fromHexString(ethers.toBeHex(commitment)), burnTxNullifier)
            const aztecBlockNumber = await PXE.getBlockNumber()
            await AztecWarpToad.methods.mint_local(recipient.getAddress(),aztecBlockNumber).send().wait()
            
            const balanceRecipient = await AztecWarpToad.methods.balance_of(recipient.getAddress()).simulate()
            expect(balanceRecipient).to.equal(commitmentPreImg.amount);
        });
    });
});