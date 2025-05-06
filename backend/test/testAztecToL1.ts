// hardhat 
const hre = require("hardhat");
//@ts-ignore
import { expect } from "chai";
//@ts-ignore
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

// aztec
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact, loadContractArtifact, NoirCompiledContract, Fr, NotesFilter, PXE, EthAddress, Wallet as AztecWallet } from "@aztec/aztec.js"
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
import { EVM_TREE_DEPTH, gasCostPerChain } from "../scripts/lib/constants";
import { WarpToadCore as WarpToadEvm, USDcoin, PoseidonT3, LazyIMT, L1AztecBridgeAdapter, GigaBridge } from "../typechain-types";

import { L2AztecBridgeAdapterContractArtifact, L2AztecBridgeAdapterContract } from '../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter'

import { GIGA_TREE_DEPTH } from "../scripts/lib/constants";

import os from 'os';

//@ts-ignore
import { sha256ToField } from "@aztec/foundation/crypto";
import { sendGigaRoot, bridgeNoteHashTreeRoot, parseEventFromTx, updateGigaRoot, receiveGigaRootOnAztec } from "../scripts/lib/bridging";

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
    async function deployAztecWarpToad(nativeToken: USDcoin, deployerWallet:AztecWallet) {
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
        const decimals = 6n; // only 6 decimals what is this tether??

        const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals]
        const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed() as AztecWarpToadCore;

        return { AztecWarpToad};
    }
    async function deployL1Warptoad(nativeToken: USDcoin, LazyIMTLib: LazyIMT, PoseidonT3Lib: PoseidonT3) {
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`

        const maxEvmTreeDepth = EVM_TREE_DEPTH
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
        const gigaBridge = await hre.ethers.deployContract("GigaBridge", [gigaRootRecipients, gigaTreeDepth], {
            value: 0n,
            libraries: {
                LazyIMT: LazyIMTLib,
            }
        });
        return { gigaBridge }

    }

    async function deployL2AztecBridgeAdapterContract(aztecDeployerWallet:AztecWallet,constructorArgs:ethers.BytesLike[]):Promise<L2AztecBridgeAdapterContract> {
        return await Contract.deploy(aztecDeployerWallet, L2AztecBridgeAdapterContractArtifact, constructorArgs).send().deployed() as L2AztecBridgeAdapterContract;
        
    }
    async function deploy() {
        const evmWallets = await hre.ethers.getSigners()
        const {PXE, wallets: aztecWallets} = await connectPXE()
        const aztecDeployerWallet =  aztecWallets[0];

        // native token
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} })

        //---------------deploy the toads!!!!!!-----------------------
        // libs
        const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} })
        const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } })

        //L1 warptoad 
        // also needs gigaBridgeProvider and L1BridgeAdapter (is just L1WarpToad)
        const { L1WarpToad, WithdrawVerifier } = await deployL1Warptoad(nativeToken, LazyIMTLib, PoseidonT3Lib)

        // Aztec warptoad
        const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, aztecDeployerWallet)
        //-----------------------------------------------------------------------

        //-----------------------infra------------------------------------
        // L1 adapters
        const L1AztecBridgeAdapter = await hre.ethers.deployContract("L1AztecBridgeAdapter", [],);

        // L1 GIGA!!!
        const gigaRootRecipients: ethers.AddressLike[] = [L1WarpToad.target, L1AztecBridgeAdapter.target]
        const { gigaBridge } = await deployL1GigaBridge(LazyIMTLib, gigaRootRecipients)

               
        // L2 adapters
        // aztec
        const constructorArgs = [L1AztecBridgeAdapter.target];
        const L2AztecBridgeAdapter = await deployL2AztecBridgeAdapterContract(aztecDeployerWallet, constructorArgs)

 

        //-------------------connect everything together!--------------------------------------
        // initialize
        // connect adapters
        const aztecNativeBridgeRegistryAddress = (await PXE.getNodeInfo()).l1ContractAddresses.registryAddress.toString();
        await L1AztecBridgeAdapter.initialize(aztecNativeBridgeRegistryAddress, L2AztecBridgeAdapter.address.toString(), gigaBridge.target);
        
        //connect toads
        await L1WarpToad.initialize(gigaBridge.target, L1WarpToad.target) // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        await AztecWarpToad.methods.initialize(L2AztecBridgeAdapter.address, L1AztecBridgeAdapter.target).send().wait()// all other warptoad initializations will look like this

        return { L2AztecBridgeAdapter, L1AztecBridgeAdapter, gigaBridge, L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets, PXE };
    }

    describe("deployment", function () {
        it("Should deploy warptoad for aztec and L1", async function () {
            const { L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets,L1AztecBridgeAdapter } = await deploy()
            //@TODO more things like this test!
            const aztecsL1Adapter = ethers.getAddress(ethers.toBeHex(( await AztecWarpToad.methods.get_l1_bridge_adapter().simulate()).inner)) // EthAddress type in noir is struct with .inner, which contains the address as a Field
            expect(aztecsL1Adapter).to.eq(L1AztecBridgeAdapter.target)
        })

    })

    describe("burnAztecMintEvm", function () {
        it("Should burn and verify with the evm circuit", async function () {
            
            //----------------------setup--------------------------------
            // setup contract and wallets
            const { L2AztecBridgeAdapter, L1AztecBridgeAdapter, L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets, gigaBridge, PXE } = await deploy()
            const aztecDeployer = aztecWallets[0]
            const aztecSender = aztecWallets[1]
            const aztecRecipient = aztecWallets[2]
            const evmDeployer = evmWallets[0]
            const evmRelayer = evmWallets[1]
            const evmSender = evmWallets[2]
            const evmRecipient = evmWallets[3]

            const AztecWarpToadWithSender = AztecWarpToad.withWallet(aztecSender)
            const provider = hre.ethers.provider
            // free money!! 
            // TODO mint from USDcoin instead since that contract will not be in prod so we can then remove mint_for_testing
            const initialBalanceSender = 10n * 10n ** 18n
            await AztecWarpToadWithSender.methods.mint_for_testing(initialBalanceSender, aztecSender.getAddress()).send().wait();

            // ------------------ burn -----------------------------------------
            console.log("burning!")
            const amountToBurn1 = 5n * 10n ** 18n
            const amountToBurn2 = 4n * 10n ** 18n
            const balancePreBurn = await AztecWarpToadWithSender.methods.balance_of(aztecSender.getAddress()).simulate()
            const { chainId: chainIdEvmProvider } = await provider.getNetwork()

            const aztecVersion = (await PXE.getNodeInfo()).rollupVersion

            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToadWithSender.methods.get_chain_id_unconstrained(aztecVersion).simulate())

            const commitmentPreImg1 = {
                amount: amountToBurn1,
                destination_chain_id: chainIdEvmProvider,
                secret: 1234n,
                nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
            }

            const commitmentPreImg2 = {
                amount: amountToBurn2,
                destination_chain_id: chainIdEvmProvider,
                secret: 12341111111n,
                nullifier_preimg: 432111111n, // Use Fr.random().toBigInt() in prod pls
            }
            const burnTx1 = await AztecWarpToadWithSender.methods.burn(commitmentPreImg1.amount, commitmentPreImg1.destination_chain_id, commitmentPreImg1.secret, commitmentPreImg1.nullifier_preimg).send().wait()
            const balancePostBurn = await AztecWarpToadWithSender.methods.balance_of(aztecSender.getAddress()).simulate()
            // chain id is same as evm?? switch to context.version??
            //console.log("Make issue of this. These shouldn't be the same!!!", { aztecWalletChainId, chainIdEvmProvider })
            // its silly but aztec doesn't have a chainId (yet?) here is a issue i made on it: https://github.com/AztecProtocol/aztec-packages/issues/13961#issuecomment-2844691811
            // TLDR is that context.version is basically their chainId likely. But we cant just use it as is because it doesnt care about conflicting with existing chainIds and currently return 1 (the same as L1  🙃)
            expect(chainIdAztecFromContract).to.equal(chainIdAztecFromContract);
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            expect(balancePostBurn).to.equal(balancePreBurn - amountToBurn1);

            // relayer fee logic
            const priorityFee = 100000000n;// in wei (this is 0.1 gwei)
            const maxFee = 5n * 10n ** 18n;   // i don't want to pay no more than 5 usdc okay cool thanks
            const ethPriceInToken = 1700.34 // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
            // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
            const gasCost = Number(gasCostPerChain[Number(chainIdEvmProvider)])
            const relayerBonusFactor = 1.1 // 10% earnings on gas fees! 
            const feeFactor = calculateFeeFactor(ethPriceInToken, gasCost, relayerBonusFactor);

            L1WarpToad.connect(evmRelayer)

            // ------------------bridge------------------------------------
            console.log("bridge!")
            await L1WarpToad.storeLocalRootInHistory()
            const localRootProviders = [L1WarpToad.target, L1AztecBridgeAdapter.target]
            const gigaRootRecipients = [L1WarpToad.target, L1AztecBridgeAdapter.target]
            const {refreshRootTx, PXE_L2Root, gigaRootUpdateTx} = await doFullBridgeAztec(        
                PXE,
                L2AztecBridgeAdapter,
                L1AztecBridgeAdapter,
                provider,
                gigaBridge,
                AztecWarpToad,
                localRootProviders,
                gigaRootRecipients
            )
        
            // check bridgeNoteHashTreeRoot()
            const parsedRefreshRootEvent = parseEventFromTx(refreshRootTx, L1AztecBridgeAdapter, "ReceivedNewL2Root")
            const bridgedL2Root = parsedRefreshRootEvent!.args[0];
            expect(bridgedL2Root).to.not.be.undefined;
            expect(bridgedL2Root.toString()).to.equal(BigInt(PXE_L2Root.toString()));

            // check updateGigaRoot
            const parsedGigaRootUpdateEvent = parseEventFromTx(gigaRootUpdateTx,gigaBridge,"ConstructedNewGigaRoot")
            const newGigaRootFromBridgeEvent = parsedGigaRootUpdateEvent!.args[0];
            const gigaRootFromContract = await gigaBridge.gigaRoot();
            expect(newGigaRootFromBridgeEvent.toString()).to.equal(gigaRootFromContract.toString());


            //check bridgeGigaRoot
            const newGigaRootFromL2 = await AztecWarpToad.methods.get_giga_root().simulate();
            const newGigaRootFromL1 = await gigaBridge.gigaRoot();
            expect(newGigaRootFromL2.toString()).to.equal(BigInt(newGigaRootFromL1.toString()))


            // change the note hash tree root
            const burnTx2 = await AztecWarpToadWithSender.methods.burn(commitmentPreImg2.amount, commitmentPreImg2.destination_chain_id, commitmentPreImg2.secret, commitmentPreImg2.nullifier_preimg).send().wait()
            await L2AztecBridgeAdapter.methods.count(463n).send().wait()
            // bridge it again! but exclude aztecWarptoad as recipient of the gigaRoot (so i can see what happens if aztec is one gigaRoot behind)
            await doFullBridgeAztec(        
                PXE,
                L2AztecBridgeAdapter,
                L1AztecBridgeAdapter,
                provider,
                gigaBridge,
                AztecWarpToad,
                localRootProviders,
                [L1AztecBridgeAdapter.target]
            )
            

            // -------------mint-----------------------------------
            console.log("mint!")
            const proofInputs = await getProofInputs(
                gigaBridge,
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
            const proof = await createProof(proofInputs, os.cpus().length)

            const balanceRecipientPreMint = await L1WarpToad.balanceOf(await evmRecipient.getAddress())
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
                    maxFeePerGas: ethers.toBigInt(proofInputs.priority_fee) * 100n //Otherwise HRE does the gas calculations wrong to make sure we don't get `max_priority_fee_per_gas` greater than `max_fee_per_gas
                }
            )).wait(1)

            // check mint tx
            const balanceRecipientPostMint = await L1WarpToad.balanceOf(await evmRecipient.getAddress())
            const expectedFee = BigInt(Number(mintTx!.fee) * ethPriceInToken * relayerBonusFactor)
            const feePaid = ethers.toBigInt(proofInputs.amount) - balanceRecipientPostMint - balanceRecipientPreMint
            const overPayPercentage = (1 - Number(expectedFee) / Number(feePaid)) * 100
            const marginOfErrorFee = 5 //no more than 5% off!
            console.log({overPayPercentage})
            expect(overPayPercentage).approximately(0, marginOfErrorFee, "This likely failed because HRE does something bad in gas calculation. Run it in something like an anvil node/aztecSandbox instead. Or gas usage changed")
            expect(balanceRecipientPostMint).to.above(balanceRecipientPreMint + ethers.toBigInt(proofInputs.amount) - maxFee)
        });
    });
});


async function doFullBridgeAztec(        
    PXE: PXE,
    L2AztecBridgeAdapter: L2AztecBridgeAdapterContract,
    L1AztecBridgeAdapter: L1AztecBridgeAdapter,
    provider: ethers.Provider,
    gigaBridge: GigaBridge,
    AztecWarpToad: AztecWarpToadCore,
    localRootProviders: ethers.AddressLike[],
    gigaRootRecipients: ethers.AddressLike[],

) {
    const {refreshRootTx,PXE_L2Root} = await bridgeNoteHashTreeRoot(
        PXE,
        L2AztecBridgeAdapter,
        L1AztecBridgeAdapter,
        provider
    )

    const {gigaRootUpdateTx} = await updateGigaRoot(
        gigaBridge,
        localRootProviders,
    )
    const {sendGigaRootTx} = await sendGigaRoot(
        gigaBridge,
        gigaRootRecipients,
    )

    const {update_gigarootTx} = await receiveGigaRootOnAztec(
        L2AztecBridgeAdapter,
        L1AztecBridgeAdapter,
        AztecWarpToad,
        sendGigaRootTx,
        PXE,
        true
    )
    return  {refreshRootTx, PXE_L2Root,gigaRootUpdateTx}
    
}