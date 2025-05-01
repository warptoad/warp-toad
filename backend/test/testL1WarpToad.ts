const hre = require("hardhat");

//@ts-ignore
import { expect } from "chai";
//@ts-ignore
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

//@ts-ignore
import {  Fr} from '@aztec/aztec.js';

//@ts-ignore
import { IMT } from "@zk-kit/imt"
import { poseidon2 } from "poseidon-lite"

import { MerkleTree, PartialMerkleTree, Element } from 'fixed-merkle-tree'
import { ethers } from "ethers";

import {hashPreCommitment, hashCommitment, hashNullifier} from "../scripts/lib/hashing"
import {calculateFeeFactor} from "../scripts/lib/proving"

import { getProofInputs, createProof } from "../scripts/lib/proving";
import { WarpToadCore as WarpToadEvm} from "../typechain-types";
import {gasCostPerChain} from "../scripts/lib/constants"

import os from 'os';
import { WarpToadCoreContract } from "../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";
import { poseidon3 } from "poseidon-lite/poseidon3";

describe("L1WarpToad", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployWarpToad() {
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

  describe("Deployment", function () {
    it("Should deploy", async function () {
      const { L1WarpToad, LazyIMTLib, PoseidonT3Lib } = await loadFixture(deployWarpToad);

      expect(L1WarpToad).not.equal(undefined);
    });

  });

  describe("Burn", function () {
    it("Should burn and mint on the same chain", async function () {
      // ---------------setup -----------------------------------
      const { L1WarpToad, nativeToken } = await loadFixture(deployWarpToad);

      // ------------free money!! -----------------------
      const amount1 = 50n*10n**18n; // 50 usdc
      const amount2 = 50n*10n**18n;
      const totalAmount = amount1 + amount2
      await nativeToken.getFreeShit(totalAmount);
      await nativeToken.approve(L1WarpToad.target,totalAmount);
      await L1WarpToad.wrap(totalAmount)

      // ------------------burn -------------------------------
      const nullifierPreimage1 = Fr.random().toBigInt() // TODO is this safe randomness???
      const nullifierPreimage2 = Fr.random().toBigInt() 
      const secret1 = Fr.random().toBigInt() 
      const secret2 = Fr.random().toBigInt() 
      const { chainId } = await hre.ethers.provider.getNetwork()
      const preCommitment1 = hashPreCommitment(nullifierPreimage1,secret1,chainId) 
      const preCommitment2 = hashPreCommitment(nullifierPreimage2,secret2,chainId) 
      const commitment1 = hashCommitment(preCommitment1, amount1)
      const commitment2 = hashCommitment(preCommitment2, amount2)
      // burn it
      const rootPreBurn = await L1WarpToad.localRoot()
      const burnTx1 = await L1WarpToad.burn(preCommitment1,amount1)
      const rootPostBurn = await L1WarpToad.localRoot()
      expect(rootPreBurn).not.equal(rootPostBurn);
      // burn it again!
      const burnTx2 = await L1WarpToad.burn(preCommitment2,amount2)
      const rootPostPostBurn = await L1WarpToad.localRoot()
      expect(rootPostBurn).not.equal(rootPostPostBurn);


      // ---------- local tree -------------
      // TODO test shit from proving.ts instead. and split up tree syncing logic as well
      const treeDepth = Number(await L1WarpToad.maxTreeDepth())
      //@ts-ignore
      const hashFunc = (left,right) => poseidon2([left, right])
      //@ts-ignore
      const tornadoTree = new MerkleTree(treeDepth, [commitment1,commitment2],{hashFunction:hashFunc})
      expect(tornadoTree.root).to.equal(rootPostPostBurn)


      // --------------bridge root -----------------------------------------------------------
      const gigaRoot = await L1WarpToad.gigaRoot()
      const localRoot = await L1WarpToad.localRoot()
      await L1WarpToad.storeLocalRootInHistory(); // TODO make relayer do this and get a root from history instead
      await L1WarpToad.receiveGigaRoot(gigaRoot); // TODO this is not how it is supposed to work. GigaBridge should do this


      // -------------inputs -------------------------------------------------
      const recipient = ethers.getAddress("0x1234000000000000000000000000000000005678")
      const relayer = ethers.getAddress("0x5678000000000000000000000000000000009123"); // TODO
      const priorityFee = 100000000n;// in wei (this is 0.1 gwei)
      const maxFee = 5n*10n**18n;   // no more than 5 usdc okay cool thanks
      const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
      // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
      const gasCost = Number(gasCostPerChain[Number(chainId)])
      const relayerBonusFactor = 1.1 // 10% earnings on gas fees! 
      const feeFactor = calculateFeeFactor(ethPriceInToken,gasCost,relayerBonusFactor);

     
      // -------------check public inputs-----------------
      const proofInputs = await getProofInputs(L1WarpToad,L1WarpToad,amount1,feeFactor,priorityFee,maxFee,relayer,recipient,nullifierPreimage1,secret1)
      const proof = await createProof(proofInputs,os.cpus().length ); // TODO
      const onchainFormattedPublicInputs:string[] = (await L1WarpToad._formatPublicInputs(
        ethers.toBigInt(proofInputs.nullifier),
        chainId,
        ethers.toBigInt(proofInputs.amount),
        ethers.toBigInt(proofInputs.giga_root),
        ethers.toBigInt(proofInputs.destination_local_root),
        ethers.toBigInt(proofInputs.fee_factor),
        ethers.toBigInt(proofInputs.priority_fee),
        ethers.toBigInt(proofInputs.max_fee),
        ethers.getAddress(proofInputs.relayer_address.toString()),
        ethers.getAddress(proofInputs.recipient_address.toString()),
      )).map((i:ethers.BytesLike)=>i.toString())

      expect(proof.publicInputs ).to.deep.equal(onchainFormattedPublicInputs)
      console.log({proof},onchainFormattedPublicInputs)
      
      // ------------- mint -------------------------
      const balanceRecipientPreMint =await L1WarpToad.balanceOf(recipient)
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
      const balanceRecipientPostMint = await L1WarpToad.balanceOf(recipient)
  
      // debug info
      const expectedFee = BigInt(Number(mintTx!.fee) * ethPriceInToken * relayerBonusFactor)
      const feePaid = ethers.toBigInt(proofInputs.amount) - balanceRecipientPostMint-balanceRecipientPreMint
      const overPayPercentage = (1 - Number(expectedFee) / Number(feePaid)) * 100
      const marginOfErrorFee = 1 //no more than 1% off!
      expect(overPayPercentage).approximately(0,marginOfErrorFee, "This likely failed because HRE does something bad in gas calculation. Run it in something like an anvil node/aztecSandbox instead. Or gas usage changed") 
      expect(balanceRecipientPostMint).to.above(balanceRecipientPreMint + ethers.toBigInt(proofInputs.amount) - maxFee)
    });
  });
});
