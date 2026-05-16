/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-05-16T20:58:46.448Z
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
  "31337": {
    "deploymentBlock": 46,
    "USDcoin": "0x948b3c65b89df0b4894abe91e6d02fe579834f8f",
    "L1WarpToad": "0x59f2f1fcfe2474fd5f0b9ba1e73ca90b143eb8d0",
    "GigaBridge": "0x1275d096b9dbf2347bd2a131fb6bdab0b4882487",
    "L1AztecBridgeAdapter": "0xc6ba8c3233ecf65b761049ef63466945c362edd2"
  },
  "534351": {
    "deploymentBlock": 18155073,
    "USDcoin": "0x784693ce3508BCa9017f3205Edd0A7251A5da77c",
    "L2WarpToad": "0x9a37F82f625AD318926A059dD215E70a81d12f99",
    "L2ScrollBridgeAdapter": "0x3C233B1eEE59ca472127d1cFc68E939F9326Ea02"
  },
  "11155111": {
    "deploymentBlock": 10864757,
    "L1AztecBridgeAdapter": "0x28063383010117bA4a9c720af60247e9c60F356b",
    "L1ScrollBridgeAdapter": "0xA06D1A8BdD72cBba27d8AC908d3Fb864aE0fA6e4",
    "USDcoin": "0xe143e7aE77a1a9Faf32Fcd61b93ac8cC601EAE93",
    "L1WarpToad": "0x22574AB4B6e5506B5C6481CCC1238ACC43256049",
    "GigaBridge": "0x61EB69Cd8aEc4C7871005A8Aba0A30BD9B29B115"
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
