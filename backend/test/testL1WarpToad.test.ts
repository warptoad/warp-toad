//@ts-ignore
import {  Fr} from '@aztec/aztec.js';

//@ts-ignore
import { IMT } from "@zk-kit/imt"
import { poseidon2 } from "poseidon-lite"

import { MerkleTree, PartialMerkleTree, Element } from 'fixed-merkle-tree'
import { ethers , NonceManager} from "ethers";

import {hashPreCommitment, hashCommitment, hashNullifier} from "../scripts/lib/hashing.js"
import {calculateFeeFactor} from "../scripts/lib/proving.js"

import { getProofInputs, createProof } from "../scripts/lib/proving.js";
import { WarpToadCore as WarpToadEvm, USDcoin, WithdrawVerifier,L1WarpToad, LazyIMT } from "../typechain-types/index.js";


import os from 'os';

import USDcoinArtifacts from "../artifacts/contracts/evm/test/USDcoin.sol/USDcoin.json" with { type: 'json' };
import WithdrawVerifierArtifacts from "../artifacts/contracts/evm/WithdrawVerifier.sol/WithdrawVerifier.json" with { type: 'json' };
import L1WarpToadArtifacts from "../artifacts/contracts/evm/L1WarpToad.sol/L1WarpToad.json" with { type: 'json' };
// import LazyIMTArtifacts from "../artifacts/@zk-kit/lazy-imt.sol/LazyIMT.sol/LazyIMT.json" with { type: 'json' };
import LazyIMTArtifacts from "../../out/LazyIMT.sol/LazyIMT.json" with { type: 'json' };
import {deployPoseidon, deployArtifact} from "../scripts/dev_op/deployHelpers.js"
import { LazyIMT__factory } from '../typechain-types/factories/@zk-kit/lazy-imt.sol/LazyIMT__factory.js';

describe("L1WarpToad", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployWarpToad() {
    // Contracts are deployed using the first signer/account by default
    //const [owner, otherAccount] = await ethers.getSigners();
    const provider = new ethers.JsonRpcProvider("http:localhost:8545")
    const signer = new NonceManager(new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider)); // different key per test so they can run in parallel

    const gigaBridge = await signer.signer.getAddress() //TODO gigaBridge should be the contract not some rando EOA
    const nativeToken = (await deployArtifact(USDcoinArtifacts.abi, USDcoinArtifacts.bytecode, signer, [], {value:0n,libraries:{}})) as USDcoin
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`

    const maxTreeDepth = 32n
    const PoseidonT3LibAddress = await deployPoseidon(signer)
    const WithdrawVerifier = (await deployArtifact(WithdrawVerifierArtifacts.abi, WithdrawVerifierArtifacts.bytecode,signer,[],{value:0n,libraries:{}})) as WithdrawVerifier
    console.log("lazyImt time")
    // const lazyIMTfactory = ethers.ContractFactory.fromSolidity(LazyIMTArtifacts, signer)
    // const LazyIMTLib = await (await lazyIMTfactory.deploy(
    //   ...[],
    //   { value: 0n, libraries: { PoseidonT3: PoseidonT3LibAddress }})).waitForDeployment() as LazyIMT
    const LazyIMTLib:LazyIMT = (await deployArtifact(
      LazyIMTArtifacts.abi,
      LazyIMTArtifacts.bytecode.object,
      signer,
      [],
      { value: 0n, libraries: { PoseidonT3: PoseidonT3LibAddress }}
    )) as LazyIMT
    console.log("warptoad")
    const L1WarpToad = (await deployArtifact(
      L1WarpToadArtifacts.abi,
      L1WarpToadArtifacts.bytecode, 
      signer,
      [maxTreeDepth,gigaBridge,WithdrawVerifier.target,nativeToken.target,wrappedTokenSymbol,wrappedTokenName],
      {
        value: 0n,
        libraries: {
          LazyIMT: LazyIMTLib.target,
          PoseidonT3: PoseidonT3LibAddress 
        }
      }
    )) as L1WarpToad;

    return { L1WarpToad,nativeToken, LazyIMTLib, PoseidonT3LibAddress, signer };
  }

  describe("Deployment", function () {
    it("Should deploy", async function () {
      const { L1WarpToad, LazyIMTLib, PoseidonT3LibAddress } = await deployWarpToad();

      expect(L1WarpToad).not.toBe(undefined);
    });

  });

  // describe("Burn", function () {
  //   it("Should burn and mint on the same chain", async function () {


  //     const { L1WarpToad, nativeToken,signer } = await deployWarpToad();

  //     const nullifierPreimage1 = Fr.random().toBigInt() // TODO is this safe randomness???
  //     const nullifierPreimage2 = Fr.random().toBigInt() // TODO is this safe randomness???
  //     const secret1 = Fr.random().toBigInt() // TODO is this safe randomness???
  //     const secret2 = Fr.random().toBigInt() // TODO is this safe randomness???
      
  //     const amount1 = 50n*10n**18n; // 50 usdc
  //     const amount2 = 50n*10n**18n;
  //     const { chainId } = await signer.provider!.getNetwork()

  //     const preCommitment1 = hashPreCommitment(nullifierPreimage1,secret1,chainId) 
  //     const preCommitment2 = hashPreCommitment(nullifierPreimage2,secret2,chainId) 
  //     const commitment1 = hashCommitment(preCommitment1, amount1)
  //     const commitment2 = hashCommitment(preCommitment2, amount2)


  //     // free money!!
  //     const totalAmount = amount1 + amount2
  //     await nativeToken.getFreeShit(totalAmount);
  //     await nativeToken.approve(L1WarpToad.target,totalAmount);

  //     await L1WarpToad.wrap(totalAmount)

  //     // burn it
  //     const rootPreBurn = await L1WarpToad.localRoot()
  //     const burnTx1 = await L1WarpToad.burn(preCommitment1,amount1)
  //     const rootPostBurn = await L1WarpToad.localRoot()
  //     expect(rootPreBurn).not.toBe(rootPostBurn);

  //     // burn it again!
  //     const burnTx2 = await L1WarpToad.burn(preCommitment2,amount2)
  //     const rootPostPostBurn = await L1WarpToad.localRoot()
  //     expect(rootPostBurn).not.toBe(rootPostPostBurn);

  //     // package from zk-kit 
  //     // TODO make issue because doing a insert for every leaf sucks
  //     const treeDepth = Number(await L1WarpToad.maxTreeDepth())
  //     // const tree = new IMT(poseidon2, treeDepth, 0n, 2)
      
  //     // const jsRootPreInsert = tree.root
  //     // // TODO do event scanning instead of this silly shit
  //     // const commitment1 = poseidon2([preCommitment1, amount1])
  //     // const commitment2 = poseidon2([preCommitment2, amount2])
  //     // tree.insert(commitment1)
  //     // tree.insert(commitment2)
  //     // const jsRootPostPostBurn = tree.root

  //     // expect(jsRootPreInsert).to.equal(rootPreBurn);
  //     // expect(jsRootPostPostBurn).to.equal(rootPostPostBurn);

  //     // package from tornadocash (better than zk-kit still)
  //     //@ts-ignore
  //     const hashFunc = (left,right) => poseidon2([left, right])
  //     //@ts-ignore
  //     const tornadoTree = new MerkleTree(treeDepth, [commitment1,commitment2],{hashFunction:hashFunc})
  //     expect(tornadoTree.root).toBe(rootPostPostBurn)

  //     // mint!
  //     const recipient = ethers.getAddress("0x1234000000000000000000000000000000005678")
  //     const gigaRoot = await L1WarpToad.gigaRoot()
  //     const localRoot = await L1WarpToad.localRoot()
  //     await L1WarpToad.storeLocalRootInHistory(); // TODO make relayer do this and get a root from history instead
  //     await L1WarpToad.receiveGigaRoot(gigaRoot); // TODO this is not how it is supposed to work. GigaBridge should do this

  //     const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
  //     const gasCost = 400000 // TODO find real amount
  //     const relayerBonusFactor = 1.10 // 10% earnings on gas fees! 

  //     const nullifier1 = hashNullifier(nullifierPreimage1);// TODO
  //     const feeFactor = calculateFeeFactor(ethPriceInToken,gasCost,relayerBonusFactor);// TODO
  //     const priorityFee = 1000000000n;// in wei (this is 1 gwei)
  //     const maxFee = 5n*10n**18n;   // no more than 5 usdc okay cool thanks
  //     const relayer = ethers.getAddress("0x5678000000000000000000000000000000009123"); // TODO
  //     const proofInputs = await getProofInputs(L1WarpToad,L1WarpToad,amount1,feeFactor,priorityFee,maxFee,relayer,recipient,nullifierPreimage1,secret1)
  //     const proof = await createProof(proofInputs,os.cpus().length ); // TODO
  //     console.log({noirPubInputs: proof.publicInputs, len: proof.publicInputs.length})
  //     await L1WarpToad.mint(nullifier1,amount1,gigaRoot,localRoot,feeFactor,priorityFee,maxFee,relayer,recipient,ethers.hexlify(proof.proof))

  //   });
  // });

  // breaks sandbox but does work in
  // describe("Burn gas test", function () {
  //   it("Should burn a lott", async function () {
  //     // for gas test
  //     const { L1WarpToad, nativeToken } = await deployWarpToad();

  //     // free money!!
  //     const totalAmount = 5n
  //     await nativeToken.getFreeShit(totalAmount);
  //     await nativeToken.approve(L1WarpToad.target,totalAmount);

  //     await L1WarpToad.wrap(totalAmount)


  //     for (let index = 0n; index < totalAmount; index++) {
  //       const preCommitment = Fr.random().toBigInt()
  //       await L1WarpToad.burn(preCommitment,1n)
  //     }
  //   });
  // });
});
