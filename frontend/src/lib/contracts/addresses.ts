/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: 2026-04-09T02:14:16.141Z
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
  "131337": {
    "deploymentBlock": 9827262,
    "L1WarpToad": "0x5Af41899Fa54Db59fD8ea1Ea0DdB3f833660eFFf",
    "L1AztecBridgeAdapter": "0xFACA2e4AF1cAE0B96c1eF303442C4118A6E8E145",
    "L1ScrollBridgeAdapter": "0xD4641657D1d5944Abc9E59f73dd3Eee1014eBF27",
    "GigaBridge": "0xEc7F7cFAa21abF4005A61f6FeA3289b1650D991C"
  },
  "534351": {
    "deploymentBlock": 15967550,
    "USDcoin": "0xeccb9a0d202338114bae6ccff416d28d4edffbe3",
    "L2WarpToad": "0xf9f537e76985abdce6321958564743b3f6b17c7b",
    "L2ScrollBridgeAdapter": "0xb8295892505c1a8b86d2abc18b21ddfb6e776fcb"
  },
  "11155111": {
    "deploymentBlock": 9991951,
    "USDcoin": "0x7f6023b290dc9dd1c57563a90b2f1ee61efb1cbb",
    "L1WarpToad": "0xdcb27f60e93e58c78bbf8fd15c9047b6e93dfc2f",
    "GigaBridge": "0x2c3cd8bca9b9cc324548a30f8f0dac3c0f7f321c",
    "L1AztecBridgeAdapter": "0xd47b31fc658a9ad871fd63a2057e008bdb78a390",
    "L1ScrollBridgeAdapter": "0xf461acc25ba5ab22ddaf322e59effba9582fcde1"
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
