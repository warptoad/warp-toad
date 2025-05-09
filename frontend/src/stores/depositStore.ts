import { get, writable } from 'svelte/store';
import { ethers } from 'ethers';
import { EVM_CHAINS } from '../lib/networks/network';
import { evmWalletStore, aztecWalletStore, getTokenAddress, getTokenBalance } from './walletStore';
import { usdcAbi } from '../lib/tokens/usdcAbi';
import { abi as warptoadAbi } from '../artifacts/l1WarpToad';
import { AztecAddress, createAztecNodeClient, createPXEClient, Fr, waitForPXE } from '@aztec/aztec.js';
import { WarpToadCoreContractArtifact } from '../artifacts/WarpToadCore';
import { poseidon2, poseidon3 } from 'poseidon-lite';
import { getMerkleData } from "./utils/proving";
import { GigaRootBridge__factory, type L1WarpToad, } from '../../../backend/typechain-types'; //TODO remove hardcode and add cleaner logic after hackathon
import deployedEvmAddresses from "../../../backend/ignition/deployments/chain-31337/deployed_addresses.json"
import type { GigaRootBridge, WarpToadCore as WarpToadEvm } from "../../../backend/typechain-types";
import { WarpToadCoreContract as WarpToadAztec } from '../../../backend/contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
//obsidion remover:
import { Contract } from "@aztec/aztec.js";

//OBSIDION CONSTANTS

type ChainType = {
    type: "aztec" | "evm";
    chainId: string;
}

//TODO FUNCTION THAT PRIORITISES WALLET SELECTION AZTEC OR EVM

export type DepositData = {
    fromChain: ChainType;
    toChain: ChainType
    tokenName: string;
    tokenAmount: number;
    tokenBalance?: number;
    tokenDollarValue?: number;
    approved?: boolean;
    wrapped?: boolean;
}

export type CommitmentPreImg = {
    amount: bigint;
    destination_chain_id: bigint;
    secret: bigint;
    nullifier_preimg: bigint;
}

export type WarptoadNote = {
    preImg: CommitmentPreImg;
    commitment: bigint;
}

export const depositApplicationStore = writable<DepositData | undefined>(undefined);
export const commitmentPreImgStore = writable<CommitmentPreImg | undefined>(undefined);
export const warptoadNoteStore = writable<WarptoadNote | undefined>(undefined)

export const isEvmOrigin = writable(true);

//make it so that user can pick?

let unsubscribe: () => void = () => { };

isEvmOrigin.subscribe(($isEvmOrigin) => {
    // Unsubscribe from the previous subscription
    unsubscribe();

    if ($isEvmOrigin) {
        unsubscribe = evmWalletStore.subscribe(($evmWalletStore) => {
            if (!$evmWalletStore?.provider || !$evmWalletStore.currentNetwork.chainId) return;

            depositApplicationStore.update(current => ({
                ...(current ?? {
                    toChain: { type: "aztec", chainId: "0x0" },
                    tokenName: "USDC",
                    tokenAmount: 0,
                }),
                fromChain: {
                    type: "evm",
                    chainId: `0x${$evmWalletStore.currentNetwork.chainId.toString(16)}`,
                },
            }));
        });
    } else {
        unsubscribe = aztecWalletStore.subscribe(($aztecWalletStore) => {
            if (!$aztecWalletStore) return;

            depositApplicationStore.update(current => ({
                ...(current ?? {
                    toChain: { type: "evm", chainId: "0x14a34" },
                    tokenName: "USDC",
                    tokenAmount: 0,
                }),
                fromChain: {
                    type: "aztec",
                    chainId: "0x0",
                },
            }));
        });
    }
});

export function setChain(chain: { type: "aztec" | "evm"; chainId: string }, isFrom: boolean = true) {
    depositApplicationStore.update(current => {
        if (!current) return undefined;
        if (isFrom) {
            return {
                ...current,
                fromChain: chain,
            };

        } else {
            return {
                ...current,
                toChain: chain,
            };

        }
    });
}

export function swapChains() {
    depositApplicationStore.update(current => {
        if (!current) return undefined;
        return {
            ...current,
            fromChain: current.toChain,
            toChain: current.fromChain,
        };
    });
}


export function clearDepositState(){

    commitmentPreImgStore.set(undefined) 
    warptoadNoteStore.set(undefined)

}

export function pickToken(tokenName: string) {
    depositApplicationStore.update(current => {
        if (!current) return undefined;
        return {
            ...current,
            tokenName: tokenName
        };
    });
}

export function setDepositTokenAmount(amount: number) {
    depositApplicationStore.update(current => {
        if (!current) return undefined;
        return {
            ...current,
            tokenAmount: amount
        };
    });
}

export function toggleOrigin() {
    isEvmOrigin.update(v => !v);
}


export async function getSelectedTokenBalance(): Promise<number | undefined> {
    const depositData = get(depositApplicationStore);
    if (!depositData) return;

    const { fromChain, tokenName } = depositData;
    const chainType = fromChain.type;
    const chainId = fromChain.chainId;

    const tokenAddress = getTokenAddress(chainType, chainId, tokenName);
    if (!tokenAddress) {
        console.warn('Token address not found');
        return;
    }
    if (tokenAddress === "feeToken") {
        return 0
    }

    if (chainType === 'evm') {
        const evmWallet = get(evmWalletStore);
        if (!evmWallet || !evmWallet.signer) {
            console.warn('EVM wallet not connected');
            return;
        }

        const contract = new ethers.Contract(tokenAddress, usdcAbi, evmWallet.signer);
        const balance = await contract.balanceOf(evmWallet.address);
        const decimals = await contract.decimals();
        return Number(ethers.formatUnits(balance, decimals));
    }

    //TODO FIX AZTEC WALLET BALANCE CHECK
    if (chainType === 'aztec') {
        const aztecWallet = get(aztecWalletStore);
        if (!aztecWallet) {
            console.warn('Aztec wallet not connected');
            return;
        }

        //const balance = await aztecWallet.getBalance({ assetId: tokenAddress });
        return Number(10);
    }
}


//approve token
export async function approveToken() {
    //const approvalTx = await (await nativeTokenWithSender.approve(L1WarpToadWithSender.target,initialBalanceSender*2n)).wait(1)

    const depositData = get(depositApplicationStore);
    if (!depositData) return;
    //L1 warpToad Address
    const tokenAddress = getTokenAddress(depositData.fromChain.type, depositData.fromChain.chainId, depositData.tokenName);

    if (!tokenAddress) {
        console.warn('Token address not found');
        return;
    }
    if (tokenAddress === "feeToken") {
        return 0
    }

    if (depositData.fromChain.type === 'evm') {
        const evmWallet = get(evmWalletStore);
        if (!evmWallet || !evmWallet.signer) {
            console.warn('EVM wallet not connected');
            return;
        }

        const usdcContract = new ethers.Contract(tokenAddress, usdcAbi, evmWallet.signer);
        const amount = ethers.parseUnits(depositData.tokenAmount.toString(), 18);
        //TODO TYPECHAIN FOR ABIS


        try {
            const approveTx = await usdcContract.approve("0xc5a5C42992dECbae36851359345FE25997F5C42d", amount);
            const receipt = await approveTx.wait();

            if (receipt.status === 1) {
                console.log('Transaction successful:', approveTx);
                depositApplicationStore.update(current => {
                    if (!current) return undefined;
                    return {
                        ...current,
                        approved: true
                    };
                });
            } else {
                console.warn('Transaction failed');
            }
        } catch (error) {
            console.log(error)
            return;
        }
    }
}

export async function wrapToken() {
    //const approvalTx = await (await nativeTokenWithSender.approve(L1WarpToadWithSender.target,initialBalanceSender*2n)).wait(1)

    const depositData = get(depositApplicationStore);
    if (!depositData) return;

    if (depositData.fromChain.type === 'evm') {
        const evmWallet = get(evmWalletStore);
        if (!evmWallet || !evmWallet.signer) {
            console.warn('EVM wallet not connected');
            return;
        }

        const amount = ethers.parseUnits(depositData.tokenAmount.toString(), 18);
        const l1WarptoadContract = new ethers.Contract("0xc5a5C42992dECbae36851359345FE25997F5C42d", warptoadAbi, evmWallet.signer);

        try {
            const wrapTx = await l1WarptoadContract.wrap(amount);
            const receipt = await wrapTx.wait();

            if (receipt.status === 1) {
                console.log('Transaction successful:', wrapTx);
                depositApplicationStore.update(current => {
                    if (!current) return undefined;
                    return {
                        ...current,
                        wrapped: true
                    };
                });
                console.log("WRAPPED TOKENS: " + await l1WarptoadContract.balanceOf(evmWallet.signer))
            } else {
                console.warn('Transaction failed');
            }
        } catch (error) {
            console.log(error)
            return;
        }
    }
}

//burn Token


export async function getChainIdAztecFromContract() {
    const aztecWallet = get(aztecWalletStore);
    if (!aztecWallet) {
        console.warn('EVM wallet not connected');
        return;
    }

    const AztecWarpToad = await Contract.at(
        AztecAddress.fromString("0x1aaf11fba8aacaf6ae91931551aabcd48ef852ae18ef01c972c86e83bae3c888"),
        WarpToadCoreContractArtifact,
        aztecWallet,
    );



    const aztecVersion = (await aztecWallet.getNodeInfo()).rollupVersion;
    const chainIdAztecFromContract = await AztecWarpToad.methods.get_chain_id_unconstrained(aztecVersion).simulate() as bigint
    return chainIdAztecFromContract
}

export function createRandomPreImg(amount: bigint, chainIdAztecFromContract: bigint) {
    commitmentPreImgStore.set({
        amount,
        destination_chain_id: chainIdAztecFromContract,
        secret: Fr.random().toBigInt(),
        nullifier_preimg: Fr.random().toBigInt(),
    })

}

function hashPreCommitment(preImg: CommitmentPreImg): bigint {
    return poseidon3([preImg.nullifier_preimg, preImg.secret, preImg.destination_chain_id])
}

export function hashCommitment(preCommitment: bigint, amount: bigint): bigint {
    return poseidon2([preCommitment, amount])
}

//create commitment and store?
export async function createPreCommitment(chainIdAztecFromContract: bigint) {
    const currentAmount = get(depositApplicationStore)?.tokenAmount;

    if (!currentAmount) {
        console.log("ERROR DEPOSIT AMOUNT NOT SET")
        return
    }

    createRandomPreImg(BigInt(currentAmount * 10 ** 18), chainIdAztecFromContract);
    const commitmentPreImg = get(commitmentPreImgStore);
    if (!commitmentPreImg) {
        return;
    }

    console.log(commitmentPreImg)
    const preCommitment = hashPreCommitment(commitmentPreImg)

    warptoadNoteStore.set(
        {
            preImg: commitmentPreImg,
            commitment: preCommitment
        }
    )

}

export async function burnToken(preCommitment: bigint, amount: bigint) {
    const evmWallet = get(evmWalletStore);
    if (!evmWallet || !evmWallet.signer) {
        console.warn('EVM wallet not connected');
        return;
    }

    const l1WarptoadContract = new ethers.Contract("0xc5a5C42992dECbae36851359345FE25997F5C42d", warptoadAbi, evmWallet.signer);

    try {
        const burnTx = await l1WarptoadContract.burn(preCommitment, amount);
        const receipt = await burnTx.wait();

        if (receipt.status === 1) {
            console.log('Transaction successful:', burnTx);
        } else {
            console.warn('Transaction failed');
        }
        const commitment = hashCommitment(preCommitment, amount);
        warptoadNoteStore.update(current => (
            {
                ...current!,
                commitment
            }
        ))

    } catch (error) {
        console.log(error)
        return;
    }

}


export async function showUSDCBalance() {
    const aztecWallet = get(aztecWalletStore);
    if (!aztecWallet) {
        return 0
    }
    const AztecWarpToad = await Contract.at(
        AztecAddress.fromString("0x1aaf11fba8aacaf6ae91931551aabcd48ef852ae18ef01c972c86e83bae3c888"),
        WarpToadCoreContractArtifact,
        aztecWallet,
    );


    return await AztecWarpToad.methods.balance_of(aztecWallet.getAddress()).simulate()
}


export async function evmStartBridge() {
    //is evm connected?
    //is preimg set?
    const warptoadNote = get(warptoadNoteStore);
    if (!warptoadNote) {
        console.log("ERROR: NO PRECOMMITMENT DETECTED");
        return
    }

    try {
        await wrapToken();
        try {
            await burnToken(warptoadNote.commitment, warptoadNote.preImg.amount);
        } catch (error) {
            console.log("BURN FAILED " + error)
        }
    } catch (error) {
        console.log("WRAP FAILED " + error)
    }
    //const gigaBridge = GigaRootBridge__factory.connect(deployedEvmAddresses["L1InfraModule#GigaRootBridge"], evmWallet?.signer)
}


export async function mintOnL2(preImg: CommitmentPreImg) {

    //set test wallet:
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const PXE = createPXEClient(PXE_URL);
    await waitForPXE(PXE);
    const wallets = await getInitialTestAccountsWallets(PXE);
    const userWallet = wallets[0]


    const evmWallet = get(evmWalletStore);

    const AztecWarpToad = await Contract.at(
        AztecAddress.fromString("0x1aaf11fba8aacaf6ae91931551aabcd48ef852ae18ef01c972c86e83bae3c888"),
        WarpToadCoreContractArtifact,
        userWallet,
    );


    const balanceRecipientPreMint = await AztecWarpToad.methods.balance_of(userWallet.getAddress()).simulate()
    console.log("aztec balance before claim: " + balanceRecipientPreMint)

    const preCommitment = hashPreCommitment(preImg)


    const gigaBridge = GigaRootBridge__factory.connect(deployedEvmAddresses["L1InfraModule#GigaRootBridge"], evmWallet?.signer)
    const l1WarptoadContract = new ethers.Contract("0xc5a5C42992dECbae36851359345FE25997F5C42d", warptoadAbi, evmWallet?.signer);



    const commitment = hashCommitment(preCommitment, 5000000000000000000n);



    const aztecMerkleData = await getMerkleData(gigaBridge, l1WarptoadContract as unknown as WarpToadEvm, AztecWarpToad as unknown as WarpToadAztec, commitment)
    console.log(aztecMerkleData);
    if (!aztecMerkleData) {
        console.log("did not manage to get aztec Merkle Data");
        return
    }

    const mintTx = await AztecWarpToad.methods.mint_giga_root_evm(
        5000000000000000000n,
        preImg.secret,
        preImg.nullifier_preimg,
        userWallet.getAddress(),
        aztecMerkleData.blockNumber,
        aztecMerkleData.originLocalRoot,
        aztecMerkleData.gigaMerkleData, // no way i am gonna spend time getting this type right >:(
        aztecMerkleData.evmMerkleData,
    ).send().wait()

    //const mintTx = await AztecWarpToad.methods.mint_for_testing(5n, aztecWallet.getAddress()).send()


    console.log(mintTx);
    const balanceRecipientPostMint = await AztecWarpToad.methods.balance_of(userWallet.getAddress()).simulate()
    console.log("aztec balance after claim: " + balanceRecipientPostMint)
}

export async function schnorrTest() {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const PXE = createPXEClient(PXE_URL);
    await waitForPXE(PXE);
    const wallets = await getInitialTestAccountsWallets(PXE);
    const userWallet = wallets[0]

    console.log(userWallet.getAddress().toString());

    //got a wallet, now interact with contract:
    console.log("init contract");

    const AztecWarpToad = await Contract.at(
        AztecAddress.fromString("0x1aaf11fba8aacaf6ae91931551aabcd48ef852ae18ef01c972c86e83bae3c888"),
        WarpToadCoreContractArtifact,
        userWallet,
    );

    const balanceRecipientPreMint = await AztecWarpToad.methods.balance_of(userWallet.getAddress()).simulate()
    console.log("aztec balance before claim: " + balanceRecipientPreMint)

    const mintTx = await AztecWarpToad.methods.mint_for_testing(5000000n, userWallet.getAddress()).send().wait()

    const balanceRecipientPostMint = await AztecWarpToad.methods.balance_of(userWallet.getAddress()).simulate()
    console.log("aztec balance before claim: " + balanceRecipientPostMint)

    //return { wallets, PXE }

}






/**

    const commitment = hashCommitment(preCommitment1,commitmentPreImg1.amount)
            const aztecMerkleData = await getMerkleData(gigaBridge,L1WarpToad,AztecWarpToad,commitment)
            //await generateNoirTest(proofInputs);
            // const proof = await createProof(proofInputs, os.cpus().length)

            const balanceRecipientPreMint = await AztecWarpToad.methods.balance_of(await evmRecipient.getAddress()).simulate()
            const mintTx = await AztecWarpToad.methods.mint_giga_root_evm(
                commitmentPreImg1.amount,
                commitmentPreImg1.secret,
                commitmentPreImg1.nullifier_preimg,
                aztecRecipient.getAddress(),
                aztecMerkleData.blockNumber,
                aztecMerkleData.originLocalRoot,
                aztecMerkleData.gigaMerkleData as any, // no way i am gonna spend time getting this type right >:(
                aztecMerkleData.evmMerkleData as any,
            ).send().wait()
            // check mint tx
            const balanceRecipientPostMint = await AztecWarpToad.methods.balance_of(aztecRecipient.getAddress()).simulate()
        

*/


/**
 * function to get current selected main evm network // TODO: make it so that we choose if it is evm or aztec
 * function to fetch tokenBalance
 * function to fetch tokenPrice
 */
