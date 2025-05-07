import { writable, get } from 'svelte/store';
//import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
//import type { Account } from "@nemi-fi/wallet-sdk";
import { ethers } from 'ethers';
import { CHAINS } from '../lib/networks/network';
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { getDeployedTestAccountsWallets, getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { AccountWalletWithSecretKey, Fq, Fr, GrumpkinScalar, createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { deriveSigningKey } from '@aztec/stdlib/keys';

//OBSIDION CONSTANTS
export const PXE_URL = "http://localhost:8080";
const pxe = createPXEClient(PXE_URL);


//export const NODE_URL = "https://registry.obsidion.xyz/node";
//export const WALLET_URL = "https://app.obsidion.xyz";

export type AztecWalletKeys = {
  secretKey: Fr;
  signingPrivateKey: Fq;
}

export function createAztecKeysRandom() {
  const secretKey = Fr.random();
  const signingPrivateKey = GrumpkinScalar.random();

  const keys: AztecWalletKeys = {
    secretKey: secretKey,
    signingPrivateKey: signingPrivateKey
  }

  return keys;
}

//TODO: maybe add passkey support?
export async function createFreshTestnetWallet() {

await waitForPXE(pxe);
  // Use a pre-funded wallet to pay for the fees for the deployments.
  const [wallet] = (await getDeployedTestAccountsWallets(pxe));
  console.log("1")
  console.log(wallet);
  console.log(wallet.getAddress().toString())
  const secretKey = Fr.random();
  const newAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey));
  console.log("2")
  console.log(newAccount)
  await newAccount.deploy({deployWallet:wallet}).wait();
  console.log("3")
  console.log(newAccount)
  const newWallet: AccountWalletWithSecretKey = await newAccount.getWallet()
  console.log("4")
  console.log("wallet created!")
  console.log(newWallet)
  return newWallet
}

export function testAztec() {
  console.log(createAztecKeysRandom());
}


export type EvmAccount = {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
  currentNetwork: ethers.Network;
}

export const evmWalletStore = writable<EvmAccount | undefined>(undefined);
export const aztecWalletStore = writable<AccountWalletWithSecretKey | undefined>(undefined);

// Aztec Wallet SDK
/*
export const sdk = new AztecWalletSdk({
  aztecNode: NODE_URL,
  connectors: [obsidion({ walletUrl: WALLET_URL })],
});
*/
export function isWalletConnected(instance: any): boolean {
  return instance !== undefined;
}

export async function connectMetamaskWallet(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found");

  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const currentNetwork = await provider.getNetwork();

  const evmAccount: EvmAccount = {
    address,
    provider,
    signer,
    currentNetwork,
  };

  evmWalletStore.set(evmAccount);

  window.ethereum.on('chainChanged', handleChainChanged);
}

const handleChainChanged = async () => {
  try {
    const newProvider = new ethers.BrowserProvider(window.ethereum);
    const updatedNetwork = await newProvider.getNetwork();
    const signer = await newProvider.getSigner();
    const address = await signer.getAddress();

    evmWalletStore.set({
      address,
      provider: newProvider,
      signer,
      currentNetwork: updatedNetwork,
    });

  } catch (error) {
    console.error("Failed to handle chainChanged:", error);
  }
};


export async function connectAztecWallet(): Promise<void> {
  aztecWalletStore.set(await createFreshTestnetWallet());
}


export async function disconnectAztecWallet(): Promise<void> {
  aztecWalletStore.set(undefined)
}


export const disconnectMetamaskWallet = async (): Promise<void> => {
  evmWalletStore.set(undefined);
  if (window.ethereum?.removeListener) {
    window.ethereum.removeListener('chainChanged', handleChainChanged);
  }
};



export function truncateAddress(str: string): string {
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

// EVM/METAMASK FUNCTIONS

export async function switchNetwork(chainId: string): Promise<void> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not available');
  }

  const chain = CHAINS.find(c => c.id.toLowerCase() === chainId.toLowerCase());

  if (!chain) {
    throw new Error(`Unknown chainId: ${chainId}`);
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chain.chainId }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      // Network not added, attempt to add it
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chain.chainId,
            chainName: chain.chainName,
            rpcUrls: chain.rpcUrls,
            blockExplorerUrls: chain.blockExplorerUrls,
            nativeCurrency: chain.nativeCurrency,
          }],
        });
      } catch (addError) {
        console.error('Failed to add network', addError);
        throw addError;
      }
    } else {
      console.error('Failed to switch network', switchError);
      throw switchError;
    }
  }
}


export async function getCurrentNetwork(): Promise<ethers.Network> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not available');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  return network; // Contains `chainId`, `name`, etc.
}

export function getNetworkLogoFromName(chainId: string): string | undefined {

  const chain = CHAINS.find(c => c.id.toLowerCase() === chainId.toLowerCase());
  return chain?.svg;
}

export function getNetworkLogoFromId(chainId: number | string): string | undefined {
  const normalizedId = typeof chainId === 'number'
    ? `0x${chainId.toString(16)}`
    : chainId.toLowerCase();

  const chain = CHAINS.find(c => c.chainId.toLowerCase() === normalizedId);
  return chain?.svg;
}

