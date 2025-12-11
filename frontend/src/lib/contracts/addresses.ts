/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2025-12-11T22:21:18.558Z
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
    "L1WarpToad": "0x0000000000000000000000000000000000000000",
    "L1AztecBridgeAdapter": "0x0000000000000000000000000000000000000000",
    "GigaBridge": "0x0000000000000000000000000000000000000000",
    "USDcoin": "0x0000000000000000000000000000000000000000"
  },
  "534351": {
    "L1ScrollBridgeAdapter": "0x660d24d5dc16F50f41ACfF3be33cb49428dC14d4",
    "L2WarpToad": "0x2530724Ecbd6eeE58Ee8E80283Bd1AfbFd3C6980",
    "L2ScrollBridgeAdapter": "0xe0B43D99584500fD963F066De99d29992727ec41",
    "USDcoin": "0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413"
  },
  "11155111": {
    "L1WarpToad": "0xdFe8a918B6F4ED3DEB5f6AF5e5e5B74f61758d4D",
    "L1AztecBridgeAdapter": "0x0ca130ad1015768ab36f0fabf48ace00d0a096ab",
    "L1ScrollBridgeAdapter": "0x660d24d5dc16F50f41ACfF3be33cb49428dC14d4",
    "GigaBridge": "0xEccB9A0D202338114BAe6CcfF416d28d4EdFFBe3",
    "USDcoin": "0xF1756846EFEE2944378d82bd9D0996387DA0c781"
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
