"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// hardhat 
const hre = require("hardhat");
//@ts-ignore
const chai_1 = require("chai");
// aztec
//@ts-ignore
const aztec_js_1 = require("@aztec/aztec.js");
//@ts-ignore
const testing_1 = require("@aztec/accounts/testing"); // idk why but node is bitching about this but bun doesnt care
// artifacts
//@ts-ignore
const WarpToadCore_1 = require("../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore");
const ethers_1 = require("ethers");
const hashing_1 = require("../scripts/lib/hashing");
const proving_1 = require("../scripts/lib/proving");
const constants_1 = require("../scripts/lib/constants");
const L2AztecBridgeAdapter_1 = require("../contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter");
const constants_2 = require("../scripts/lib/constants");
const bridging_1 = require("../scripts/lib/bridging");
async function connectPXE() {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    console.log("creating PXE client");
    const PXE = (0, aztec_js_1.createPXEClient)(PXE_URL);
    console.log("waiting on PXE client", PXE_URL);
    await (0, aztec_js_1.waitForPXE)(PXE);
    console.log("getting test accounts");
    const wallets = await (0, testing_1.getInitialTestAccountsWallets)(PXE);
    return { wallets, PXE };
}
describe("AztecWarpToad", function () {
    async function deployAztecWarpToad(nativeToken, deployerWallet) {
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`;
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`;
        const decimals = 6n; // only 6 decimals what is this tether??
        const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals];
        console.log("deploying aztec warptoad");
        const AztecWarpToad = await aztec_js_1.Contract.deploy(deployerWallet, WarpToadCore_1.WarpToadCoreContractArtifact, constructorArgs)
            .send()
            .deployed();
        console.log("done");
        return { AztecWarpToad };
    }
    async function deployL1Warptoad(nativeToken, LazyIMTLib, PoseidonT3Lib) {
        const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`;
        const wrappedTokenName = `wrpToad-${await nativeToken.name()}`;
        const maxEvmTreeDepth = constants_1.EVM_TREE_DEPTH;
        const WithdrawVerifier = await hre.ethers.deployContract("WithdrawVerifier", [], { value: 0n, libraries: {} });
        const L1WarpToad = await hre.ethers.deployContract("L1WarpToad", [maxEvmTreeDepth, WithdrawVerifier.target, nativeToken.target, wrappedTokenSymbol, wrappedTokenName], {
            value: 0n,
            libraries: {
                LazyIMT: LazyIMTLib,
                PoseidonT3: PoseidonT3Lib
            }
        });
        return { L1WarpToad, WithdrawVerifier };
    }
    async function deployL1GigaBridge(LazyIMTLib, gigaRootRecipients) {
        const gigaTreeDepth = constants_2.GIGA_TREE_DEPTH;
        const gigaBridge = await hre.ethers.deployContract("GigaBridge", [gigaRootRecipients, gigaTreeDepth], {
            value: 0n,
            libraries: {
                LazyIMT: LazyIMTLib,
            }
        });
        return { gigaBridge };
    }
    async function deployL2AztecBridgeAdapterContract(aztecDeployerWallet, constructorArgs) {
        return await aztec_js_1.Contract.deploy(aztecDeployerWallet, L2AztecBridgeAdapter_1.L2AztecBridgeAdapterContractArtifact, constructorArgs).send().deployed();
    }
    async function deploy() {
        const evmWallets = await hre.ethers.getSigners();
        const { PXE, wallets: aztecWallets } = await connectPXE();
        const aztecDeployerWallet = aztecWallets[0];
        // native token
        const nativeToken = await hre.ethers.deployContract("USDcoin", [], { value: 0n, libraries: {} });
        //---------------deploy the toads!!!!!!-----------------------
        // libs
        const PoseidonT3Lib = await hre.ethers.deployContract("PoseidonT3", [], { value: 0n, libraries: {} });
        const LazyIMTLib = await hre.ethers.deployContract("LazyIMT", [], { value: 0n, libraries: { PoseidonT3: PoseidonT3Lib } });
        //L1 warptoad 
        // also needs gigaBridgeProvider and L1BridgeAdapter (is just L1WarpToad)
        const { L1WarpToad, WithdrawVerifier } = await deployL1Warptoad(nativeToken, LazyIMTLib, PoseidonT3Lib);
        // Aztec warptoad
        const { AztecWarpToad } = await deployAztecWarpToad(nativeToken, aztecDeployerWallet);
        //-----------------------------------------------------------------------
        //-----------------------infra------------------------------------
        // L1 adapters
        const L1AztecBridgeAdapter = await hre.ethers.deployContract("L1AztecBridgeAdapter", []);
        // L1 GIGA!!!
        const gigaRootRecipients = [L1WarpToad.target, L1AztecBridgeAdapter.target];
        const { gigaBridge } = await deployL1GigaBridge(LazyIMTLib, gigaRootRecipients);
        // L2 adapters
        // aztec
        const constructorArgs = [L1AztecBridgeAdapter.target];
        const L2AztecBridgeAdapter = await deployL2AztecBridgeAdapterContract(aztecDeployerWallet, constructorArgs);
        //-------------------connect everything together!--------------------------------------
        // initialize
        // connect adapters
        const aztecNativeBridgeRegistryAddress = (await PXE.getNodeInfo()).l1ContractAddresses.registryAddress.toString();
        await L1AztecBridgeAdapter.initialize(aztecNativeBridgeRegistryAddress, L2AztecBridgeAdapter.address.toString(), gigaBridge.target);
        //connect toads
        await L1WarpToad.initialize(gigaBridge.target, L1WarpToad.target); // <- L1WarpToad is special because it's also it's own _l1BridgeAdapter (he i already on L1!)
        await AztecWarpToad.methods.initialize(L2AztecBridgeAdapter.address, L1AztecBridgeAdapter.target).send().wait(); // all other warptoad initializations will look like this
        return { L2AztecBridgeAdapter, L1AztecBridgeAdapter, gigaBridge, L1WarpToad: L1WarpToad, nativeToken: nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets, PXE };
    }
    // describe("deployment", function () {
    //     it("Should deploy warptoad for aztec and L1", async function () {
    //         const { L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets,L1AztecBridgeAdapter } = await deploy()
    //         //@TODO more things like this test!
    //         const aztecsL1Adapter = ethers.getAddress(ethers.toBeHex(( await AztecWarpToad.methods.get_l1_bridge_adapter().simulate()).inner)) // EthAddress type in noir is struct with .inner, which contains the address as a Field
    //         expect(aztecsL1Adapter).to.eq(L1AztecBridgeAdapter.target)
    //     })
    // })
    describe("burnAztecMintEvm", function () {
        it("Should burn and verify with the evm circuit", async function () {
            //----------------------setup--------------------------------
            // setup contract and wallets
            const { L2AztecBridgeAdapter, L1AztecBridgeAdapter, L1WarpToad, nativeToken, LazyIMTLib, PoseidonT3Lib, AztecWarpToad, aztecWallets, evmWallets, gigaBridge, PXE } = await deploy();
            const aztecDeployer = aztecWallets[0];
            const aztecSender = aztecWallets[1];
            const aztecRecipient = aztecWallets[2];
            const evmDeployer = evmWallets[0];
            const evmRelayer = evmWallets[1];
            const evmSender = evmWallets[2];
            const evmRecipient = evmWallets[3];
            const L1WarpToadWithSender = L1WarpToad.connect(evmSender);
            const provider = hre.ethers.provider;
            // free money!! 
            const initialBalanceSender = 10n * 10n ** 18n;
            const nativeTokenWithSender = nativeToken.connect(evmSender);
            const freeShitTx = await (await nativeTokenWithSender.getFreeShit(initialBalanceSender)).wait(1);
            // ------------------ burn -----------------------------------------
            console.log("burning!");
            const amountToBurn1 = 5n * 10n ** 18n;
            const amountToBurn2 = 4n * 10n ** 18n;
            const approvalTx = await (await nativeTokenWithSender.approve(L1WarpToadWithSender.target, initialBalanceSender * 2n)).wait(1);
            const balanceSenderNativeToken = await nativeTokenWithSender.balanceOf(evmSender);
            const wrapTx = await (await L1WarpToadWithSender.wrap(initialBalanceSender)).wait(1);
            const balancePreBurn = await L1WarpToadWithSender.balanceOf(evmSender.getAddress());
            const { chainId: chainIdEvmProvider } = await provider.getNetwork();
            const aztecVersion = (await PXE.getNodeInfo()).rollupVersion;
            const aztecVersionFromContract = await AztecWarpToad.methods.get_version().simulate();
            const chainIdAztecFromContract = hre.ethers.toBigInt(await AztecWarpToad.methods.get_chain_id_unconstrained(aztecVersion).simulate());
            const commitmentPreImg1 = {
                amount: amountToBurn1,
                destination_chain_id: chainIdAztecFromContract,
                secret: 1234n,
                nullifier_preimg: 4321n, // Use Fr.random().toBigInt() in prod pls
            };
            const commitmentPreImg2 = {
                amount: amountToBurn2,
                destination_chain_id: chainIdAztecFromContract,
                secret: 12341111111n,
                nullifier_preimg: 432111111n, // Use Fr.random().toBigInt() in prod pls
            };
            const preCommitment1 = (0, hashing_1.hashPreCommitment)(commitmentPreImg1.nullifier_preimg, commitmentPreImg1.secret, commitmentPreImg1.destination_chain_id);
            const preCommitment2 = (0, hashing_1.hashPreCommitment)(commitmentPreImg2.nullifier_preimg, commitmentPreImg2.secret, commitmentPreImg2.destination_chain_id);
            const burnTx1 = await (await L1WarpToadWithSender.burn(preCommitment1, commitmentPreImg1.amount)).wait(1);
            const balancePostBurn = await L1WarpToadWithSender.balanceOf(await evmSender.getAddress());
            //expect(chainIdEvmProvider).to.not.equal(chainIdAztecFromContract);
            (0, chai_1.expect)(balancePostBurn).to.equal(balancePreBurn - amountToBurn1);
            // relayer fee logic
            const priorityFee = 100000000n; // in wei (this is 0.1 gwei)
            const maxFee = 5n * 10n ** 18n; // i don't want to pay no more than 5 usdc okay cool thanks
            const ethPriceInToken = 1700.34; // how much tokens you need to buy 1 eth. In this case 1700 usdc tokens to buy 1 eth. Cheap!
            // L1 evm estimate. re-estimating this on every tx will require you to make a zk proof twice so i hardcoded. You should get a up to date value for L2's with alternative gas pricing from backend/scripts/dev_op/estimateGas.ts
            const gasCost = Number(constants_1.gasCostPerChain[Number(chainIdEvmProvider)]);
            const relayerBonusFactor = 1.1; // 10% earnings on gas fees! 
            const feeFactor = (0, proving_1.calculateFeeFactor)(ethPriceInToken, gasCost, relayerBonusFactor);
            L1WarpToad.connect(evmRelayer);
            // ------------------bridge------------------------------------
            console.log("bridge!");
            const localRootProviders = [L1WarpToad.target, L1AztecBridgeAdapter.target];
            const gigaRootRecipients = [L1WarpToad.target, L1AztecBridgeAdapter.target];
            const { refreshRootTx, PXE_L2Root, gigaRootUpdateTx } = await doFullBridgeAztec(PXE, L2AztecBridgeAdapter, L1AztecBridgeAdapter, provider, gigaBridge, AztecWarpToad, localRootProviders, gigaRootRecipients);
            // check bridgeNoteHashTreeRoot()
            const parsedRefreshRootEvent = (0, bridging_1.parseEventFromTx)(refreshRootTx, L1AztecBridgeAdapter, "ReceivedNewL2Root");
            const bridgedL2Root = parsedRefreshRootEvent.args[0];
            (0, chai_1.expect)(bridgedL2Root).to.not.be.undefined;
            (0, chai_1.expect)(bridgedL2Root.toString()).to.equal(BigInt(PXE_L2Root.toString()));
            // check updateGigaRoot
            const parsedGigaRootUpdateEvent = (0, bridging_1.parseEventFromTx)(gigaRootUpdateTx, gigaBridge, "ConstructedNewGigaRoot");
            const newGigaRootFromBridgeEvent = parsedGigaRootUpdateEvent.args[0];
            const gigaRootFromContract = await gigaBridge.gigaRoot();
            (0, chai_1.expect)(newGigaRootFromBridgeEvent.toString()).to.equal(gigaRootFromContract.toString());
            //check bridgeGigaRoot
            const newGigaRootFromL2 = await AztecWarpToad.methods.get_giga_root().simulate();
            const newGigaRootFromL1 = await gigaBridge.gigaRoot();
            (0, chai_1.expect)(newGigaRootFromL2.toString()).to.equal(BigInt(newGigaRootFromL1.toString()));
            // change the note hash tree root
            // bridge it again! but exclude aztecWarptoad as recipient of the gigaRoot (so i can see what happens if aztec is one gigaRoot behind)
            // await doFullBridgeAztec(        
            //     PXE,
            //     L2AztecBridgeAdapter,
            //     L1AztecBridgeAdapter,
            //     provider,
            //     gigaBridge,
            //     AztecWarpToad,
            //     localRootProviders,
            //     [L1AztecBridgeAdapter.target]
            // )
            // -------------mint-----------------------------------
            console.log("mint!");
            // const proofInputs = await getProofInputs(
            //     gigaBridge,
            //     L1WarpToad,
            //     L1WarpToadWithSender,
            //     amountToBurn1,
            //     feeFactor,
            //     priorityFee,
            //     maxFee,
            //     await evmRelayer.getAddress(),
            //     await evmRecipient.getAddress(),
            //     commitmentPreImg1.nullifier_preimg,
            //     commitmentPreImg1.secret,
            // )
            const commitment1 = (0, hashing_1.hashCommitment)(preCommitment1, commitmentPreImg1.amount);
            const aztecMerkleData1 = await (0, proving_1.getMerkleData)(gigaBridge, L1WarpToad, AztecWarpToad, commitment1);
            //await generateNoirTest(proofInputs);
            // const proof = await createProof(proofInputs, os.cpus().length)
            const balanceRecipientPreMint = await AztecWarpToad.methods.balance_of(await evmRecipient.getAddress()).simulate();
            const mintTx = await AztecWarpToad.methods.mint_giga_root_evm(commitmentPreImg1.amount, commitmentPreImg1.secret, commitmentPreImg1.nullifier_preimg, aztecRecipient.getAddress(), aztecMerkleData1.blockNumber, aztecMerkleData1.originLocalRoot, aztecMerkleData1.gigaMerkleData, // no way i am gonna spend time getting this type right >:(
            aztecMerkleData1.evmMerkleData).send().wait();
            // check mint tx
            const balanceRecipientPostMint = await AztecWarpToad.methods.balance_of(aztecRecipient.getAddress()).simulate();
            (0, chai_1.expect)(balanceRecipientPostMint).to.equal(balanceRecipientPreMint + ethers_1.ethers.toBigInt(commitmentPreImg1.amount));
            const burnTx2 = await (await L1WarpToadWithSender.burn(preCommitment2, commitmentPreImg2.amount)).wait(1);
            const commitment2 = (0, hashing_1.hashCommitment)(preCommitment2, commitmentPreImg2.amount);
            console.log({ gigaBridge, L1WarpToad, AztecWarpToad, commitment2 });
            await doFullBridgeAztec(PXE, L2AztecBridgeAdapter, L1AztecBridgeAdapter, provider, gigaBridge, AztecWarpToad, localRootProviders, gigaRootRecipients);
            const aztecMerkleData2 = await (0, proving_1.getMerkleData)(gigaBridge, L1WarpToad, AztecWarpToad, commitment2);
            // possible bugs. aztecMerkleData2 needs to be called after bridging. 
            // not waiting on tx to settle
            // the localRoot block number extracted from the gigaRoot event is wrong
            await AztecWarpToad.methods.mint_giga_root_evm(commitmentPreImg2.amount, commitmentPreImg2.secret, commitmentPreImg2.nullifier_preimg, aztecRecipient.getAddress(), aztecMerkleData2.blockNumber, aztecMerkleData2.originLocalRoot, aztecMerkleData2.gigaMerkleData, // no way i am gonna spend time getting this type right >:(
            aztecMerkleData2.evmMerkleData).send().wait();
            const balanceRecipientPostPostMint = await AztecWarpToad.methods.balance_of(aztecRecipient.getAddress()).simulate();
            console.log(balanceRecipientPostPostMint, balanceRecipientPostMint);
        });
    });
});
async function doFullBridgeAztec(PXE, L2AztecBridgeAdapter, L1AztecBridgeAdapter, provider, gigaBridge, AztecWarpToad, localRootProviders, gigaRootRecipients) {
    const { refreshRootTx, PXE_L2Root } = await (0, bridging_1.bridgeAZTECLocalRootToL1)(PXE, L2AztecBridgeAdapter, L1AztecBridgeAdapter, provider);
    const { gigaRootUpdateTx } = await (0, bridging_1.updateGigaRoot)(gigaBridge, localRootProviders);
    const { sendGigaRootTx } = await (0, bridging_1.sendGigaRoot)(gigaBridge, gigaRootRecipients, [] // there are no payable gigaRootRecipients
    );
    const { receiveGigaRootTx } = await (0, bridging_1.receiveGigaRootOnAztec)(L2AztecBridgeAdapter, L1AztecBridgeAdapter, AztecWarpToad, sendGigaRootTx, PXE, true);
    return { refreshRootTx, PXE_L2Root, gigaRootUpdateTx };
}
