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
    const maxTreeDepth = 32n
    const PoseidonT3Lib = await ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
    const LeanIMTLib = await ethers.deployContract("LeanIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
    const WarpToadCore = await ethers.deployContract("WarpToadCore", [maxTreeDepth], {
      value: 0n,
      libraries: {
        LeanIMT: LeanIMTLib,
      }
    });

    return { WarpToadCore, LeanIMTLib, PoseidonT3Lib };
  }

  describe("Deployment", function () {
    it("Should deploy", async function () {
      const { WarpToadCore, LeanIMTLib, PoseidonT3Lib } = await loadFixture(deployWarpToad);

      expect(WarpToadCore).not.equal(undefined);
    });

  });

  describe("Burn", function () {
    it("Should burn", async function () {
      const { WarpToadCore } = await loadFixture(deployWarpToad);
      const rootPreBurn = await WarpToadCore.root()
      const burnTx1 = await WarpToadCore.burn(123n,123n)
      const rootPostBurn = await WarpToadCore.root()
      expect(rootPreBurn).not.equal(rootPostBurn);

      // again!!! rootPostBurn = leaf since tree is only one leaf :/
      const burnTx2 = await WarpToadCore.burn(213124n,213124n)
      const rootPostPostBurn = await WarpToadCore.root()
      console.log({rootPostBurn, rootPreBurn, rootPostPostBurn})
      expect(rootPostBurn).not.equal(rootPostPostBurn);
    });
  });
});
