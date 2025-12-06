
import { ethers } from "ethers";
import { Wallet as AztecWallet, BaseWallet } from "@aztec/aztec.js/wallet"
import { createStore } from "@aztec/kv-store/lmdb";
import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { createPXE, getPXEConfig, PXE } from "@aztec/pxe/server";
import { getInitialTestAccountsData, InitialAccountData } from '@aztec/accounts/testing';
import { TestWallet } from "@aztec/test-wallet/server";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";

const PXE_URL = getPxeUrl()

export function getPxeUrl() {
    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }
    const PXE_URL = process.env.PXE_URL as string
    return PXE_URL
}

export function getEnvArgs() {
    if (!Boolean(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error("NATIVE_TOKEN_ADDRESS not set. do: L1_AZTEC_ADAPTER_ADDRESS=0xTheAdapterAddress NATIVE_TOKEN_ADDRESS=0xUrTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox")
    } else if (!ethers.isAddress(process.env.NATIVE_TOKEN_ADDRESS)) {
        throw new Error(`the value: ${process.env.NATIVE_TOKEN_ADDRESS} is not a valid address. Set NATIVE_TOKEN_ADDRESS= to a valid address`)
    }

    if (!Boolean(process.env.PXE_URL)) {
        throw new Error("PXE_URL not set. do PXE_URL=http://UR.PXE NATIVE_TOKEN_ADDRESS=0xurTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts  --network aztecSandbox")
    }


    const nativeTokenAddress = ethers.getAddress(process.env.NATIVE_TOKEN_ADDRESS as string);
    const PXE_URL = process.env.PXE_URL as string
    return { nativeTokenAddress, PXE_URL, privateKey: process.env.PRIVATE_KEY }
}

export async function initNodeClient(): Promise<AztecNode> {
    try {
        console.log("creating Aztec Node Client...");
        const node = createAztecNodeClient(PXE_URL);
        const nodeInfo = await node.getNodeInfo();
        console.log("Connected to sandbox version:", nodeInfo.nodeVersion);
        console.log("Chain ID:", nodeInfo.l1ChainId);
        return node;

    } catch (error) {
        console.log("failed to create Aztec Node Client: ", error);
        throw error;
    }
}