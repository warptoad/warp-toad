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
import { calculateFeeFactor, createProof, generateNoirTest, getProofInputs } from "../scripts/lib/proving";
import { gasCostPerChain } from "../scripts/lib/constants";
import { WarpToadCore as WarpToadEvm} from "../typechain-types";

import os from 'os';

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
        const gigaBridge =  (await hre.ethers.getSigners())[0].address //TODO gigaBridge should be the contract not some rando EOA
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
            const evmRelayer = evmWallets[0]
            const evmSender = evmWallets[1]
            const evmRecipient = evmWallets[2]


            // free money!! 
            // TODO hardcode a giga_root with free money so we can remove `mint_for_testing`
            const initialBalanceSender = 10n*10n**18n
            await AztecWarpToad.methods.mint_for_testing(initialBalanceSender,sender.getAddress()).send().wait();

            // burn!!!!
            console.log("burning!")
            const amountToBurn1 = 5n*10n**18n
            const amountToBurn2 = 4n*10n**18n 
            const balancePreBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            const aztecWalletChainId = sender.getChainId().toBigInt();
            const { chainId: chainIdEvmProvider } = await hre.ethers.provider.getNetwork()

            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id().simulate())

            const commitmentPreImg1 = {
                amount: amountToBurn1,
                destination_chain_id: aztecWalletChainId,
                secret: 1234n,
                nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
            }

            const commitmentPreImg2 = {
                amount: amountToBurn2,
                destination_chain_id: aztecWalletChainId,
                secret: 12341111111n,
                nullifier_preimg: 432111111n, // Use Fr.random().toBigInt() in prod pls
            }
            const burnTx1 = await AztecWarpToad.methods.burn(commitmentPreImg1.amount, commitmentPreImg1.destination_chain_id, commitmentPreImg1.secret, commitmentPreImg1.nullifier_preimg, sender.getAddress()).send().wait()
            
            const burnTx2 = await AztecWarpToad.methods.burn(commitmentPreImg2.amount, commitmentPreImg2.destination_chain_id, commitmentPreImg2.secret, commitmentPreImg2.nullifier_preimg, sender.getAddress()).send().wait()
            const balancePostBurn = await AztecWarpToad.methods.get_balance(sender.getAddress()).simulate()
            // chain id is same as evm?? thats bad lmao
            console.log("Make issue of this. These shouldn't be the same!!!",{ aztecWalletChainId, chainIdEvmProvider})
            expect(chainIdAztecFromContract).to.equal(aztecWalletChainId);
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            expect(balancePostBurn).to.equal(balancePreBurn-amountToBurn1-amountToBurn2);
            
            const priorityFee = 100000000n;// in wei (this is 0.1 gwei)
            const maxFee = 5n*10n**18n;   // no more than 5 usdc okay cool thanks
            const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
            // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
            const gasCost = Number(gasCostPerChain[Number(chainIdEvmProvider)])
            const relayerBonusFactor = 1.1 // 10% earnings on gas fees! 
            const feeFactor = calculateFeeFactor(ethPriceInToken,gasCost,relayerBonusFactor);

            L1WarpToad.connect(evmRelayer)
            await L1WarpToad.receiveGigaRoot("0x69696969696969696969")
            await L1WarpToad.storeLocalRootInHistory()

            const proofInputs = await getProofInputs(
                L1WarpToad,
                AztecWarpToad,
                amountToBurn1,
                feeFactor,
                priorityFee,
                maxFee,
                await evmRelayer.getAddress(),
                await evmRecipient.getAddress(),
                commitmentPreImg1.nullifier_preimg,
                commitmentPreImg1.secret,
            )
            //await generateNoirTest(proofInputs);
            const proof = await createProof(proofInputs, os.cpus().length )

            

            console.warn("WARNING an EOA bridged the root. This shouldn't be allowed in prod. TODO")
            
            const balanceRecipientPreMint =await L1WarpToad.balanceOf(await evmRecipient.getAddress())
            const mintTx = await (await L1WarpToad.mint(
              ethers.toBigInt(proofInputs.nullifier),
              ethers.toBigInt(proofInputs.amount),
              ethers.toBigInt(proofInputs.giga_root),
              ethers.toBigInt(proofInputs.destination_local_root),
              ethers.toBigInt(proofInputs.fee_factor),
              ethers.toBigInt(proofInputs.priority_fee),
              ethers.toBigInt(proofInputs.max_fee),
              ethers.getAddress(proofInputs.relayer_address.toString()),
              ethers.getAddress(proofInputs.recipient_address.toString()),
              ethers.hexlify(proof.proof),
              {
                maxPriorityFeePerGas: ethers.toBigInt(proofInputs.priority_fee),
                maxFeePerGas: ethers.toBigInt(proofInputs.priority_fee)*100n //Otherwise HRE does the gas calculations wrong to make sure we don't get `max_priority_fee_per_gas` greater than `max_fee_per_gas
            }
            )).wait(1)
            const balanceRecipientPostMint = await L1WarpToad.balanceOf(await evmRecipient.getAddress())

            const expectedFee = BigInt(Number(mintTx!.fee) * ethPriceInToken * relayerBonusFactor)
            const feePaid = ethers.toBigInt(proofInputs.amount) - balanceRecipientPostMint-balanceRecipientPreMint
            const overPayPercentage = (1 - Number(expectedFee) / Number(feePaid)) * 100
            const marginOfErrorFee = 1 //no more than 1% off!
            expect(overPayPercentage).approximately(0,marginOfErrorFee, "This likely failed because HRE does something bad in gas calculation. Run it in something like an anvil node/aztecSandbox instead. Or gas usage changed") 
            expect(balanceRecipientPostMint).to.above(balanceRecipientPreMint + ethers.toBigInt(proofInputs.amount) - maxFee)
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