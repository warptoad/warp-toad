import rawNetworks from './config.json';

export type NetworkConfig = {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  svg?: string; // e.g. path to logo or base64-encoded image
};


export const NETWORKS = rawNetworks as Record<string, NetworkConfig>;
