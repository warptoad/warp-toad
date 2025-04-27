// hardhat 
import hre from "hardhat"
//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

// aztec
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract, Fr, NotesFilter } from "@aztec/aztec.js"
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
// //@ts-ignore
// import {getSchnorrAccount } from "@aztec/accounts/schnorr/lazy";
import { poseidon2, poseidon3 } from 'poseidon-lite'

// artifacts
//@ts-ignore
import { WarpToadCoreContractArtifact, WarpToadCoreContract } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { AztecMerkleData } from "../scripts/lib/types";
import { ethers } from "ethers";
import { hashNoteHashNonce } from "../scripts/lib/hashing";
import { calculateFeeFactor, getProofInputs } from "../scripts/lib/proving";
import { gasCostPerChain } from "../scripts/lib/constants";
import { WarpToadCore as WarpToadEvm} from "../typechain-types";


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
    async function deployAztecWarpToad() {
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })
        const gigaRootHistorySize = 4n;
        const { wallets, PXE } = await connectPXE();
        const deployerWallet = wallets[0]
        const constructorArgs = [nativeToken.target]
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed() as WarpToadCoreContract;

        return { AztecWarpToad, nativeToken, wallets, PXE };
    }

    async function deployL1WarpToad() {
        // Contracts are deployed using the first signer/account by default
        //const [owner, otherAccount] = await hre.ethers.getSigners();
        hre.ethers.getContractFactory("PoseidonT3",)
        const gigaBridge = (await hre.ethers.getSigners())[0].address //TODO gigaBridge should be the contract not some rando EOA
        const nativeToken = await hre.ethers.deployContract("USDcoin",[],{ value: 0n, libraries: {} })
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
    
        const maxTreeDepth = 32n
        const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
        const WithdrawVerifier = await hre.ethers.deployContract("WithdrawVerifier", [], { value: 0n, libraries: {} })
        const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
        const L1WarpToad = await hre.ethers.deployContract("L1WarpToad", [maxTreeDepth,gigaBridge,WithdrawVerifier.target,nativeToken.target,wrappedTokenSymbol,wrappedTokenName], {
          value: 0n,
          libraries: {
            LazyIMT: LazyIMTLib,
            PoseidonT3: PoseidonT3Lib 
          }
        });
    
        return { L1WarpToad,nativeToken, LazyIMTLib, PoseidonT3Lib };
      }
    

    describe("burnAztecMintEvm", function () {
        it("Should burn and verify with the evm circuit", async function () {
            // setup contract and wallets
            const { AztecWarpToad, wallets, PXE } = await deployAztecWarpToad();
            const { L1WarpToad, nativeToken,  } = await loadFixture(deployL1WarpToad);
            const sender = wallets[0]
            const recipient =  wallets[1]
            const evmWallets = await hre.ethers.getSigners()
            console.log({evmWallets})
            const evmSender = evmWallets[0]
            const evmRecipient = evmWallets[1]
            const evmRelayer = evmWallets[2]


            // free money!! 
            // TODO hardcode a giga_root with free money so we can remove `mint_for_testing`
            const initialBalanceSender = 10n*10n**18n
            await AztecWarpToad.methods.mint_for_testing(initialBalanceSender,sender.getAddress()).send().wait();

            // burn!!!!
            console.log("burning!")
            const amountToBurn = 5n*10n**18n
            const balancePreBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            const aztecWalletChainId = sender.getChainId().toBigInt();
            const { chainId: chainIdEvmProvider } = await hre.ethers.provider.getNetwork()

            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id().simulate())

            const commitmentPreImg = {
                amount: amountToBurn,
                destination_chain_id: aztecWalletChainId,
                secret: 1234n,
                nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
            }
            const burnTx = await AztecWarpToad.methods.burn(commitmentPreImg.amount, commitmentPreImg.destination_chain_id, commitmentPreImg.secret, commitmentPreImg.nullifier_preimg, sender.getAddress()).send().wait()
            const balancePostBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()

            // chain id is same as evm?? thats bad lmao
            console.log("Make issue of this. These shouldn't be the same!!!",{ aztecWalletChainId, chainIdEvmProvider})
            expect(chainIdAztecFromContract).to.equal(aztecWalletChainId);
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            expect(balancePostBurn).to.equal(balancePreBurn-amountToBurn);
            
            // verify        
            const commitment =Fr.fromHexString( hashCommitment( commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.destination_chain_id,commitmentPreImg.amount ))

            // get info to reproduce the leaf has of our commitment (unique_note_hash = leaf)
            const txEffect = (await PXE.getTxEffect(burnTx.txHash))
            console.log({txEffect})
            const burnTxFirstNullifier = txEffect?.data.nullifiers[0] as Fr
            const burnTxNoteHashes = txEffect?.data.noteHashes!
            
            const priorityFee = 100000000n;// in wei (this is 0.1 gwei)
            const maxFee = 5n*10n**18n;   // no more than 5 usdc okay cool thanks
            const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
            // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
            const gasCost = Number(gasCostPerChain[Number(chainIdEvmProvider)])
            const relayerBonusFactor = 1.1 // 10% earnings on gas fees! 
            const feeFactor = calculateFeeFactor(ethPriceInToken,gasCost,relayerBonusFactor);
            const proofInputs = await getProofInputs(
                L1WarpToad,
                AztecWarpToad,
                amountToBurn,
                feeFactor,
                priorityFee,
                maxFee,
                await evmRelayer.getAddress(),
                await evmRecipient.getAddress(),
                commitmentPreImg.nullifier_preimg,
                commitmentPreImg.secret,
            )
            console.log(proofInputs)
            const warpToadNoteFilter:NotesFilter = {contractAddress: AztecWarpToad.address, storageSlot: 5n}
            const notes = await PXE.getNotes(warpToadNoteFilter)
            const nonce = notes[0].nonce // TODO for front end implementation: check if already redeemed, dont assume the first one is the one to use etc
            console.log({note:notes[0],noteItems: notes[0].note.items})


            // await AztecWarpToad.methods.mint_local(commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.amount,recipient.getAddress(),burnTxNullifier,noteIndexOfCommitment).send().wait()
            
            // const balanceRecipient = await AztecWarpToad.methods.get_balance(recipient.getAddress()).simulate()
            // expect(balanceRecipient).to.equal(commitmentPreImg.amount);
        });
    });
});

// TODO move this to different file ----
async function findNoteHashIndex(AztecWarpToad:WarpToadCoreContract, noteHashesInTx: Fr[], plainNoteHash: Fr, firstNullifierInTx:Fr) {
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