// Deploy L1 contract on sandbox's anvil.
// Deploy L2 contract on sanbox's aztec
// Test L1 -> L2 message
// Test L2 -> L1 message
//
// Anvil default port is 8545
//https://github.com/AztecProtocol/aztec-packages/blob/master/l1-contracts/test/Inbox.t.sol

import hre from "hardhat"
import { GigaRootBridge, AztecRootBridge } from "../typechain-types"

//@ts-ignore
import { expect } from "chai";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

import { computeSecretHash, EthAddress, Fr, createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

//@ts-ignore
import { RootBridgeContractArtifact, RootBridgeContract } from '../contracts/aztec/RootBridge/src/artifacts/RootBridge'

const { PXE_URL = 'http://localhost:8080' } = process.env;

const AZTEC_CHAIN_ID = "31337";

async function connectPXE() {
	console.log("creating PXE client")
	const PXE = createPXEClient(PXE_URL);
	console.log("waiting on PXE client", PXE_URL)
	await waitForPXE(PXE);

	console.log("getting test accounts")
	const wallets = await getInitialTestAccountsWallets(PXE);
	return { wallets, PXE }
}

describe("RootBridge", function () {
	async function deployAztecRootBridge() {

		// AztecRootBridge (L1) deployment
		hre.ethers.getContractFactory("AztecRootBridge",);
		const AztecRootBridge = await hre.ethers.deployContract("AztecRootBridge", [],);
		console.log("AztecRootBridge deployed on L1 to " + AztecRootBridge.target);
		const aztecRootBridgeInitializeArgs = ['address registry', 'bytes32 l2Bridge', 'uint32 aztecchainid'];

		// RootBridge (L2) deployment
		const { wallets, PXE } = await connectPXE();
		const deployerWallet = wallets[0]
		const constructorArgs = [EthAddress.fromString(AztecRootBridge.target)];
		const nodeInfo = (await PXE.getNodeInfo());

		// This is also the "registry"
		const RootBridge = await Contract.deploy(deployerWallet, RootBridgeContractArtifact, constructorArgs).send().deployed();

		// initialize L1 AztecRootBridge
		// const registryAddress = hre.ethers.getAddress(nodeInfo.l1ContractAddresses.registryAddress);
		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
		const l2Bridge = RootBridge.address.toString();
		console.log("registryAddress: " + registryAddress + " type " + typeof registryAddress);
		console.log("l2Bridge: " + l2Bridge + " type " + typeof l2Bridge);
		await AztecRootBridge.initialize(registryAddress, l2Bridge);

		return { AztecRootBridge, RootBridge, PXE }
	}

	describe("Deployment", function () {
		it("Should deploy and initialize", async function () {
			const { AztecRootBridge, RootBridge, PXE } = await loadFixture(deployAztecRootBridge);
			expect(AztecRootBridge).not.equal(undefined);
			expect(RootBridge).not.equal(undefined);

			// check to make sure AztecRootBridge is initialized
			const l2_bridge = await AztecRootBridge.l2Bridge();
			expect(l2_bridge).not.equal(undefined);
		});
	})

	describe("Send gigaroot L1 -> L2", function () {

		it("Should send the message from L1 and retrieve it on L2", async function () {

			const { AztecRootBridge, RootBridge, PXE } = await loadFixture(deployAztecRootBridge);

			const secret = Fr.random();
			const secretHash = await computeSecretHash(secret);
			const paddedSecretHash = hre.ethers.zeroPadValue(secretHash.toString(), 32);
			console.log("secretHash: ", secretHash);

			const fakeGigaRoot = Fr.random();
			const paddedFakeGigaRoot = hre.ethers.zeroPadValue(fakeGigaRoot.toString(), 32);
			console.log("fakeGigaRoot ", fakeGigaRoot);
			console.log("paddedFakeGigaRoot ", paddedFakeGigaRoot);

			// L1 txn to send gigaroot L1 -> L2
			const tx = await AztecRootBridge.sendGigaRootToL2(paddedFakeGigaRoot, paddedSecretHash);

			const receipt = await tx.wait(1);

			// Find the event in the logs
			const event = receipt.logs.find(
				log => log.topics[0] === AztecRootBridge.interface.getEvent("newGigaRootSentToL2").topicHash
			);

			// Parse the event data
			const parsedEvent = AztecRootBridge.interface.parseLog({
				topics: event.topics,
				data: event.data
			});

			const content_hash = parsedEvent.args[0];
			const key = parsedEvent.args[1];
			const index = parsedEvent.args[2];

			expect(content_hash).to.not.be.undefined;
			console.log("content_hash: ", content_hash);

			expect(key).to.not.be.undefined;
			console.log("key:", key);

			expect(index).to.not.be.undefined;
			console.log("index:", index);


			// call 2 unrelated functions on the l2 because of
			// https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
			console.log("Current L2 block: ", await PXE.getBlockNumber());
			await RootBridge.methods.count(0n).send().wait();
			await RootBridge.methods.count(4n).send().wait();
			console.log("L2 block after waiting: ", await PXE.getBlockNumber());

			// New test logic
			await RootBridge.methods.update_gigaroot(fakeGigaRoot, index, secret).send().wait();

			let newGigaRoot = await RootBridge.methods.get_giga_root().simulate();
			let newGigaRootField = new Fr(newGigaRoot);

			expect(newGigaRootField.toString()).to.equal(fakeGigaRoot.toString());
		})
	})

	// describe("Send local root L2 -> L1", function () {
	// 	it("RootBridge on L2 should ")
	// })

})
