#!/usr/bin/env tsx
/**
 * Script to pull contract addresses from Ignition deployments
 * Generates a TypeScript file with contract addresses for the frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const backendDeploymentsDir = path.resolve(__dirname, '../../backend/ignition/deployments');
const outputFile = path.resolve(__dirname, '../src/lib/contracts/addresses.ts');

interface DeployedAddresses {
	[key: string]: string;
}

interface ChainAddresses {
	chainId: string;
	USDcoin?: string;
	L1WarpToad?: string;
	L2WarpToad?: string;
	GigaBridge?: string;
	L1AztecBridgeAdapter?: string;
	L1ScrollBridgeAdapter?: string;
	L2ScrollBridgeAdapter?: string;
}

function extractContractAddresses(deployedAddresses: DeployedAddresses): Partial<ChainAddresses> {
	const addresses: Partial<ChainAddresses> = {};

	for (const [key, address] of Object.entries(deployedAddresses)) {
		// Extract contract name from key (format: "ModuleName#ContractName")
		const contractName = key.split('#').pop();

		switch (contractName) {
			case 'USDcoin':
				addresses.USDcoin = address;
				break;
			case 'L1WarpToad':
				addresses.L1WarpToad = address;
				break;
			case 'L2WarpToad':
				addresses.L2WarpToad = address;
				break;
			case 'GigaBridge':
				addresses.GigaBridge = address;
				break;
			case 'L1AztecBridgeAdapter':
				addresses.L1AztecBridgeAdapter = address;
				break;
			case 'L1ScrollBridgeAdapter':
				addresses.L1ScrollBridgeAdapter = address;
				break;
			case 'L2ScrollBridgeAdapter':
				addresses.L2ScrollBridgeAdapter = address;
				break;
		}
	}

	return addresses;
}

function getChainName(chainId: string): string {
	const chainIdMap: Record<string, string> = {
		'31337': 'localhost',
		'1': 'mainnet',
		'11155111': 'sepolia',
		'534351': 'scrollSepolia',
		'534352': 'scroll',
	};

	return chainIdMap[chainId] || `chain_${chainId}`;
}

async function main() {
	console.log('🔍 Scanning for Ignition deployments...');

	// Read all chain directories
	const chainDirs = fs
		.readdirSync(backendDeploymentsDir)
		.filter((dir) => dir.startsWith('chain-'))
		.map((dir) => ({
			chainId: dir.replace('chain-', ''),
			path: path.join(backendDeploymentsDir, dir, 'deployed_addresses.json'),
		}));

	if (chainDirs.length === 0) {
		console.error('No deployment directories found');
		process.exit(1);
	}

	const allChainAddresses: ChainAddresses[] = [];

	// Read addresses from each chain
	for (const { chainId, path: addressFile } of chainDirs) {
		if (!fs.existsSync(addressFile)) {
			console.warn(`No deployed_addresses.json found for chain ${chainId}`);
			continue;
		}

		const deployedAddresses: DeployedAddresses = JSON.parse(
			fs.readFileSync(addressFile, 'utf-8')
		);

		const addresses = extractContractAddresses(deployedAddresses);

		allChainAddresses.push({
			chainId,
			...addresses,
		});

		console.log(`Loaded addresses for chain ${chainId} (${getChainName(chainId)})`);
	}

	// Generate TypeScript file
	const timestamp = new Date().toISOString();
	const tsContent = `/**
 * Contract Addresses
 * Auto-generated from Ignition deployments
 * DO NOT EDIT MANUALLY
 * 
 * Generated: ${timestamp}
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
export const CONTRACT_ADDRESSES: Record<string, ContractAddresses> = ${JSON.stringify(
		Object.fromEntries(
			allChainAddresses.map((chain) => {
				const { chainId, ...addresses } = chain;
				return [chainId, addresses];
			})
		),
		null,
		2
	)};

// Helper to get addresses for a specific chain
export function getContractAddresses(chainId: number | string): ContractAddresses {
	const addresses = CONTRACT_ADDRESSES[chainId.toString()];
	if (!addresses) {
		throw new Error(\`No contract addresses found for chain \${chainId}\`);
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
	return CHAIN_NAMES[chainId.toString()] || \`Chain \${chainId}\`;
}
`;

	// Ensure output directory exists
	const outputDir = path.dirname(outputFile);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Write the file
	fs.writeFileSync(outputFile, tsContent);

	console.log(`\n Contract addresses written to: ${path.relative(process.cwd(), outputFile)}`);
	console.log(`\nSummary:`);
	for (const chain of allChainAddresses) {
		console.log(`   Chain ${chain.chainId} (${getChainName(chain.chainId)}):`);
		console.log(`      L1WarpToad: ${chain.L1WarpToad || 'N/A'}`);
		console.log(`      L2WarpToad: ${chain.L2WarpToad || 'N/A'}`);
		console.log(`      GigaBridge: ${chain.GigaBridge || 'N/A'}`);
		console.log(`      USDcoin: ${chain.USDcoin || 'N/A'}`);
	}
}

main().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
