import { writable, get } from 'svelte/store';
import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
import type { Account } from "@nemi-fi/wallet-sdk";
import { ethers } from 'ethers';
import type { Eip1193Account } from '@nemi-fi/wallet-sdk/eip1193';

//OBSIDION CONSTANTS
export const NODE_URL = "https://registry.obsidion.xyz/node";
export const WALLET_URL = "https://app.obsidion.xyz";


export type WalletStore = {
  walletType: 'aztec' | 'evm';
  content: Eip1193Account | EvmAccount;
}
//typeguard for evm account
export function isEvmAccount(content: Account | EvmAccount): content is EvmAccount {
  return 'provider' in content && 'signer' in content;
}


export type EvmAccount = {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
}

export const walletStore = writable<WalletStore | undefined>(undefined);

// Aztec Wallet SDK
export const sdk = new AztecWalletSdk({
  aztecNode: NODE_URL,
  connectors: [obsidion({ walletUrl: WALLET_URL })],
});


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

  walletStore.set({walletType:'evm', content: evmAccount});
}

export async function connectObsidionWallet(): Promise<void> {
  const account = await sdk.connect("obsidion");
  walletStore.set({walletType:'aztec', content: account});
}

//universal disconnect
export async function disconnectWallet(): Promise<void> {
  await sdk.disconnect();
  const walletType = get(walletStore)!.walletType;
  console.log(walletType);

  if (walletType === 'aztec') {
    await sdk.disconnect();
  }
  // For EVM, no true disconnect; we just clear state.
  
  walletStore.set(undefined);
}
