/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-07-20T22:56:07.182Z
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
  "31337": {
    "deploymentBlock": 46,
    "USDcoin": "0x1e2f4432bfef9e9ad39da6d272f4aff33629c770",
    "L1WarpToad": "0x677df0cb865368207999f2862ece576dc56d8df6",
    "GigaBridge": "0xcec91d876e8f003110d43381359b1bad124e7f2b",
    "L1AztecBridgeAdapter": "0x0cf17d5dcda9cf25889cec9ae5610b0fb9725f65"
  },
  "534351": {},
  "11155111": {
    "deploymentBlock": 11284049,
    "L1AztecBridgeAdapter": "0x07A77D7F5E2bB81CF6E1CE68D5FbBdd189CcFdAa",
    "USDcoin": "0xefc5Eb7678085FaD5224A75e78EEDd75d06447b6",
    "L1WarpToad": "0x66492C3894FbF85261DE74E47b9bc3218a9276E9",
    "GigaBridge": "0x088C00Cda67115Fb0bB95E38e75612517a415Ed5"
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
