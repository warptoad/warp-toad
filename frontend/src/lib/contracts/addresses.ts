/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-01-06T21:39:57.577Z
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
    "deploymentBlock": 15967550,
    "L1ScrollBridgeAdapter": "0x58dc3f54239F26fF424523745b6303e0370355A8",
    "L2WarpToad": "0xEEBc8d07d54A4Da01DaF41c41acf3597EF11cF93",
    "L2ScrollBridgeAdapter": "0x89229e10159e29a4C24ac76dE7bbE071D7ab1010"
  },
  "11155111": {
    "deploymentBlock": 9991951,
    "USDcoin": "0xa0CAa84ebFf522ec43b7Aec844AF36C2ccF86c75",
    "L1WarpToad": "0x6BaC43F25f30CC76a51cCeA7333Cd03A84F12640",
    "L1AztecBridgeAdapter": "0x89EceAeCC78324Ef0599aB78f6222Ab10a377221",
    "L1ScrollBridgeAdapter": "0x58dc3f54239F26fF424523745b6303e0370355A8",
    "GigaBridge": "0xd98CF1b5bf6C1baB321BC94E0ED9bd20B04aA55f"
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
