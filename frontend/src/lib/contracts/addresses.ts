/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-05-19T15:32:50.954Z
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
    "deploymentBlock": 18195213,
    "USDcoin": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "L2WarpToad": "0xe29fB9eD20CFe008B344aF5A974b995c73c12afa",
    "L2ScrollBridgeAdapter": "0x1f8df01B117038deC8519511FE0E8C715B9C110c"
  },
  "11155111": {
    "deploymentBlock": 10880246,
    "L1AztecBridgeAdapter": "0x2024c7728F85DC2762613d122f69307399141dC3",
    "L1ScrollBridgeAdapter": "0xAcFFC811712Ea3490135731AF0FBB177a89093cd",
    "USDcoin": "0xe835B8D433c538030751800383A466c5A0cdA130",
    "L1WarpToad": "0x34B94D8CB25369F7D9f08839e2Bb93E19E80AD06",
    "GigaBridge": "0x6f28ffB636DAd6F33468B3C7685506D5A129f031"
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
