import { writable } from 'svelte/store';
import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
import type { Account } from "@nemi-fi/wallet-sdk";

export const NODE_URL = "https://registry.obsidion.xyz/node";
export const WALLET_URL = "https://app.obsidion.xyz";

// Store for account
export const accountStore = writable<Account | undefined>(undefined);

// Initialize the SDK
export const sdk = new AztecWalletSdk({
  aztecNode: NODE_URL,
  connectors: [obsidion({ walletUrl: WALLET_URL })],
});
