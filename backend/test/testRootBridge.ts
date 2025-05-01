// Deploy L1 contract on sandbox's anvil.
// Deploy L2 contract on sanbox's aztec
// Test L1 -> L2 message
// Test L2 -> L1 message
//
// Anvil default port is 8545
//https://github.com/AztecProtocol/aztec-packages/blob/master/l1-contracts/test/Inbox.t.sol

//@ts-ignore
import hre from "hardhat"

//@ts-ignore
import { IMT } from "@zk-kit/imt"

//@ts-ignore
import { poseidon2 } from "poseidon-lite"

//@ts-ignore
import { GigaRootBridge, L1AztecRootBridgeAdapter } from "../typechain-types"

//@ts-ignore
import { expect } from "chai";

//@ts-ignore
import { sha256ToField } from '@aztec/foundation/crypto';

//@ts-ignore
import { computeSecretHash, EthAddress, createPXEClient, waitForPXE, AztecAddress, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

//@ts-ignore
import { L2AztecRootBridgeAdapterContractArtifact, L2AztecRootBridgeAdapterContract } from '../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter'

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

describe("GigaRootBridge core", function () {
	async function deploy() {

		// L1AztecRootBridgeAdapter (L1) deployment
		hre.ethers.getContractFactory("L1AztecRootBridgeAdapter",);
		const L1AztecRootBridgeAdapter = await hre.ethers.deployContract("L1AztecRootBridgeAdapter", [],);

		// L2AztecRootBridgeAdapter (L2) deployment
		const { wallets, PXE } = await connectPXE();
		const deployerWallet = wallets[0]
		const constructorArgs = [EthAddress.fromString(L1AztecRootBridgeAdapter.target)];
		const nodeInfo = (await PXE.getNodeInfo());

		// This is also the "registry"
		const L2AztecRootBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecRootBridgeAdapterContractArtifact, constructorArgs).send().deployed();

		// initialize L1 L1AztecRootBridgeAdapter
		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
		const l2Bridge = L2AztecRootBridgeAdapter.address.toString();
		await L1AztecRootBridgeAdapter.initialize(registryAddress, l2Bridge);

		hre.ethers.getContractFactory("PoseidonT3",)
		const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
		const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
		hre.ethers.getContractFactory("GigaRootBridge",);
		const rootBridgeAdapterAddresses = [L1AztecRootBridgeAdapter.target];
		const GigaRootBridge = await hre.ethers.deployContract("GigaRootBridge", [rootBridgeAdapterAddresses, 2], {
			value: 0n,
			libraries: {
				LazyIMT: LazyIMTLib,
			}
		});

		return { GigaRootBridge, L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE }
	}

	describe("Deployment", function () {
		it("Should deploy and initialize", async function () {
			let { GigaRootBridge, L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deploy();

			expect(GigaRootBridge).not.equal(undefined);
			expect(L1AztecRootBridgeAdapter).not.equal(undefined);
			expect(L2AztecRootBridgeAdapter).not.equal(undefined);

			let gigaRoot = await GigaRootBridge.gigaRoot();
			expect(gigaRoot).to.equal(0n);
		});

		it("Should update the gigaRoot on L1", async function () {
			let { GigaRootBridge, L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deploy();

			// send local root L2 -> L1

			let l2Root = Fr.random();
			// the block number will increment by 1 as soon as the below function 
			// is called, so we have to do +1 if we want it to be the number of 
			// the block that the transaction is executing in
			let blockNumber = await PXE.getBlockNumber() + 1;
			let l2Bridge = AztecAddress.fromString(L2AztecRootBridgeAdapter.address.toString());
			let version = await L1AztecRootBridgeAdapter.rollupVersion();
			let l1PortalAddress = L1AztecRootBridgeAdapter.target;
			let l1ChainId = 31337n;


			const content = sha256ToField([
				l2Root.toBuffer(),
				new Fr(blockNumber).toBuffer(),
			]);

			// is l2ToL1Message
			const messageLeaf = sha256ToField([
				l2Bridge.toBuffer(),
				new Fr(version).toBuffer(),
				EthAddress.fromString(l1PortalAddress).toBuffer32() ?? Buffer.alloc(32, 0),
				new Fr(l1ChainId).toBuffer(),
				content.toBuffer(),
			]);

			let l2TxReceipt = await L2AztecRootBridgeAdapter.methods.send_root_to_l1(l2Root).send().wait();

			const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
				blockNumber,
				messageLeaf
			);

			const siblingPathArray = siblingPath.data.map(buffer =>
				'0x' + buffer.toString('hex')
			);

			let refreshRootTx = await L1AztecRootBridgeAdapter.refreshRoot(
				l2Root.toString(),
				BigInt(blockNumber),
				l2ToL1MessageIndex,
				siblingPathArray
			);

			const receipt = await refreshRootTx.wait(1);


			// Find the event in the logs
			const refreshRootEvent = receipt.logs.find(
				log => log.topics[0] === L1AztecRootBridgeAdapter.interface.getEvent("receivedNewL2Root").topicHash
			);

			// Parse the refreshRootEvent data
			const parsedrefreshRootEvent = L1AztecRootBridgeAdapter.interface.parseLog({
				topics: refreshRootEvent.topics,
				data: refreshRootEvent.data
			});

			const newL2Root = parsedrefreshRootEvent.args[0];

			expect(newL2Root).to.not.be.undefined;
			console.log("l2 root seen by l1: ", newL2Root);

			expect(newL2Root.toString()).to.equal(BigInt(l2Root.toString()));

			// call function to update gigaROot
			let gigaRootUpdateTx = await GigaRootBridge.updateRoot([L1AztecRootBridgeAdapter.target]);

			const gigaRootUpdateReceipt = await gigaRootUpdateTx.wait(1);

			// Find the event in the logs
			const event = gigaRootUpdateReceipt.logs.find(
				log => log.topics[0] === GigaRootBridge.interface.getEvent("constructedNewGigaRoot").topicHash
			);

			const parsedEvent = GigaRootBridge.interface.parseLog({
				topics: event.topics,
				data: event.data
			});

			const newGigaRoot = parsedEvent.args[0];

			// tree has depth 2 so the root should just be a hash of (newL2Root, 0)
			const newGigaRootCalculated = poseidon2([newL2Root, 0n]);
			console.log(
				"newGigaRoot ", newGigaRoot
			);
			console.log(
				"newGigaRootCalculated ", newGigaRoot
			);
			expect(newGigaRoot.toString()).to.equal(newGigaRootCalculated.toString());
		})
	})


})

/*
describe("RootBridgeAdapters (L1 <-> L2 message passing)", function () {
	async function deployAdapters() {

		// L1AztecRootBridgeAdapter (L1) deployment
		hre.ethers.getContractFactory("L1AztecRootBridgeAdapter",);
		const L1AztecRootBridgeAdapter = await hre.ethers.deployContract("L1AztecRootBridgeAdapter", [],);

		// L2AztecRootBridgeAdapter (L2) deployment
		const { wallets, PXE } = await connectPXE();
		const deployerWallet = wallets[0]
		const constructorArgs = [EthAddress.fromString(L1AztecRootBridgeAdapter.target)];
		const nodeInfo = (await PXE.getNodeInfo());

		// This is also the "registry"
		const L2AztecRootBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecRootBridgeAdapterContractArtifact, constructorArgs).send().deployed();

		// initialize L1 L1AztecRootBridgeAdapter
		// const registryAddress = hre.ethers.getAddress(nodeInfo.l1ContractAddresses.registryAddress);
		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
		const l2Bridge = L2AztecRootBridgeAdapter.address.toString();
		await L1AztecRootBridgeAdapter.initialize(registryAddress, l2Bridge);

		return { L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE }
	}

	describe("Deployment", function () {
		it("Should deploy and initialize", async function () {
			const { L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deployAdapters();
			expect(L1AztecRootBridgeAdapter).not.equal(undefined);
			expect(L2AztecRootBridgeAdapter).not.equal(undefined);

			// check to make sure L1AztecRootBridgeAdapter is initialized
			const l2_bridge = await L1AztecRootBridgeAdapter.l2Bridge();
			expect(l2_bridge).not.equal(undefined);
		});
	})

	describe("Send gigaroot L1 -> L2", function () {

		it("Should send the message from L1 and retrieve it on L2", async function () {

			const { L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deployAdapters();

			const fakeGigaRoot = Fr.random();
			const paddedFakeGigaRoot = hre.ethers.zeroPadValue(fakeGigaRoot.toString(), 32);
			console.log("fakeGigaRoot ", fakeGigaRoot);
			console.log("paddedFakeGigaRoot ", paddedFakeGigaRoot);

			// L1 txn to send gigaroot L1 -> L2
			const tx = await L1AztecRootBridgeAdapter.sendGigaRootToAdapter(paddedFakeGigaRoot);

			const receipt = await tx.wait(1);

			// Find the event in the logs
			const event = receipt.logs.find(
				log => log.topics[0] === L1AztecRootBridgeAdapter.interface.getEvent("newGigaRootSentToL2").topicHash
			);

			// Parse the event data
			const parsedEvent = L1AztecRootBridgeAdapter.interface.parseLog({
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
			console.log("Waiting 2 L2 blocks to make sure the message is included");
			console.log("Current L2 block: ", await PXE.getBlockNumber());
			await L2AztecRootBridgeAdapter.methods.count(0n).send().wait();
			await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();
			console.log("L2 block after waiting: ", await PXE.getBlockNumber());

			// New test logic
			await L2AztecRootBridgeAdapter.methods.update_gigaroot(fakeGigaRoot, index).send().wait();

			let newGigaRoot = await L2AztecRootBridgeAdapter.methods.get_giga_root().simulate();
			let newGigaRootField = new Fr(newGigaRoot);

			expect(newGigaRootField.toString()).to.equal(fakeGigaRoot.toString());
		})
	})
	describe("Send local root L2 -> L1", function () {
		it("Should send the message from L2 and retrieve it on L1", async function () {

			const { L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deployAdapters();
			let l2Root = Fr.random();
			// the block number will increment by 1 as soon as the below function 
			// is called, so we have to do +1 if we want it to be the number of 
			// the block that the transaction is executing in
			let blockNumber = await PXE.getBlockNumber() + 1;
			let messageLeaf = getMessageLeaf(l2Root, blockNumber, L1AztecRootBridgeAdapter, L2AztecRootBridgeAdapter, PXE);

			let l2TxReceipt = await L2AztecRootBridgeAdapter.methods.send_root_to_l1(l2Root).send().wait();

			const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
				blockNumber,
				messageLeaf
			);

			const siblingPathArray = siblingPath.data.map(buffer =>
				'0x' + buffer.toString('hex')
			);

			console.log("l2ToL1MessageIndex: ", l2ToL1MessageIndex);
			console.log("siblingPathArray: ", siblingPathArray);

			let tx = await L1AztecRootBridgeAdapter.refreshRoot(
				l2Root.toString(),
				BigInt(blockNumber),
				l2ToL1MessageIndex,
				siblingPathArray
			);

			const receipt = await tx.wait(1);

			console.log("txn done");

			// Find the event in the logs
			const event = receipt.logs.find(
				log => log.topics[0] === L1AztecRootBridgeAdapter.interface.getEvent("receivedNewL2Root").topicHash
			);

			// Parse the event data
			const parsedEvent = L1AztecRootBridgeAdapter.interface.parseLog({
				topics: event.topics,
				data: event.data
			});

			const newL2Root = parsedEvent.args[0];

			expect(newL2Root).to.not.be.undefined;
			console.log("l2 root seen by l1: ", newL2Root);

			expect(newL2Root.toString()).to.equal(BigInt(l2Root.toString()));

		})
	})

})
*/

