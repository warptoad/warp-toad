import { writable } from 'svelte/store';
import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
import type { Account } from "@nemi-fi/wallet-sdk";
import { ethers } from 'ethers';
import { EVM_CHAINS } from '../lib/networks/network';
import { evmWalletStore, aztecWalletStore } from './walletStore';

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
}

export const depositApplicationStore = writable<DepositData | undefined>(undefined);

export const isEvmOrigin = writable(true);

//make it so that user can pick?

let unsubscribe: () => void = () => {};

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

export function setChain(chain: { type: "aztec" | "evm"; chainId: string }, isFrom:boolean=true) {
    depositApplicationStore.update(current => {
        if (!current) return undefined;
        if(isFrom){
            return {
                ...current,
                fromChain:chain,
            };

        }else{
            return {
                ...current,
                toChain:chain,
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
  


//TODO CHAT: function that listens for evmWalletStore and sets fromChain to evm + currentChainId in string



/**
 * function to get current selected main evm network // TODO: make it so that we choose if it is evm or aztec
 * function to pick target network from list / evm or aztec + chainID
 * function to fetch tokenBalance
 * function to fetch tokenPrice
 */
