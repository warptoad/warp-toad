/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-01-06T12:07:57.863Z
 * Run 'npm run pull:addresses' to update
 */

import type { TokenContract } from "$lib/types/bridge";

export interface ContractAddresses {
	deploymentBlock?: number;
	USDcoin?: string;
	L1WarpToad?: string;
	L2WarpToad?: string;
	GigaBridge?: string;
	L1AztecBridgeAdapter?: string;
	L1ScrollBridgeAdapter?: string;
	L2ScrollBridgeAdapter?: string;
}

export interface ChainConfig {
	chainId: string;
	addresses: ContractAddresses;
}

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES: Record<string, ContractAddresses> = {
  "31337": {
    "deploymentBlock": 46,
    "USDcoin": "0x998abeb3E57409262aE5b751f60747921B33613E",
    "L1WarpToad": "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF",
    "L1AztecBridgeAdapter": "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf",
    "L1ScrollBridgeAdapter": "0x9d4454B023096f34B160D6B654540c56A1F81688",
    "GigaBridge": "0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00"
  },
  "131337": {
    "deploymentBlock": 9827262,
    "L1WarpToad": "0x5Af41899Fa54Db59fD8ea1Ea0DdB3f833660eFFf",
    "L1AztecBridgeAdapter": "0xFACA2e4AF1cAE0B96c1eF303442C4118A6E8E145",
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "GigaBridge": "0xEc7F7cFAa21abF4005A61f6FeA3289b1650D991C"
  },
  "534351": {
    "deploymentBlock": 15684597,
    "L1ScrollBridgeAdapter": "0x026B97173994E15c32702bE57Ccb607Ab13dD279",
    "L2WarpToad": "0x67Cc5Ac2029aaA9FD56F7D036d61f2d80A034c10",
    "L2ScrollBridgeAdapter": "0x1A546E41e84A935d20A40E7a2C38f56a426feBd8"
  },
  "11155111": {
    "deploymentBlock": 9899477,
    "USDcoin": "0x7AA44197E3D445f6B3c96Fb3b10B23c13662c656",
    "L1WarpToad": "0xb8fFBCDBbdfd559C6cF34a9A50a560eadB2B86cd",
    "L1AztecBridgeAdapter": "0x5b14876b2bDc657258bCfD1935E48402A27Bf0b7",
    "L1ScrollBridgeAdapter": "0x026B97173994E15c32702bE57Ccb607Ab13dD279",
    "GigaBridge": "0x4Fc572E0B2C2121AFe531cFCdb9F7eB6Bf461D8c"
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
	'534351': 'Scroll Sepolia Testnet',
	'534352': 'Scroll Mainnet',
};

export function getChainName(chainId: number | string): string {
	return CHAIN_NAMES[chainId.toString()] || `Chain ${chainId}`;
}
