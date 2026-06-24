/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-06-24T17:21:06.043Z
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
    "USDcoin": "0x1e2f4432bfef9e9ad39da6d272f4aff33629c770",
    "L1WarpToad": "0x677df0cb865368207999f2862ece576dc56d8df6",
    "GigaBridge": "0xcec91d876e8f003110d43381359b1bad124e7f2b",
    "L1AztecBridgeAdapter": "0x0cf17d5dcda9cf25889cec9ae5610b0fb9725f65"
  },
  "534351": {
    "deploymentBlock": 18726837,
    "USDcoin": "0x538849781f2F8aB07b6EecaaE23c6927c17124A4",
    "L2WarpToad": "0xa0e2b408078FF946D1bBe7A94e81fc610D0cCe3f",
    "L2ScrollBridgeAdapter": "0xe21B2Ac64Cb232773179c19C6CeA9aaCb727028b"
  },
  "11155111": {
    "deploymentBlock": 11130522,
    "L1AztecBridgeAdapter": "0x4F16fA797c6A25c8B35b40a3117CC7Be23CC1777",
    "L1ScrollBridgeAdapter": "0xBc2A51428a0835bDD908c69Cbf61947C17312206",
    "USDcoin": "0x75B61938C4c162D1821AFD65a1CCcf7B62fddFEa",
    "L1WarpToad": "0x2C72c9ce58ddacaC5BbA0EC090FB74A0d1396eDF",
    "GigaBridge": "0x6C2cD1f51fE98536335b48dBcd44a47cF2795D74"
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
