import hre, { ethers } from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

//@ts-ignore
import { WarpToadCoreContractArtifact, WarpToadCoreContract } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
// import WarpToadCoreContractArtifactJson from '../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"
// export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);


//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

// //@ts-ignore
// import {getSchnorrAccount } from "@aztec/accounts/schnorr/lazy";
import { WarpToadCore } from "../typechain-types";

import { poseidon2, poseidon3 } from 'poseidon-lite'

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



describe("AztecWarpToad", function () {
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
        const constructorArgs = [nativeToken.target]
        console.log({constructorArgs})
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

            const balancePreSend = await AztecWarpToad.methods.get_balance(wallets[0].getAddress()).simulate()
            const amountToSend = 1n
            await AztecWarpToad.methods.transfer(1n,wallets[0].getAddress(), wallets[1].getAddress()).send().wait()

            const balancePostSend = await AztecWarpToad.methods.get_balance(wallets[0].getAddress()).simulate()

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
            const balancePreBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            const aztecWalletChainId = sender.getChainId().toBigInt();
            const { chainId: chainIdEvmProvider } = await hre.ethers.provider.getNetwork()

            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id().simulate())

            const commitmentPreImg = {
                amount: amountToBurn,
                destination_chain_id: aztecWalletChainId,
                secret: 1234n,
                nullifier_preimg: 4321n,
    
            }
            const burnTx = await AztecWarpToad.methods.burn(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg, sender.getAddress()).send().wait()
            const balancePostBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()

            // chain id is same as evm?? thats bad lmao
            console.log("Make issue of this. These shouldn't be the same!!!",{ aztecWalletChainId, chainIdEvmProvider})
            expect(chainIdAztecFromContract).to.equal(aztecWalletChainId);
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            expect(balancePostBurn).to.equal(balancePreBurn-amountToBurn);
            
            // mint
            console.log("minting!")
            const commitment =Fr.fromHexString( hashCommitment( commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.destination_chain_id,commitmentPreImg.amount ))

            // get info to reproduce the leaf has of our commitment (unique_note_hash = leaf)
            const txEffect = (await PXE.getTxEffect(burnTx.txHash))
            const burnTxNullifier = txEffect?.data.nullifiers[0] as Fr
            console.log("finding unique_note_hash index within the tx")
            const noteIndexOfCommitment = await findNoteHashIndex(AztecWarpToad,txEffect?.data.noteHashes!,commitment, burnTxNullifier)

            await AztecWarpToad.methods.mint_local(commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.amount,recipient.getAddress(),burnTxNullifier,noteIndexOfCommitment).send().wait()
            
            const balanceRecipient = await AztecWarpToad.methods.get_balance(recipient.getAddress()).simulate()
            expect(balanceRecipient).to.equal(commitmentPreImg.amount);
        });
    });
});

// TODO move this to different file ----
async function findNoteHashIndex(AztecWarpToad:WarpToadCoreContract, noteHashesInTx: Fr[], plainNoteHash: Fr,firstNullifierInTx:Fr) {
    const contractAddress = AztecWarpToad.address;
    const getUniqueNote = async (index:bigint)=> await AztecWarpToad.methods.hash_unique_note_hash_helper(contractAddress, plainNoteHash, firstNullifierInTx, index).simulate()
    for (let index = 0; index < noteHashesInTx.length; index++) {
        const hashInTx = noteHashesInTx[index]
        const hashAttempt = await getUniqueNote(BigInt(index))
        if (hashAttempt === hashInTx.toBigInt() ) {
            return index;
        }
    }

    throw new Error("couldn't find the note hash index :/");
}

async function hashUniqueNoteHash(AztecWarpToad:WarpToadCoreContract, noteHashesInTx: Fr[], plainNoteHash: Fr,firstNullifierInTx:Fr) {
    const noteIndex = await findNoteHashIndex(AztecWarpToad, noteHashesInTx, plainNoteHash,firstNullifierInTx)
    const uniqueNoteHash = await AztecWarpToad.methods.hash_unique_note_hash_helper(AztecWarpToad.address,plainNoteHash,firstNullifierInTx,noteIndex).simulate()
    return uniqueNoteHash
}

function hashCommitment(nullifier_preimg: bigint, secret: bigint, destination_chain_id: bigint, amount: bigint) {
    let pre_commitment: bigint = poseidon3([nullifier_preimg, secret, destination_chain_id]);
    let commitment: bigint = poseidon2([amount, pre_commitment]);
    return ethers.toBeHex(commitment)
}


//------------------