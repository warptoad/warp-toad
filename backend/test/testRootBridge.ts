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
import { GigaRootBridge, L1RootBridgeAdapter } from "../typechain-types"

//@ts-ignore
import { expect } from "chai";

//@ts-ignore
import { sha256ToField } from '@aztec/foundation/crypto';

//@ts-ignore
import { computeSecretHash, EthAddress, createPXEClient, waitForPXE, AztecAddress, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

//@ts-ignore
import { L2AztecRootBridgeAdapterArtifact, L2AztecRootBridgeAdapter } from '../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter'

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

describe("RootBridge", function () {
	async function deploy() {

		// L1RootBridgeAdapter (L1) deployment
		hre.ethers.getContractFactory("L1RootBridgeAdapter",);
		const L1RootBridgeAdapter = await hre.ethers.deployContract("L1RootBridgeAdapter", [],);

		// L2AztecRootBridgeAdapter (L2) deployment
		const { wallets, PXE } = await connectPXE();
		const deployerWallet = wallets[0]
		const constructorArgs = [EthAddress.fromString(L1RootBridgeAdapter.target)];
		const nodeInfo = (await PXE.getNodeInfo());

		// This is also the "registry"
		const L2AztecRootBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecRootBridgeAdapterArtifact, constructorArgs).send().deployed();

		// initialize L1 L1RootBridgeAdapter
		// const registryAddress = hre.ethers.getAddress(nodeInfo.l1ContractAddresses.registryAddress);
		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
		const l2Bridge = L2AztecRootBridgeAdapter.address.toString();
		await L1RootBridgeAdapter.initialize(registryAddress, l2Bridge);

		return { L1RootBridgeAdapter, L2AztecRootBridgeAdapter, PXE }
	}

	describe("Deployment", function () {
		it("Should deploy and initialize", async function () {
			const { L1RootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deploy();
			expect(L1RootBridgeAdapter).not.equal(undefined);
			expect(L2AztecRootBridgeAdapter).not.equal(undefined);

			// check to make sure L1RootBridgeAdapter is initialized
			const l2_bridge = await L1RootBridgeAdapter.l2Bridge();
			expect(l2_bridge).not.equal(undefined);
		});
	})

	describe("Send gigaroot L1 -> L2", function () {

		it("Should send the message from L1 and retrieve it on L2", async function () {

			const { L1RootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deploy();

			const fakeGigaRoot = Fr.random();
			const paddedFakeGigaRoot = hre.ethers.zeroPadValue(fakeGigaRoot.toString(), 32);
			console.log("fakeGigaRoot ", fakeGigaRoot);
			console.log("paddedFakeGigaRoot ", paddedFakeGigaRoot);

			// L1 txn to send gigaroot L1 -> L2
			const tx = await L1RootBridgeAdapter.sendGigaRootToL2(paddedFakeGigaRoot);

			const receipt = await tx.wait(1);

			// Find the event in the logs
			const event = receipt.logs.find(
				log => log.topics[0] === L1RootBridgeAdapter.interface.getEvent("newGigaRootSentToL2").topicHash
			);

			// Parse the event data
			const parsedEvent = L1RootBridgeAdapter.interface.parseLog({
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

			const { L1RootBridgeAdapter, L2AztecRootBridgeAdapter, PXE } = await deploy();
			let l2Bridge = AztecAddress.fromString(L2AztecRootBridgeAdapter.address.toString());
			console.log("l2Bridge: ", l2Bridge);
			let version = await L1RootBridgeAdapter.rollupVersion();
			console.log("version: ", version);
			let l1PortalAddress = L1RootBridgeAdapter.target;
			console.log("l1PortalAddress: ", l1PortalAddress);
			let l1ChainId = 31337n;
			console.log("l1Chainid: ", l1ChainId);


			let l2Root = Fr.random();
			console.log("l2Root ", l2Root);

			let convertedL2Bridge = l2Bridge.toBuffer();
			console.log("converted l2Bridge: ", convertedL2Bridge);
			let convertedVersion = new Fr(version).toBuffer();
			console.log("converted version: ", convertedVersion);
			let convertedL1PortalAddress = EthAddress.fromString(l1PortalAddress).toBuffer32() ?? Buffer.alloc(32, 0);
			console.log("converted l1PortalAddress: ", convertedL1PortalAddress);
			let convertedL1ChainId = new Fr(l1ChainId).toBuffer();
			console.log("convertedL1Chainid: ", convertedL1ChainId);
			let convertedL2Root = l2Root.toBuffer();
			console.log("convertedL2Root: ", convertedL2Root);


			const messageLeaf = sha256ToField([
				convertedL2Bridge,
				convertedVersion,
				convertedL1PortalAddress,
				convertedL1ChainId,
				convertedL2Root
			]);

			// is l2ToL1Message

			let l2TxReceipt = await L2AztecRootBridgeAdapter.methods.send_root_to_l1(l2Root).send().wait();
			console.log("send_root_to_l1 called in aztec block: ", l2TxReceipt.blockNumber);

			// public async getL2ToL1MessageLeaf(
			//   recipient: EthAddress,
			//   l2Bridge: AztecAddress,
			//
			// const leaf = sha256ToField([
			//   l2Bridge.toBuffer(),
			//   new Fr(version).toBuffer(), // aztec version
			//   EthAddress.fromString(this.portal.address).toBuffer32() ?? Buffer.alloc(32, 0),
			//   new Fr(this.publicClient.chain.id).toBuffer(), // chain id
			//   content.toBuffer(),
			// ]);

			console.log("Message leaf: ", messageLeaf);

			const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
				await PXE.getBlockNumber(),
				messageLeaf
			);

			const siblingPathArray = siblingPath.data.map(buffer =>
				'0x' + buffer.toString('hex')
			);

			console.log("l2ToL1MessageIndex: ", l2ToL1MessageIndex);
			console.log("siblingPathArray: ", siblingPathArray);

			let tx = await L1RootBridgeAdapter.refreshRoot(
				l2Root.toString(),
				BigInt(l2TxReceipt.blockNumber),
				l2ToL1MessageIndex,
				siblingPathArray
			);

			const receipt = await tx.wait(1);

			console.log("txn done");

			// Find the event in the logs
			const event = receipt.logs.find(
				log => log.topics[0] === L1RootBridgeAdapter.interface.getEvent("receivedNewL2Root").topicHash
			);

			// Parse the event data
			const parsedEvent = L1RootBridgeAdapter.interface.parseLog({
				topics: event.topics,
				data: event.data
			});

			const newL2Root = parsedEvent.args[0];

			expect(newL2Root).to.not.be.undefined;
			console.log("l2 root seen by l1: ", newL2Root);

			expect(newL2Root.toString()).to.equal(l2Root.toString());

			// 2 minute timeout because we were timing out with the default 40 seconds
		})
		//.timeout(120000);
	})

})
