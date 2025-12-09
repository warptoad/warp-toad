/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2025-12-09T15:32:58.413Z
 * Run 'npm run pull:addresses' to update
 */

export interface ContractAddresses {
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
    "USDcoin": "0x95401dc811bb5740090279Ba06cfA8fcF6113778",
    "L1WarpToad": "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
    "L1AztecBridgeAdapter": "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF",
    "L1ScrollBridgeAdapter": "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf",
    "GigaBridge": "0x9d4454B023096f34B160D6B654540c56A1F81688"
  },
  "534351": {
    "L1ScrollBridgeAdapter": "0x1c9b9Fdfb57fDdF18588e0247F7Dc786d9eA3D92",
    "L2WarpToad": "0x0f7776D959e3B410eb84736527F863c631259C9F",
    "L2ScrollBridgeAdapter": "0x15d38553738792B6E97Dc06E4eCf9f335C9cDD80"
  },
  "11155111": {
    "USDcoin": "0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413",
    "L1WarpToad": "0x5BFA9A4f358470774eC2997623efA97ecbf32263",
    "L1AztecBridgeAdapter": "0x056B0485c1A76bf0A158e7DCd3D19e4d31f0CC5b",
    "L1ScrollBridgeAdapter": "0x1c9b9Fdfb57fDdF18588e0247F7Dc786d9eA3D92",
    "GigaBridge": "0xeae835289f34dE789C370929d33458919c106a22"
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
