/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2025-12-12T22:56:54.706Z
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
    "deploymentBlock": 9827262,
    "L1WarpToad": "0x5Af41899Fa54Db59fD8ea1Ea0DdB3f833660eFFf",
    "L1AztecBridgeAdapter": "0xFACA2e4AF1cAE0B96c1eF303442C4118A6E8E145",
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "GigaBridge": "0xEc7F7cFAa21abF4005A61f6FeA3289b1650D991C"
  },
  "131337": {
    "deploymentBlock": 9827262,
    "L1WarpToad": "0x5Af41899Fa54Db59fD8ea1Ea0DdB3f833660eFFf",
    "L1AztecBridgeAdapter": "0xFACA2e4AF1cAE0B96c1eF303442C4118A6E8E145",
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "GigaBridge": "0xEc7F7cFAa21abF4005A61f6FeA3289b1650D991C"
  },
  "534351": {
    "deploymentBlock": 15458917,
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "L2WarpToad": "0xaab7Ade1Fb19B9cdb6cc22b9Da623F0cd645e157",
    "L2ScrollBridgeAdapter": "0x4FB96E963Fb5070a88fB543Cabc423b56101304a"
  },
  "11155111": {
    "deploymentBlock": 9827262,
    "USDcoin": "0xc74F692152C5f2cC695b14cec86B729ff8b03168",
    "L1WarpToad": "0x5Af41899Fa54Db59fD8ea1Ea0DdB3f833660eFFf",
    "L1AztecBridgeAdapter": "0xFACA2e4AF1cAE0B96c1eF303442C4118A6E8E145",
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "GigaBridge": "0xEc7F7cFAa21abF4005A61f6FeA3289b1650D991C"
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
