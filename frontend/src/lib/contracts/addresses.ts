/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-05-16T11:39:53.561Z
 * Run 'npm run pull:addresses' to update
 */

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
  "534351": {
    "deploymentBlock": 18149750,
    "USDcoin": "0x8Fe0d0A76AEa9065B6877e42Bb8346E888507783",
    "L2WarpToad": "0x8D5C8bA2CFb9191eCE6535d8096Fbf3FEefFe569",
    "L2ScrollBridgeAdapter": "0x4A944957797E1Ca6409d39ca9339413181bd63E4"
  },
  "11155111": {
    "deploymentBlock": 10862510,
    "L1AztecBridgeAdapter": "0xa7DD8C3cc339093bfa9C826b524D65c82e4990ee",
    "L1ScrollBridgeAdapter": "0x37D4f4E240CD3633CCF7ce7FAAcef899490ddF05",
    "USDcoin": "0x12762B6Ed8dC07546769E573e51F96dE422CA08e",
    "L1WarpToad": "0x3a3f49C6F37003d793a4a0E0FA8A7c601C61D636",
    "GigaBridge": "0xec1d765627BBDE0C4e5bafa9605769d99CfAf6Fb"
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
