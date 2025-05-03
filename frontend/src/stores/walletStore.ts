import { writable, get } from 'svelte/store';
import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
import type { Account } from "@nemi-fi/wallet-sdk";
import { ethers } from 'ethers';

//OBSIDION CONSTANTS
export const NODE_URL = "https://registry.obsidion.xyz/node";
export const WALLET_URL = "https://app.obsidion.xyz";

export type EvmAccount = {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}

export const evmWalletStore = writable<EvmAccount | undefined>(undefined);
export const aztecWalletStore = writable<Account | undefined>(undefined);

// Aztec Wallet SDK
export const sdk = new AztecWalletSdk({
  aztecNode: NODE_URL,
  connectors: [obsidion({ walletUrl: WALLET_URL })],
});

export function isEvmConnected(): boolean {
  return get(evmWalletStore) !== undefined;
}

export function isAztecConnected(): boolean {
  return get(aztecWalletStore) !== undefined;
}

export async function connectMetamaskWallet(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found");

  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const evmAccount: EvmAccount = {
    address,
    provider,
    signer,
  };

  evmWalletStore.set(evmAccount);
}

export async function connectObsidionWallet(): Promise<void> {
  aztecWalletStore.set(await sdk.connect("obsidion"));
}

export async function disconnectObsidionWallet(): Promise<void> {
  await sdk.disconnect();
  aztecWalletStore.set(undefined)
}

export async function disconnectMetamaskWallet(): Promise<void> {
  //pseudo disconnect, just deletes store
  evmWalletStore.set(undefined)
}
