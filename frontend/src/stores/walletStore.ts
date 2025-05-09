import { writable, get } from 'svelte/store';
import { ethers } from 'ethers';
import { EVM_CHAINS } from '../lib/networks/network';
import { usdcAbi } from '../lib/tokens/usdcAbi';
import { TOKEN_LIST } from '../lib/tokens/tokens';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { createPXEClient, waitForPXE, type PXE, type Wallet } from '@aztec/aztec.js';

//OBSIDION CONSTANTS
export const NODE_URL = "http://localhost:8080";
export const WALLET_URL = "https://app.obsidion.xyz";

export type EvmAccount = {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
  currentNetwork: ethers.Network;
}

/**
 * //set test wallet:
     const { PXE_URL = 'http://localhost:8080' } = process.env;
     const PXE = createPXEClient(PXE_URL);
     await waitForPXE(PXE);
     const wallets = await getInitialTestAccountsWallets(PXE);
     const userWallet = wallets[0]
 */

export const evmWalletStore = writable<EvmAccount | undefined>(undefined);
export const aztecWalletStore = writable<Wallet | undefined>(undefined);
export const PXEStore = writable<PXE | undefined>(undefined);

export async function instantiatePXE() {
  const { PXE_URL = 'http://localhost:8080' } = process.env;
  const PXE = createPXEClient(PXE_URL);
  await waitForPXE(PXE);
  PXEStore.set(PXE);
}

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

//TODO???
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
  await instantiatePXE();
  const currentPXE = get(PXEStore);
  if(!currentPXE){
    console.log("error no PXE");
    return;
  }
  const wallets = await getInitialTestAccountsWallets(currentPXE);
  const userWallet = wallets[0] //TODO COME UP WITH SOMETHING FOR PRODUCTION WARNING only works on sandbox rn

  aztecWalletStore.set(userWallet);
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

  const chain = EVM_CHAINS.find(c => c.id.toLowerCase() === chainId.toLowerCase());

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

  const chain = EVM_CHAINS.find(c => c.id.toLowerCase() === chainId.toLowerCase());
  return chain?.svg;
}

export function getNetworkLogoFromId(chainId: number | string): string | undefined {
  const normalizedId = typeof chainId === 'number'
    ? `0x${chainId.toString(16)}`
    : chainId.toLowerCase();

  const chain = EVM_CHAINS.find(c => c.chainId.toLowerCase() === normalizedId);
  return chain?.svg;
}

export function getNetworkNameFromId(chainId: number | string): string | undefined {
  const normalizedId = typeof chainId === 'number'
    ? `0x${chainId.toString(16)}`
    : chainId.toLowerCase();

  const chain = EVM_CHAINS.find(c => c.chainId.toLowerCase() === normalizedId);
  return chain?.id;
}


export async function mintTestTokens(amount: string = "10000000") {
  const evmWallet = get(evmWalletStore);
  if (!evmWallet) throw new Error("EVM wallet not connected");

  const contractAddress = "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f";
  const contract = new ethers.Contract(contractAddress, usdcAbi, evmWallet.signer);

  console.log(`Balance before: ${await contract.balanceOf(evmWallet.address)}`);

  const decimals = await contract.decimals(); // optional, defaults to 18 if unknown
  const amountInUnits = ethers.parseUnits(amount, decimals);

  const tx = await contract.getFreeShit(amountInUnits);
  await tx.wait(); // wait for confirmation

  console.log(`Balance after: ${await contract.balanceOf(evmWallet.address)}`);
}

export function getTokenAddress(
  chainType: "evm" | "aztec",
  chainId: number | string,
  tokenSymbol: string
): string | undefined {
  const normalizedId = typeof chainId === 'number'
    ? `0x${chainId.toString(16)}`
    : chainId.toLowerCase();

  const tokenList = chainType === "evm" ? TOKEN_LIST.evm : TOKEN_LIST.aztec;

  const token = tokenList.find(
    t => t.chainId.toLowerCase() === normalizedId && t.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase()
  );

  return token?.tokenAddress;
}

export async function getTokenBalance(
  tokenAddress: string
) {
  const evmWallet = get(evmWalletStore);
  if (!evmWallet) throw new Error("EVM wallet not connected");
  const contract = new ethers.Contract(tokenAddress, usdcAbi, evmWallet.signer);
  const balance = await contract.balanceOf(evmWallet.address)
  return balance
}


