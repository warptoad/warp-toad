import hre from "hardhat"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

//@ts-ignore
import {  Fr} from '@aztec/aztec.js';

describe("L1WarpToad", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployWarpToad() {
    // Contracts are deployed using the first signer/account by default
    //const [owner, otherAccount] = await hre.ethers.getSigners();
    hre.ethers.getContractFactory("PoseidonT3",)
    const gigaBridge = "0x0000000000000000000000000000000000000000"
    const nativeToken = await hre.ethers.deployContract("USDcoin",[],{ value: 0n, libraries: {} })
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`

    const maxTreeDepth = 32n
    const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
    const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
    const L1WarpToad = await hre.ethers.deployContract("L1WarpToad", [maxTreeDepth,gigaBridge,nativeToken.target,wrappedTokenSymbol,wrappedTokenName], {
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
    it("Should burn", async function () {


      const { L1WarpToad, nativeToken } = await loadFixture(deployWarpToad);

      // free money!!
      const amount = 100n
      await nativeToken.getFreeShit(amount);
      await nativeToken.approve(L1WarpToad.target,amount);

      await L1WarpToad.wrap(amount)

      const rootPreBurn = await L1WarpToad.localRoot()
      const preCommitment1 = 1234n // TODO hash it!

      const burnTx1 = await L1WarpToad.burn(preCommitment1,amount/2n)

      const rootPostBurn = await L1WarpToad.localRoot()
      expect(rootPreBurn).not.equal(rootPostBurn);

      // again!!! rootPostBurn = leaf since tree is only one leaf :/
      const preCommitment2 = 5678n // TODO hash it!
      const burnTx2 = await L1WarpToad.burn(preCommitment2,amount/2n)
      const rootPostPostBurn = await L1WarpToad.localRoot()
      console.log({rootPostBurn, rootPreBurn, rootPostPostBurn})
      expect(rootPostBurn).not.equal(rootPostPostBurn);
    });
  });

  describe("Burn gas test", function () {
    it("Should burn a lott", async function () {
      // for gas test
      const { L1WarpToad, nativeToken } = await loadFixture(deployWarpToad);

      // free money!!
      const totalAmount = 100n
      await nativeToken.getFreeShit(totalAmount);
      await nativeToken.approve(L1WarpToad.target,totalAmount);

      await L1WarpToad.wrap(totalAmount)


      for (let index = 0n; index < totalAmount; index++) {
        const preCommitment = Fr.random().toBigInt()
        await L1WarpToad.burn(preCommitment,1n)
      }
    });
  });
});
