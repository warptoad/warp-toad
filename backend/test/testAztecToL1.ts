// hardhat 
const hre = require("hardhat");
//@ts-ignore
import { expect } from "chai";
//@ts-ignore
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

// aztec
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr, NotesFilter, PXE, EthAddress } from "@aztec/aztec.js"
//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care
// //@ts-ignore
// import {getSchnorrAccount } from "@aztec/accounts/schnorr/lazy";
import { poseidon2, poseidon3 } from 'poseidon-lite'

// artifacts
//@ts-ignore
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { AztecMerkleData } from "../scripts/lib/types";
import { ethers } from "ethers";
import { hashNoteHashNonce } from "../scripts/lib/hashing";
import { calculateFeeFactor, createProof, generateNoirTest, getAztecNoteHashTreeRoot, getProofInputs } from "../scripts/lib/proving";
import { gasCostPerChain } from "../scripts/lib/constants";
import { WarpToadCore as WarpToadEvm, USDcoin, PoseidonT3, LazyIMT, L1AztecRootBridgeAdapter, GigaRootBridge } from "../typechain-types";

import { L2AztecRootBridgeAdapterContractArtifact, L2AztecRootBridgeAdapterContract } from '../contracts/aztec/L2AztecRootBridgeAdapter/src/artifacts/L2AztecRootBridgeAdapter'

import { GIGA_TREE_DEPTH } from "../scripts/lib/constants";

import os from 'os';

//@ts-ignore
import { sha256ToField } from "@aztec/foundation/crypto";

async function connectPXE() {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);

    console.log("getting test accounts")
    const wallets = await getInitialTestAccountsWallets(PXE);
    return { wallets, PXE }
}



describe("AztecWarpToad", function () {
    async function deployAztecWarpToad(nativeToken: USDcoin) {
        const { wallets, PXE } = await connectPXE();
        const deployerWallet = wallets[0]
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
        const decimals = 6n; // only 6 decimals what is this tether??

        const constructorArgs = [nativeToken.target,wrappedTokenName,wrappedTokenSymbol,decimals]
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed() as AztecWarpToadCore;

        return { AztecWarpToad, wallets, PXE, deployerWallet };
    }
    async function deployL1Warptoad(nativeToken: USDcoin, LazyIMTLib: LazyIMT, PoseidonT3Lib: PoseidonT3) {
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`

        const maxEvmTreeDepth = 32n
        const WithdrawVerifier = await hre.ethers.deployContract("WithdrawVerifier", [], { value: 0n, libraries: {} })
        const L1WarpToad = await hre.ethers.deployContract("L1WarpToad", [maxEvmTreeDepth, WithdrawVerifier.target, nativeToken.target, wrappedTokenSymbol, wrappedTokenName], {
            value: 0n,
            libraries: {
                LazyIMT: LazyIMTLib,
                PoseidonT3: PoseidonT3Lib
            }
        });
        return { L1WarpToad, WithdrawVerifier }
    }

    async function deployL1GigaBridge(LazyIMTLib: LazyIMT, gigaRootRecipients: ethers.AddressLike[]) {
        const gigaTreeDepth = GIGA_TREE_DEPTH
        const gigaBridge = await hre.ethers.deployContract("GigaRootBridge", [gigaRootRecipients, gigaTreeDepth], {
            value: 0n,
            libraries: {
                LazyIMT: LazyIMTLib,
            }
        });
        return { gigaBridge }

    }
    async function deploy() {
        const evmWallets = await hre.ethers.getSigners()

        // native token
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })

        // libs
        const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
        const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })

        //L1 warptoad
        const { L1WarpToad, WithdrawVerifier } = await deployL1Warptoad(nativeToken, LazyIMTLib, PoseidonT3Lib)

        // Aztec warptoad
        const { AztecWarpToad, wallets: aztecWallets, PXE, deployerWallet } = await deployAztecWarpToad(nativeToken)

        // L1 adapters
        const L1AztecRootBridgeAdapter = await hre.ethers.deployContract("L1AztecRootBridgeAdapter", [],);

        // L2 adapter
        const constructorArgs = [L1AztecRootBridgeAdapter.target];
        const L2AztecRootBridgeAdapter = await Contract.deploy(
            deployerWallet, L2AztecRootBridgeAdapterContractArtifact, constructorArgs
        ).send().deployed() as L2AztecRootBridgeAdapterContract;

        // L1 GIGA!!!
        const gigaRootRecipients: ethers.AddressLike[] = [L1WarpToad.target, L1AztecRootBridgeAdapter.target]
        const { gigaBridge } = await deployL1GigaBridge(LazyIMTLib, gigaRootRecipients)

        // initialize
        const registryAddress = (await PXE.getNodeInfo()).l1ContractAddresses.registryAddress.toString();
        await L1AztecRootBridgeAdapter.initialize(registryAddress, L2AztecRootBridgeAdapter.address.toString(), gigaBridge.target);
        await L1WarpToad.initialize(gigaBridge.target)//gigaBridge.target)
        //TODO aztecWarptoad needs to be aware of L2AztecRootBridgeAdapter

        return {L2AztecRootBridgeAdapter,L1AztecRootBridgeAdapter,gigaBridge, L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets, gigaBridge, PXE };
    }

    async function bridgeNoteHashTreeRoot(
        PXE:PXE,
        L2AztecRootBridgeAdapter:L2AztecRootBridgeAdapterContract, 
        L1AztecRootBridgeAdapter:L1AztecRootBridgeAdapter,
        L1WarpToad: WarpToadEvm,
        AztecWarpToad: AztecWarpToadCore,
        gigaBridge: GigaRootBridge,
        provider: ethers.Provider
    ) {
        const blockNumberOfRoot = await PXE.getBlockNumber();
        const PXE_L2Root = (await PXE.getBlock(blockNumberOfRoot))?.header.state.partial.noteHashTree.root as Fr 
        const sendRootToL1Tx = await L2AztecRootBridgeAdapter.methods.send_root_to_l1(blockNumberOfRoot).send().wait();

        const aztecChainVersion = await L1AztecRootBridgeAdapter.rollupVersion();
        const l1PortalAddress = L1AztecRootBridgeAdapter.target;
        const l1ChainId = (await provider.getNetwork()).chainId

        const blockNumberOfMemberWitness = sendRootToL1Tx.blockNumber as number //await PXE.getBlockNumber()
        const messageContent = sha256ToField([
            PXE_L2Root.toBuffer(),
            new Fr(blockNumberOfRoot).toBuffer(),
        ]);
        const l2Bridge = L2AztecRootBridgeAdapter.address;
        const messageLeaf = sha256ToField([
            l2Bridge.toBuffer(),
            new Fr(aztecChainVersion).toBuffer(),
            EthAddress.fromString(l1PortalAddress.toString()).toBuffer32() ?? Buffer.alloc(32, 0),
            new Fr(l1ChainId).toBuffer(),
            messageContent.toBuffer(),
        ]);

        const [l2ToL1MessageIndex, siblingPath] = await PXE.getL2ToL1MembershipWitness(
            blockNumberOfMemberWitness, //cant use blockNumberOfRoot since that one is too old. We need a block where the tx above happened
            //@ts-ignore some bs where the Fr type that getL2ToL1MembershipWitness wants is different messageLeaf has
            messageLeaf
        );
        const siblingPathArray = siblingPath.toFields().map((f)=>f.toString())

        const refreshRootTx = await (await L1AztecRootBridgeAdapter.getNewRootFromL2(
            PXE_L2Root.toString(),
            BigInt(blockNumberOfRoot),
            l2ToL1MessageIndex,
            siblingPathArray
        )).wait(1) as ethers.ContractTransactionReceipt;

        // Find the event in the logs
        const refreshRootEvent = refreshRootTx.logs.find(
            (log) => log.topics[0] === L1AztecRootBridgeAdapter.interface.getEvent("receivedNewL2Root").topicHash
        );

        // Parse the refreshRootEvent data
        const parsedRefreshRootEvent = L1AztecRootBridgeAdapter.interface.parseLog({
            topics: refreshRootEvent!.topics,
            data: refreshRootEvent!.data
        });
        const bridgedL2Root = parsedRefreshRootEvent!.args[0];
        expect(bridgedL2Root).to.not.be.undefined;
        expect(bridgedL2Root.toString()).to.equal(BigInt(PXE_L2Root.toString()));
        const gigaRootRecipients = [L1WarpToad.target, L1AztecRootBridgeAdapter.target]
        const gigaRootUpdateTx = await (await gigaBridge.updateRoot(
            gigaRootRecipients
        )).wait(1) as ethers.ContractTransactionReceipt;

        const gigaRootUpdateEvent = gigaRootUpdateTx.logs.find(
            (log) => log.topics[0] === gigaBridge.interface.getEvent("constructedNewGigaRoot").topicHash
        );
        // TODO make a function to do event parsing like this
        const parsedGigaRootUpdateEvent = gigaBridge.interface.parseLog({
            topics: gigaRootUpdateEvent!.topics,
            data: gigaRootUpdateEvent!.data
        });
        const newGigaRootFromBridgeEvent = parsedGigaRootUpdateEvent!.args[0];

        // todo check id tree reproduces by syncing events
        // TODO make sure the gigaBridge contract also emits events updatedLocalRoot(indexed index, localRoot)
        
        const gigaRootFromContract = await gigaBridge.gigaRoot();
		expect(newGigaRootFromBridgeEvent.toString()).to.equal(gigaRootFromContract.toString());

        // sends the root to the L2AztecRootBridgeAdapter through the L1AztecRootBridgeAdapter
        const sendGigaRootTx =await (await gigaBridge.sendRoot(
            gigaRootRecipients
        )
        ).wait(1) as ethers.ContractTransactionReceipt;


        // Find the event in the logs
        const sendGigaRootEvent = sendGigaRootTx.logs.find(
            (log) => log.topics[0] === L1AztecRootBridgeAdapter.interface.getEvent("newGigaRootSentToL2").topicHash
        );

        
        // Parse the event data
        const parsedL1AdapterEvent = L1AztecRootBridgeAdapter.interface.parseLog({
            topics: sendGigaRootEvent!.topics,
            data: sendGigaRootEvent!.data
        });

        const content_hash = parsedL1AdapterEvent!.args[0];
        console.log({content_hash, sendGigaRootEvent})
        const key = parsedL1AdapterEvent!.args[1];
        const index = parsedL1AdapterEvent!.args[2];

        // New test logic
        // some
        await L2AztecRootBridgeAdapter.methods.count(0n).send().wait();
        await L2AztecRootBridgeAdapter.methods.count(4n).send().wait();
        await L2AztecRootBridgeAdapter.methods.update_gigaroot(content_hash, index, AztecWarpToad.address).send().wait();

        const newGigaRootFromL2 = await AztecWarpToad.methods.get_giga_root().simulate();

        expect(newGigaRootFromL2.toString()).to.equal(BigInt(newGigaRootFromBridgeEvent.toString()))
    }


    describe("deployment", function () {
        it("Should deploy warptoad for aztec and L1", async function () {
            const { L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets } = await deploy()
        
        })

    })

        describe("burnAztecMintEvm", function () {
            it("Should burn and verify with the evm circuit", async function () {
                // setup contract and wallets
                const {L2AztecRootBridgeAdapter,L1AztecRootBridgeAdapter, L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets,gigaBridge,PXE } = await deploy()
                const aztecDeployer = aztecWallets[0]
                const aztecSender = aztecWallets[1]
                const aztecRecipient =  aztecWallets[2]
                const evmDeployer = evmWallets[0]
                const evmRelayer = evmWallets[1]
                const evmSender = evmWallets[2]
                const evmRecipient = evmWallets[3]
                
                const AztecWarpToadWithSender = AztecWarpToad.withWallet(aztecSender)
                const provider = hre.ethers.provider
                // free money!! 
                // TODO hardcode a giga_root with free money so we can remove `mint_for_testing`
                const initialBalanceSender = 10n*10n**18n
                await AztecWarpToadWithSender.methods.mint_for_testing(initialBalanceSender,aztecSender.getAddress()).send().wait();

                // burn!!!!
                console.log("burning!")
                const amountToBurn1 = 5n*10n**18n
                const amountToBurn2 = 4n*10n**18n 
                const balancePreBurn = await AztecWarpToadWithSender.methods.balance_of(aztecSender.getAddress()).simulate()
                const aztecWalletChainId = aztecSender.getChainId().toBigInt();
                const { chainId: chainIdEvmProvider } = await hre.ethers.provider.getNetwork()

                const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToadWithSender.methods.get_chain_id().simulate())

                const commitmentPreImg1 = {
                    amount: amountToBurn1,
                    destination_chain_id: aztecWalletChainId,
                    secret: 1234n,
                    nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
                }

                const commitmentPreImg2 = {
                    amount: amountToBurn2,
                    destination_chain_id: aztecWalletChainId,
                    secret: 12341111111n,
                    nullifier_preimg: 432111111n, // Use Fr.random().toBigInt() in prod pls
                }
                const burnTx1 = await AztecWarpToadWithSender.methods.burn(commitmentPreImg1.amount, commitmentPreImg1.destination_chain_id, commitmentPreImg1.secret, commitmentPreImg1.nullifier_preimg).send().wait()

                const burnTx2 = await AztecWarpToadWithSender.methods.burn(commitmentPreImg2.amount, commitmentPreImg2.destination_chain_id, commitmentPreImg2.secret, commitmentPreImg2.nullifier_preimg).send().wait()
                const balancePostBurn = await AztecWarpToadWithSender.methods.balance_of(aztecSender.getAddress()).simulate()
                // chain id is same as evm?? thats bad lmao
                console.log("Make issue of this. These shouldn't be the same!!!",{ aztecWalletChainId, chainIdEvmProvider})
                expect(chainIdAztecFromContract).to.equal(aztecWalletChainId);
                //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
                expect(balancePostBurn).to.equal(balancePreBurn-amountToBurn1-amountToBurn2);

                const priorityFee = 100000000n;// in wei (this is 0.1 gwei)
                const maxFee = 5n*10n**18n;   // no more than 5 usdc okay cool thanks
                const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
                // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
                const gasCost = Number(gasCostPerChain[Number(chainIdEvmProvider)])
                const relayerBonusFactor = 1.1 // 10% earnings on gas fees! 
                const feeFactor = calculateFeeFactor(ethPriceInToken,gasCost,relayerBonusFactor);

                L1WarpToad.connect(evmRelayer)
                
                // bridge note_hash_root!!
                await L1WarpToad.storeLocalRootInHistory()
                await bridgeNoteHashTreeRoot(
                    PXE,
                    L2AztecRootBridgeAdapter, 
                    L1AztecRootBridgeAdapter,
                    L1WarpToad,
                    AztecWarpToad,
                    gigaBridge,
                    provider
                )
               

                const proofInputs = await getProofInputs(
                    L1WarpToad,
                    AztecWarpToadWithSender,
                    amountToBurn1,
                    feeFactor,
                    priorityFee,
                    maxFee,
                    await evmRelayer.getAddress(),
                    await evmRecipient.getAddress(),
                    commitmentPreImg1.nullifier_preimg,
                    commitmentPreImg1.secret,
                )
                //await generateNoirTest(proofInputs);
                const proof = await createProof(proofInputs, os.cpus().length )



                console.warn("WARNING an EOA bridged the root. This shouldn't be allowed in prod. TODO")

                const balanceRecipientPreMint =await L1WarpToad.balanceOf(await evmRecipient.getAddress())
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
                const balanceRecipientPostMint = await L1WarpToad.balanceOf(await evmRecipient.getAddress())

                const expectedFee = BigInt(Number(mintTx!.fee) * ethPriceInToken * relayerBonusFactor)
                const feePaid = ethers.toBigInt(proofInputs.amount) - balanceRecipientPostMint-balanceRecipientPreMint
                const overPayPercentage = (1 - Number(expectedFee) / Number(feePaid)) * 100
                const marginOfErrorFee = 1 //no more than 1% off!
                expect(overPayPercentage).approximately(0,marginOfErrorFee, "This likely failed because HRE does something bad in gas calculation. Run it in something like an anvil node/aztecSandbox instead. Or gas usage changed") 
                expect(balanceRecipientPostMint).to.above(balanceRecipientPreMint + ethers.toBigInt(proofInputs.amount) - maxFee)
            });
        });
    });
