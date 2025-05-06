//TODO fix this or remove it

// // Deploy L1 contract on sandbox's anvil.
// // Deploy L2 contract on sanbox's aztec
// // Test L1 -> L2 message
// // Test L2 -> L1 message
// //
// // Anvil default port is 8545
// //https://github.com/AztecProtocol/aztec-packages/blob/master/l1-contracts/test/Inbox.t.sol

// const hre = require("hardhat"); // normal style import made red squiggles idk why this works
// import { ethers } from "ethers"

// //@ts-ignore
// import { IMT } from "@zk-kit/imt"

// import { poseidon2 } from "poseidon-lite"

// import { GigaBridge, L1AztecBridgeAdapter, USDcoin } from "../typechain-types"

// //@ts-ignore
// import { expect } from "chai";

// import { getAztecNoteHashTreeRoot } from "../scripts/lib/proving";

// //@ts-ignore
// import { sha256ToField } from '@aztec/foundation/crypto';

// //@ts-ignore
// import { computeSecretHash, EthAddress, createPXEClient, waitForPXE, AztecAddress, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"

// //@ts-ignore
// import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

// import { L2AztecBridgeAdapterContractArtifact, L2AztecBridgeAdapterContract } from '../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter'
// import { ContractTransactionResponse } from "ethers";

// //@ts-ignore
// import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

// const { PXE_URL = 'http://localhost:8080' } = process.env;


// async function connectPXE() {
// 	console.log("creating PXE client")
// 	const PXE = createPXEClient(PXE_URL);
// 	console.log("waiting on PXE client", PXE_URL)
// 	await waitForPXE(PXE);

// 	console.log("getting test accounts")
// 	const wallets = await getInitialTestAccountsWallets(PXE);
// 	return { wallets, PXE }
// }

// describe("GigaBridge core", function () {
// 	async function deployAztecWarpToad(nativeToken: USDcoin) {
// 		const { wallets, PXE } = await connectPXE();
// 		const deployerWallet = wallets[0]
// 		const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
// 		const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
// 		const decimals = 6n; // only 6 decimals what is this tether??

// 		const constructorArgs = [nativeToken.target,wrappedTokenName,wrappedTokenSymbol,decimals]
// 		const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
// 			.send()
// 			.deployed() as AztecWarpToadCore;

// 		return { AztecWarpToad, wallets, PXE, deployerWallet };
// 	}
// 	async function deploy() {

// 		// L1AztecBridgeAdapter (L1) deployment
// 		hre.ethers.getContractFactory("L1AztecBridgeAdapter",);
// 		const L1AztecBridgeAdapter = await hre.ethers.deployContract("L1AztecBridgeAdapter", [],);

// 		// L2AztecBridgeAdapter (L2) deployment
// 		const { wallets, PXE } = await connectPXE();
// 		const deployerWallet = wallets[0]
// 		const constructorArgs = [L1AztecBridgeAdapter.target];
// 		const nodeInfo = (await PXE.getNodeInfo());

// 		// This is also the "registry"
// 		const L2AztecBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecBridgeAdapterContractArtifact, constructorArgs).send().deployed();

// 		hre.ethers.getContractFactory("PoseidonT3",)
// 		const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
// 		const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })
// 		hre.ethers.getContractFactory("GigaBridge",);
// 		const gigaRootRecipients = [L1AztecBridgeAdapter.target]; //TODO add L1WarpToad
// 		const GigaBridge = await hre.ethers.deployContract("GigaBridge", [gigaRootRecipients, 2], {
// 			value: 0n,
// 			libraries: {
// 				LazyIMT: LazyIMTLib,
// 			}
// 		});

// 		// initialize L1 L1AztecBridgeAdapter
// 		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
// 		const l2Bridge = L2AztecBridgeAdapter.address.toString();
// 		console.log({initializeArgs: [registryAddress, l2Bridge, GigaBridge.target]})
// 		await L1AztecBridgeAdapter.initialize(registryAddress, l2Bridge, GigaBridge.target);
		
// 		//native token
// 		const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })
// 		// aztecWarptoad
// 		const { AztecWarpToad } = await deployAztecWarpToad(nativeToken)
// 		return { GigaBridge, L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE,AztecWarpToad }
// 	}

// 	describe("Deployment", function () {
// 		it("Should deploy and initialize", async function () {
// 			const { GigaBridge, L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE,AztecWarpToad } = await deploy();

// 			expect(GigaBridge).not.equal(undefined);
// 			expect(L1AztecBridgeAdapter).not.equal(undefined);
// 			expect(L2AztecBridgeAdapter).not.equal(undefined);

// 			const gigaRoot = await GigaBridge.gigaRoot();
// 			expect(gigaRoot).to.equal(0n);
// 		});

// 		it("Should get the local root from L2, update gigaRoot, then send it back to L2", async function () {
// 			const { GigaBridge, L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE, AztecWarpToad } = await deploy();
// 			// TODO use functions from backend/scripts/lib/bridging.ts instead
// 			// send local root L2 -> L1

// 			// block number before the transaction
// 			const blockNumber = await PXE.getBlockNumber();
// 			console.log("Block number before the transaction ", blockNumber);
// 			const l2Bridge = L2AztecBridgeAdapter.address;
// 			const version = await L1AztecBridgeAdapter.rollupVersion();
// 			const l1PortalAddress = L1AztecBridgeAdapter.target;
// 			const l1ChainId = 31337n;

// 			const l2Root = new Fr(await getAztecNoteHashTreeRoot(blockNumber));
// 			console.log("note hash tree root before transaction:", l2Root);

// 			const content = sha256ToField([
// 				l2Root.toBuffer(),
// 				new Fr(blockNumber).toBuffer(),
// 			]);

// 			// is l2ToL1Message
// 			const messageLeaf = sha256ToField([
// 				l2Bridge.toBuffer(),
// 				new Fr(version).toBuffer(),
// 				EthAddress.fromString(l1PortalAddress.toString()).toBuffer32() ?? Buffer.alloc(32, 0),
// 				new Fr(l1ChainId).toBuffer(),
// 				content.toBuffer(),
// 			]);

// 			const l2TxReceipt = await L2AztecBridgeAdapter.methods.send_root_to_l1(blockNumber).send().wait();
// 			const blockNumberAfterTxn = await PXE.getBlockNumber();
// 			console.log("block number after transaction: ", blockNumberAfterTxn);


// 			const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
// 				blockNumberAfterTxn,
// 				//@ts-ignore some bs where the Fr type that getL2ToL1MembershipWitness wants is different messageLeaf has
// 				messageLeaf
// 			);

// 			const siblingPathArray = siblingPath.toFields().map((f)=>f.toString())
// 			// using the data before the block / transaction was included because 
// 			const refreshRootTx = await L1AztecBridgeAdapter.getNewRootFromL2(
// 				l2Root.toString(),
// 				BigInt(blockNumber),
// 				l2ToL1MessageIndex,
// 				siblingPathArray
// 			);

// 			const receipt = await refreshRootTx.wait(1);


// 			// Find the event in the logs
// 			const refreshRootEvent = receipt.logs.find(
// 				(log: ethers.EventLog) => log.topics[0] === L1AztecBridgeAdapter.interface.getEvent("ReceivedNewL2Root").topicHash
// 			);

// 			// Parse the refreshRootEvent data
// 			const parsedrefreshRootEvent = L1AztecBridgeAdapter.interface.parseLog({
// 				topics: refreshRootEvent!.topics,
// 				data: refreshRootEvent!.data
// 			});

// 			const newL2Root = parsedrefreshRootEvent!.args[0];

// 			expect(newL2Root).to.not.be.undefined;
// 			console.log("l2 root seen by l1: ", newL2Root);

// 			expect(newL2Root.toString()).to.equal(BigInt(l2Root.toString()));

// 			// call function to update gigaROot
// 			const gigaRootUpdateTx = await GigaBridge.updateRoot([L1AztecBridgeAdapter.target]);

// 			const gigaRootUpdateReceipt = await gigaRootUpdateTx.wait(1);

// 			// Find the event in the logs
// 			const event = gigaRootUpdateReceipt.logs.find(
// 				(log: ethers.EventLog) => log.topics[0] === GigaBridge.interface.getEvent("constructedNewGigaRoot").topicHash
// 			);

// 			const parsedEvent = GigaBridge.interface.parseLog({
// 				topics: event!.topics,
// 				data: event!.data
// 			});

// 			const newGigaRoot = parsedEvent!.args[0];
			
// 			// TODO just reproduce the tree in js!
// 			// tree has depth 2 so the root should just be a hash of (newL2Root, 0)
// 			const newGigaRootCalculated = poseidon2([newL2Root, 0n]);
// 			console.log(
// 				"newGigaRoot ", newGigaRoot
// 			);
// 			console.log(
// 				"newGigaRootCalculated ", newGigaRoot
// 			);
// 			expect(newGigaRoot.toString()).to.equal(newGigaRootCalculated.toString());

// 			// make sure it's updated in the contract
// 			const gigaRootFromContract = await GigaBridge.gigaRoot();
// 			console.log("gigaRootFromContract ", gigaRootFromContract);
// 			expect(newGigaRoot.toString()).to.equal(gigaRootFromContract.toString());

// 			// sends the root to the L2AztecBridgeAdapter through the L1AztecBridgeAdapter
// 			const sendGigaRootTx = await GigaBridge.sendRoot([L1AztecBridgeAdapter.target]);
// 			const sendGigaRootReceipt = await sendGigaRootTx.wait(1);

// 			// Find the event in the logs
// 			const sendGigaRootEvent = sendGigaRootReceipt.logs.find(
// 				(log: ethers.EventLog) => log.topics[0] === L1AztecBridgeAdapter.interface.getEvent("NewGigaRootSentToL2").topicHash
// 			);

// 			// Parse the event data
// 			const parsedL1AdapterEvent = L1AztecBridgeAdapter.interface.parseLog({
// 				topics: sendGigaRootEvent!.topics,
// 				data: sendGigaRootEvent!.data
// 			});

// 			const content_hash = parsedL1AdapterEvent!.args[0];
// 			const key = parsedL1AdapterEvent!.args[1];
// 			const index = parsedL1AdapterEvent!.args[2];

// 			// call 2 unrelated functions on the l2 because of
// 			// https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
// 			console.log("Waiting 2 L2 blocks to make sure the message is included");
// 			console.log("Current L2 block: ", await PXE.getBlockNumber());
// 			await L2AztecBridgeAdapter.methods.count(0n).send().wait();
// 			await L2AztecBridgeAdapter.methods.count(4n).send().wait();
// 			console.log("L2 block after waiting: ", await PXE.getBlockNumber());

// 			// New test logic
// 			await L2AztecBridgeAdapter.methods.update_gigaroot(content_hash, index,AztecWarpToad.address).send().wait();

// 			const newGigaRootFromL2 = await AztecWarpToad.methods.get_giga_root().simulate();
// 			const newGigaRootField = new Fr(newGigaRootFromL2);

// 			expect(newGigaRootField.toString()).to.equal(BigInt(newGigaRoot.toString()));
// 		})
// 	})
// })

// /*
// describe("RootBridgeAdapters (L1 <-> L2 message passing)", function () {
// 	async function deployAdapters() {

// 		// L1AztecBridgeAdapter (L1) deployment
// 		hre.ethers.getContractFactory("L1AztecBridgeAdapter",);
// 		const L1AztecBridgeAdapter = await hre.ethers.deployContract("L1AztecBridgeAdapter", [],);

// 		// L2AztecBridgeAdapter (L2) deployment
// 		const { wallets, PXE } = await connectPXE();
// 		const deployerWallet = wallets[0]
// 		const constructorArgs = [EthAddress.fromString(L1AztecBridgeAdapter.target)];
// 		const nodeInfo = (await PXE.getNodeInfo());

// 		// This is also the "registry"
// 		const L2AztecBridgeAdapter = await Contract.deploy(deployerWallet, L2AztecBridgeAdapterContractArtifact, constructorArgs).send().deployed();

// 		// initialize L1 L1AztecBridgeAdapter
// 		// const registryAddress = hre.ethers.getAddress(nodeInfo.l1ContractAddresses.registryAddress);
// 		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
// 		const l2Bridge = L2AztecBridgeAdapter.address.toString();
// 		await L1AztecBridgeAdapter.initialize(registryAddress, l2Bridge);

// 		return { L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE }
// 	}

// 	describe("Deployment", function () {
// 		it("Should deploy and initialize", async function () {
// 			const { L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE } = await deployAdapters();
// 			expect(L1AztecBridgeAdapter).not.equal(undefined);
// 			expect(L2AztecBridgeAdapter).not.equal(undefined);

// 			// check to make sure L1AztecBridgeAdapter is initialized
// 			const l2_bridge = await L1AztecBridgeAdapter.l2Bridge();
// 			expect(l2_bridge).not.equal(undefined);
// 		});
// 	})

// 	describe("Send gigaroot L1 -> L2", function () {

// 		it("Should send the message from L1 and retrieve it on L2", async function () {

// 			const { L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE } = await deployAdapters();

// 			const fakeGigaRoot = Fr.random();
// 			const paddedFakeGigaRoot = hre.ethers.zeroPadValue(fakeGigaRoot.toString(), 32);
// 			console.log("fakeGigaRoot ", fakeGigaRoot);
// 			console.log("paddedFakeGigaRoot ", paddedFakeGigaRoot);

// 			// L1 txn to send gigaroot L1 -> L2
// 			const tx = await L1AztecBridgeAdapter.sendGigaRootToAdapter(paddedFakeGigaRoot);

// 			const receipt = await tx.wait(1);

// 			// Find the event in the logs
// 			const event = receipt.logs.find(
// 				log => log.topics[0] === L1AztecBridgeAdapter.interface.getEvent("NewGigaRootSentToL2").topicHash
// 			);

// 			// Parse the event data
// 			const parsedEvent = L1AztecBridgeAdapter.interface.parseLog({
// 				topics: event.topics,
// 				data: event.data
// 			});

// 			const content_hash = parsedEvent.args[0];
// 			const key = parsedEvent.args[1];
// 			const index = parsedEvent.args[2];

// 			expect(content_hash).to.not.be.undefined;
// 			console.log("content_hash: ", content_hash);

// 			expect(key).to.not.be.undefined;
// 			console.log("key:", key);

// 			expect(index).to.not.be.undefined;
// 			console.log("index:", index);


// 			// call 2 unrelated functions on the l2 because of
// 			// https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
// 			console.log("Waiting 2 L2 blocks to make sure the message is included");
// 			console.log("Current L2 block: ", await PXE.getBlockNumber());
// 			await L2AztecBridgeAdapter.methods.count(0n).send().wait();
// 			await L2AztecBridgeAdapter.methods.count(4n).send().wait();
// 			console.log("L2 block after waiting: ", await PXE.getBlockNumber());

// 			// New test logic
// 			await L2AztecBridgeAdapter.methods.update_gigaroot(fakeGigaRoot, index).send().wait();

// 			let newGigaRoot = await L2AztecBridgeAdapter.methods.get_giga_root().simulate();
// 			let newGigaRootField = new Fr(newGigaRoot);

// 			expect(newGigaRootField.toString()).to.equal(fakeGigaRoot.toString());
// 		})
// 	})
// 	describe("Send local root L2 -> L1", function () {
// 		it("Should send the message from L2 and retrieve it on L1", async function () {

// 			const { L1AztecBridgeAdapter, L2AztecBridgeAdapter, PXE } = await deployAdapters();
// 			let l2Root = Fr.random();
// 			// the block number will increment by 1 as soon as the below function 
// 			// is called, so we have to do +1 if we want it to be the number of 
// 			// the block that the transaction is executing in
// 			let blockNumber = await PXE.getBlockNumber() + 1;
// 			let l2Bridge = AztecAddress.fromString(L2AztecBridgeAdapter.address.toString());
// 			let version = await L1AztecBridgeAdapter.rollupVersion();
// 			let l1PortalAddress = L1AztecBridgeAdapter.target;
// 			let l1ChainId = 31337n;


// 			const content = sha256ToField([
// 				l2Root.toBuffer(),
// 				new Fr(blockNumber).toBuffer(),
// 			]);

// 			// is l2ToL1Message
// 			const messageLeaf = sha256ToField([
// 				l2Bridge.toBuffer(),
// 				new Fr(version).toBuffer(),
// 				EthAddress.fromString(l1PortalAddress).toBuffer32() ?? Buffer.alloc(32, 0),
// 				new Fr(l1ChainId).toBuffer(),
// 				content.toBuffer(),
// 			]);


// 			let l2TxReceipt = await L2AztecBridgeAdapter.methods.send_root_to_l1(l2Root).send().wait();

// 			const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
// 				blockNumber,
// 				messageLeaf
// 			);

// 			const siblingPathArray = siblingPath.data.map(buffer =>
// 				'0x' + buffer.toString('hex')
// 			);

// 			console.log("l2ToL1MessageIndex: ", l2ToL1MessageIndex);
// 			console.log("siblingPathArray: ", siblingPathArray);

// 			let tx = await L1AztecBridgeAdapter.refreshRoot(
// 				l2Root.toString(),
// 				BigInt(blockNumber),
// 				l2ToL1MessageIndex,
// 				siblingPathArray
// 			);

// 			const receipt = await tx.wait(1);

// 			console.log("txn done");

// 			// Find the event in the logs
// 			const event = receipt.logs.find(
// 				log => log.topics[0] === L1AztecBridgeAdapter.interface.getEvent("ReceivedNewL2Root").topicHash
// 			);

// 			// Parse the event data
// 			const parsedEvent = L1AztecBridgeAdapter.interface.parseLog({
// 				topics: event.topics,
// 				data: event.data
// 			});

// 			const newL2Root = parsedEvent.args[0];
// 			const newL2RootBlockNumber = parsedEvent.args[1];

// 			console.log("l2 root seen by l1: ", newL2Root);
// 			expect(newL2Root.toString()).to.equal(BigInt(l2Root.toString()));

// 			expect(newL2RootBlockNumber).to.equal(blockNumber);

// 		})

// 	})

// })

// */
