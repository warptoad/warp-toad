/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-07-22T19:20:13.676Z
 * Run 'npm run pull:addresses' to update
 */

export interface ContractAddresses {
	deploymentBlock?: number;
	USDcoin?: string;
	L1WarpToad?: string;
	L2WarpToad?: string;
	GigaBridge?: string;
	L1AztecBridgeAdapter?: string;
	L1ZkStackBridgeAdapters?: Record<string, string>;
	L2ZkStackBridgeAdapter?: string;
}

export interface ChainConfig {
	chainId: string;
	addresses: ContractAddresses;
}

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<string, ContractAddresses> = {
  "300": {
    "deploymentBlock": 7938146,
    "USDcoin": "0x33E2369071bDfE3176598F0A546f06C799469897",
    "L2WarpToad": "0xaab7Ade1Fb19B9cdb6cc22b9Da623F0cd645e157",
    "L2ZkStackBridgeAdapter": "0x4FB96E963Fb5070a88fB543Cabc423b56101304a"
  },
  "31337": {
    "deploymentBlock": 46,
    "USDcoin": "0x1e2f4432bfef9e9ad39da6d272f4aff33629c770",
    "L1WarpToad": "0x677df0cb865368207999f2862ece576dc56d8df6",
    "GigaBridge": "0xcec91d876e8f003110d43381359b1bad124e7f2b",
    "L1AztecBridgeAdapter": "0x0cf17d5dcda9cf25889cec9ae5610b0fb9725f65"
  },
  "11155111": {
    "deploymentBlock": 11328597,
    "L1AztecBridgeAdapter": "0xEb0508752d56D5AA0dB0982536e718c0d09755d5",
    "L1ZkStackBridgeAdapters": {
      "0": "0x8FEcedEEfa55107A364E8d3567765CaF2D222a55",
      "1": "0xAd18B4C24bB07bC0D5aF5B22bD5d30dF1dE50dBD",
      "2": "0xb7AF4dB18847358f51C6652231db65d2Ffe8F329",
      "3": "0x9e22252A502c26c96de96904bBAe0B6f67371b17"
    },
    "USDcoin": "0x8ba044E55412615e9b0650b073a10B8Fc82bBBeA",
    "L1WarpToad": "0xF9BD90404176e07aB4Ed85726BF29D3250663cC4",
    "GigaBridge": "0x8fF4Bfa8547A7e219Ad3CA98788abD95CbCc69BA"
  }
};

// Helper to get addresses for a specific chain
export function getContractAddresses(chainId: number | string): ContractAddresses {
	const addresses = CONTRACT_ADDRESSES[chainId.toString()];
	if (!addresses) {
		throw new Error(`No contract addresses found for chain ${chainId}`);
	}
	return addresses;
}

// Chain name mapping
export const CHAIN_NAMES: Record<string, string> = {
	'31337': 'Localhost (Anvil)',
	'1': 'Ethereum Mainnet',
	'11155111': 'Sepolia Testnet',
	'300': 'ZKsync Era Sepolia',
	'324': 'ZKsync Era',
	'11124': 'Abstract Testnet',
};

export function getChainName(chainId: number | string): string {
	return CHAIN_NAMES[chainId.toString()] || `Chain ${chainId}`;
}
