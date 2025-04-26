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

import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

//@ts-ignore
import { RootBridgeContractArtifact, RootBridgeContract } from '../contracts/aztec/RootBridge/src/artifacts/RootBridge'

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

describe("AztecRootBridge", function () {
	async function deployAztecRootBridge() {

		// AztecRootBridge (L1) deployment
		hre.ethers.getContractFactory("AztecRootBridge",);
		const AztecRootBridge = await hre.ethers.deployContract("AztecRootBridge", [],);
		console.log("AztecRootBridge deployed on L1 to " + AztecRootBridge.target);
		const aztecRootBridgeInitializeArgs = ['address registry', 'bytes32 l2Bridge', 'uint32 aztecchainid'];

		// RootBridge (L2) deployment
		const { wallets, PXE } = await connectPXE();
		const deployerWallet = wallets[0]
		const constructorArgs = [AztecRootBridge.target];
		const nodeInfo = (await PXE.getNodeInfo());
		const registryAddress = nodeInfo.l1ContractAddresses.registryAddress;
		const aztecChainId = nodeInfo.chainId;

		const RootBridge = await Contract.deploy(deployerWallet, RootBridgeContractArtifact, constructorArgs).send().deployed();

		return { AztecRootBridge, RootBridge }
	}

	describe("Deployment", function () {
		it("Should deploy", async function () {
			const { AztecRootBridge, RootBridge } = await loadFixture(deployAztecRootBridge);
			expect(AztecRootBridge).not.equal(undefined);
			expect(RootBridge).not.equal(undefined);
		});
	})
})
