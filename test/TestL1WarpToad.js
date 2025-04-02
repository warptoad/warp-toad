import hre from "hardhat"
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployWarpToad() {
    // Contracts are deployed using the first signer/account by default
    //const [owner, otherAccount] = await hre.ethers.getSigners();
    hre.ethers.getContractFactory("PoseidonT3",)
    const gigaBridge = "0x0000000000000000000000000000000000000000"
    const nativeToken = await ethers.deployContract("USDcoin",[],{ value: 0n, libraries: {} })
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`

    const maxTreeDepth = 32n
    const PoseidonT3Lib = await ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
    const LeanIMTLib = await ethers.deployContract("LeanIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
    const L1WarpToad = await ethers.deployContract("L1WarpToad", [maxTreeDepth,gigaBridge,nativeToken.target,wrappedTokenSymbol,wrappedTokenName], {
      value: 0n,
      libraries: {
        LeanIMT: LeanIMTLib,
        PoseidonT3: PoseidonT3Lib 
      }
    });

    return { L1WarpToad,nativeToken, LeanIMTLib, PoseidonT3Lib };
  }

  describe("Deployment", function () {
    it("Should deploy", async function () {
      const { L1WarpToad, LeanIMTLib, PoseidonT3Lib } = await loadFixture(deployWarpToad);

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

      const rootPreBurn = await L1WarpToad.root()
      const preCommitment1 = 1234n // TODO hash it!

      const burnTx1 = await L1WarpToad.burn(preCommitment1,amount/2n)

      const rootPostBurn = await L1WarpToad.root()
      expect(rootPreBurn).not.equal(rootPostBurn);

      // again!!! rootPostBurn = leaf since tree is only one leaf :/
      const preCommitment2 = 5678n // TODO hash it!
      const burnTx2 = await L1WarpToad.burn(preCommitment2,amount/2n)
      const rootPostPostBurn = await L1WarpToad.root()
      console.log({rootPostBurn, rootPreBurn, rootPostPostBurn})
      expect(rootPostBurn).not.equal(rootPostPostBurn);
    });
  });
});
