/**
 * Chain Registry
 *
 * Central configuration for all supported chains.
 * This architecture makes it easy to add new chains in the future.
 *
 * To add a new chain:
 * 1. Add an entry to CHAIN_DISPLAY in types/bridge.ts (this defines the Chain id)
 * 2. Add a ChainDefinition here with contracts and config
 * 3. For another ZK Stack chain, that's it: ZK_STACK_CHAIN_DEFS below is a list, and
 *    the L2 interaction code is already chain-agnostic. For a genuinely new chain
 *    family, also implement utils/[family]-interactions.ts.
 *
 * The helpers below all iterate CHAIN_REGISTRY, so nothing else needs editing.
 *
 * ZK Stack entries must match `backend/lib/zkStackChains.ts` (the deploy-side source
 * of truth); a mismatch means the frontend reads a slot the deploy never wired.
 */

import { anvil, sepolia, zksyncSepoliaTestnet, type Chain as ViemChain } from 'viem/chains';
import type { Chain } from '$lib/types/bridge.js';
import { CONTRACT_ADDRESSES } from '$lib/contracts/addresses';

// ============================================================================
// Deployment loading (resilient to missing files)
// ============================================================================
//
// Use import.meta.glob so Vite resolves every existing deployment file at
// build time and skips missing ones gracefully. With static `import x from
// './chain-XXX/deployed_addresses.json'`, a missing dir (e.g. after wiping
// the local sandbox state for a fresh redeploy) fails the whole build even
// in testnet mode that doesn't need that chain. Globbing lets the chain
// fall through to empty addresses; the chain is disabled or no-ops at
// runtime depending on the mode.

type EvmDeployment = Record<string, string>;

interface AztecDeploymentRecord {
	address: string;
	constructorArgs: string[];
	salt: string;
	deployer: string;
}

interface AztecDeploymentFile {
	AztecWarpToad: AztecDeploymentRecord;
	L2AztecBridgeAdapter: AztecDeploymentRecord;
}

const STUB_AZTEC_RECORD: AztecDeploymentRecord = {
	address: '',
	constructorArgs: [],
	salt: '',
	deployer: '',
};
const STUB_AZTEC_FILE: AztecDeploymentFile = {
	AztecWarpToad: STUB_AZTEC_RECORD,
	L2AztecBridgeAdapter: STUB_AZTEC_RECORD,
};

const evmDeploymentModules = import.meta.glob<EvmDeployment>(
	'../../../../backend/deploy/ignition/deployments/chain-*/deployed_addresses.json',
	{ eager: true, import: 'default' },
);
const aztecDeploymentModules = import.meta.glob<AztecDeploymentFile>(
	'../../../../backend/deploy/aztec/aztecDeployments/*/deployed_addresses.json',
	{ eager: true, import: 'default' },
);

function loadEvmDeployment(chainId: number): EvmDeployment {
	const key = Object.keys(evmDeploymentModules).find((k) =>
		k.includes(`/chain-${chainId}/`),
	);
	return key ? evmDeploymentModules[key] : ({} as EvmDeployment);
}

function loadAztecDeployment(chainId: number): AztecDeploymentFile {
	const key = Object.keys(aztecDeploymentModules).find((k) =>
		k.includes(`/aztecDeployments/${chainId}/`),
	);
	return key ? aztecDeploymentModules[key] : STUB_AZTEC_FILE;
}

const LocalEvmDeployments = loadEvmDeployment(31337);
const SepoliaDeployments = loadEvmDeployment(11155111);
const LocalAztecDeployments = loadAztecDeployment(31337);
const TestnetAztecDeployments = loadAztecDeployment(11155111);

// ============================================================================
// Environment Detection
// ============================================================================

export const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

// ============================================================================
// Chain Role Types
// ============================================================================

export type ChainRole = 'L1' | 'L2' | 'Privacy';

// ============================================================================
// Chain Definition Interface
// ============================================================================

export interface EVMChainContracts {
	warpToad: string;
	nativeToken: string;
	bridgeAdapter?: string;
	gigaBridge?: string;
	/**
	 * L2 chains only: the L1-side adapter slot that serves this L2, on the L1 hub.
	 * Needed because withdraw proofs read this L2's local-root leaf out of the L1 giga
	 * tree, and with several L2s there is no longer a single "the L2 adapter".
	 */
	l1Adapter?: string;
}

export interface AztecChainContracts {
	warpToad: {
		address: string;
		constructorArgs: string[];
		contractAddressSalt: string;
		deployer: string;
	};
	bridgeAdapter: {
		address: string;
		constructorArgs: string[];
		contractAddressSalt: string;
		deployer: string;
	};
}

export interface EVMChainDefinition {
	id: Chain;
	name: string;
	type: 'EVM';
	role: ChainRole;
	chainId: number;
	viemChain: ViemChain;
	rpcUrl: string;
	contracts: EVMChainContracts;
	enabled: boolean;
}

export interface AztecChainDefinition {
	id: Chain;
	name: string;
	type: 'Aztec';
	role: ChainRole;
	nodeUrl: string;
	network: 'sandbox' | 'devnet' | 'testnet';
	contracts: AztecChainContracts;
	enabled: boolean;
}

export type ChainDefinition = EVMChainDefinition | AztecChainDefinition;

// ============================================================================
// Chain Definitions
// ============================================================================

/**
 * Ethereum L1 Chain Definition
 */
const ETHEREUM_CHAIN: EVMChainDefinition = isTestMode
	? {
		id: 'Ethereum',
		name: 'Localhost (Anvil)',
		type: 'EVM',
		role: 'L1',
		chainId: 31337,
		viemChain: anvil,
		rpcUrl: 'http://localhost:8545',
		contracts: {
			warpToad: LocalEvmDeployments['L1WarpToadModule#L1WarpToad'],
			// The L1 ignition deploy doesn't include the test USDcoin (it takes the
			// native token via NATIVE_TOKEN_ADDRESS env var), so the value lives in
			// the pull-addresses output `frontend/src/lib/contracts/addresses.ts`.
			// VITE_LOCAL_USDC_ADDRESS overrides it if set.
			nativeToken: import.meta.env.VITE_LOCAL_USDC_ADDRESS ?? CONTRACT_ADDRESSES['31337']?.USDcoin ?? '',
			bridgeAdapter: LocalEvmDeployments['L1InfraModule#L1AztecBridgeAdapter'],
			gigaBridge: LocalEvmDeployments['L1InfraModule#GigaBridge'],
		},
		enabled: true,
	}
	: {
		id: 'Ethereum',
		name: 'Sepolia Testnet',
		type: 'EVM',
		role: 'L1',
		chainId: 11155111,
		viemChain: sepolia,
		rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
		contracts: {
			warpToad: (SepoliaDeployments as Record<string, string>)['L1WarpToadModule#L1WarpToad'],
			nativeToken: (SepoliaDeployments as Record<string, string>)['TestToken#USDcoin'],
			bridgeAdapter: (SepoliaDeployments as Record<string, string>)['L1InfraModule#L1AztecBridgeAdapter'],
			gigaBridge: (SepoliaDeployments as Record<string, string>)['L1InfraModule#GigaBridge'],
		},
		enabled: true,
	};

/**
 * ZK Stack (Elastic Chain) L2 definitions.
 *
 * Every ZK Stack chain deploys the SAME Ignition module into its own chain-<id>
 * directory, so the deployment keys are identical across chains and only the chain id
 * and RPC differ. That's what makes this a list rather than a hand-written const per
 * chain: adding one is an entry here plus one in CHAIN_DISPLAY.
 *
 * Only enabled in testnet mode (the local sandbox has no L2).
 */
interface ZkStackChainSpec {
	id: Chain;
	name: string;
	chainId: number;
	viemChain: ViemChain;
	rpcUrl: string;
	/** GigaBridge adapter slot this chain claimed. Must match ZK_STACK_CHAINS in
	 *  backend/lib/constants.ts, or proofs read the wrong leaf. */
	l1AdapterSlot: number;
}

const ZK_STACK_CHAIN_SPECS: ZkStackChainSpec[] = [
	{
		id: 'ZKsync',
		name: 'ZKsync Era Sepolia',
		chainId: 300,
		viemChain: zksyncSepoliaTestnet,
		rpcUrl: import.meta.env.VITE_ZKSYNC_ERA_SEPOLIA_RPC_URL || 'https://sepolia.era.zksync.dev',
		l1AdapterSlot: 0,
	},
];

function buildZkStackChain(spec: ZkStackChainSpec): EVMChainDefinition {
	const deployments = loadEvmDeployment(spec.chainId) as Record<string, string>;
	return {
		id: spec.id,
		name: spec.name,
		type: 'EVM',
		role: 'L2',
		chainId: spec.chainId,
		viemChain: spec.viemChain,
		rpcUrl: spec.rpcUrl,
		contracts: {
			warpToad: deployments['L2ZkStackModule#L2WarpToad'],
			nativeToken: deployments['TestToken#USDcoin'],
			bridgeAdapter: deployments['L2ZkStackModule#L2ZkStackBridgeAdapter'],
			l1Adapter: (isTestMode ? LocalEvmDeployments : (SepoliaDeployments as Record<string, string>))[
				`L1InfraModule#L1ZkStackBridgeAdapter_${spec.l1AdapterSlot}`
			],
		},
		enabled: !isTestMode, // Only available in testnet mode
	};
}

const ZK_STACK_CHAINS: EVMChainDefinition[] = ZK_STACK_CHAIN_SPECS.map(buildZkStackChain);

/**
 * Aztec Chain Definition
 */
const AZTEC_CHAIN: AztecChainDefinition = isTestMode
	? {
		id: 'Aztec',
		name: 'Sandbox',
		type: 'Aztec',
		role: 'Privacy',
		// In dev mode, never read VITE_AZTEC_NODE_URL (reserved for testnet).
		// Use VITE_LOCAL_AZTEC_NODE_URL or fall back to the canonical sandbox port.
		nodeUrl: import.meta.env.VITE_LOCAL_AZTEC_NODE_URL || 'http://localhost:8080',
		network: 'sandbox',
		contracts: {
			warpToad: {
				address: LocalAztecDeployments.AztecWarpToad.address,
				constructorArgs: LocalAztecDeployments.AztecWarpToad.constructorArgs,
				contractAddressSalt: LocalAztecDeployments.AztecWarpToad.salt,
				deployer: LocalAztecDeployments.AztecWarpToad.deployer,
			},
			bridgeAdapter: {
				address: LocalAztecDeployments.L2AztecBridgeAdapter.address,
				constructorArgs: LocalAztecDeployments.L2AztecBridgeAdapter.constructorArgs,
				contractAddressSalt: LocalAztecDeployments.L2AztecBridgeAdapter.salt,
				deployer: LocalAztecDeployments.L2AztecBridgeAdapter.deployer,
			},
		},
		enabled: true,
	}
	: {
		id: 'Aztec',
		name: 'Testnet',
		type: 'Aztec',
		role: 'Privacy',
		nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL || 'https://v5.testnet.rpc.aztec-labs.com',
		network: 'testnet',
		contracts: {
			warpToad: {
				address: TestnetAztecDeployments.AztecWarpToad.address,
				constructorArgs: TestnetAztecDeployments.AztecWarpToad.constructorArgs,
				contractAddressSalt: TestnetAztecDeployments.AztecWarpToad.salt,
				deployer: TestnetAztecDeployments.AztecWarpToad.deployer,
			},
			bridgeAdapter: {
				address: TestnetAztecDeployments.L2AztecBridgeAdapter.address,
				constructorArgs: TestnetAztecDeployments.L2AztecBridgeAdapter.constructorArgs,
				contractAddressSalt: TestnetAztecDeployments.L2AztecBridgeAdapter.salt,
				deployer: TestnetAztecDeployments.L2AztecBridgeAdapter.deployer,
			},
		},
		enabled: true,
	};

// ============================================================================
// Chain Registry
// ============================================================================

/**
 * All chain definitions indexed by chain ID
 */
export const CHAIN_REGISTRY: Record<Chain, ChainDefinition> = {
	Ethereum: ETHEREUM_CHAIN,
	Aztec: AZTEC_CHAIN,
	...(Object.fromEntries(ZK_STACK_CHAINS.map((c) => [c.id, c])) as Pick<
		Record<Chain, ChainDefinition>,
		Exclude<Chain, 'Ethereum' | 'Aztec'>
	>),
};

// ============================================================================
// Chain Registry Helper Functions
// ============================================================================

/**
 * Get chain definition by chain name
 */
export function getChain(id: Chain): ChainDefinition {
	return CHAIN_REGISTRY[id];
}

/**
 * Get chain definition by EVM chain ID
 */
export function getChainByChainId(chainId: number): Chain | undefined {
	for (const [name, def] of Object.entries(CHAIN_REGISTRY)) {
		if (def.type === 'EVM' && def.chainId === chainId) {
			return name as Chain;
		}
	}
	return undefined;
}

/**
 * Get all enabled chains
 */
export function getEnabledChains(): Chain[] {
	return (Object.keys(CHAIN_REGISTRY) as Chain[]).filter((id) => CHAIN_REGISTRY[id].enabled);
}

/**
 * Get all disabled chains (for showing greyed out in UI)
 */
export function getDisabledChains(): Chain[] {
	return (Object.keys(CHAIN_REGISTRY) as Chain[]).filter((id) => !CHAIN_REGISTRY[id].enabled);
}

/**
 * Check if a chain is enabled
 */
export function isChainEnabled(chain: Chain): boolean {
	return CHAIN_REGISTRY[chain]?.enabled ?? false;
}

/**
 * Check if a chain is an EVM chain
 */
export function isEVMChain(chain: Chain): chain is Chain {
	return CHAIN_REGISTRY[chain]?.type === 'EVM';
}

/**
 * Check if a chain is Aztec
 */
export function isAztecChain(chain: Chain): boolean {
	return CHAIN_REGISTRY[chain]?.type === 'Aztec';
}

/**
 * Get EVM chain definition (type-safe)
 */
export function getEVMChain(chain: Chain): EVMChainDefinition | undefined {
	const def = CHAIN_REGISTRY[chain];
	return def?.type === 'EVM' ? def : undefined;
}

/**
 * Get Aztec chain definition (type-safe)
 */
export function getAztecChain(chain: Chain): AztecChainDefinition | undefined {
	const def = CHAIN_REGISTRY[chain];
	return def?.type === 'Aztec' ? def : undefined;
}

/**
 * Get viem chain config for an EVM chain
 */
export function getViemChain(chain: Chain): ViemChain | undefined {
	const def = getEVMChain(chain);
	return def?.viemChain;
}

/**
 * Get viem chain config by chain ID
 */
export function getViemChainById(chainId: number): ViemChain | undefined {
	const chainName = getChainByChainId(chainId);
	if (!chainName) return undefined;
	return getViemChain(chainName);
}

/**
 * Get all EVM chains (for network configs)
 */
export function getEVMChains(): EVMChainDefinition[] {
	return Object.values(CHAIN_REGISTRY).filter((def): def is EVMChainDefinition => def.type === 'EVM' && def.enabled);
}

/**
 * Get network configs for viem (Record<chainName, ViemChain>)
 */
export function getNetworkConfigs(): Record<string, ViemChain> {
	const configs: Record<string, ViemChain> = {};
	for (const chain of getEVMChains()) {
		configs[chain.id] = chain.viemChain;
	}
	return configs;
}

/**
 * Get WarpToad contract address for a chain
 */
export function getWarpToadAddress(chain: Chain): string | undefined {
	const def = CHAIN_REGISTRY[chain];
	if (!def) return undefined;

	if (def.type === 'EVM') {
		return def.contracts.warpToad;
	} else {
		return def.contracts.warpToad.address;
	}
}

/**
 * Get native token address for an EVM chain (sync, from static config).
 * Both local-dev and testnet modes are populated via `pull:addresses`.
 */
export function getNativeTokenAddress(chain: Chain): string | undefined {
	const def = getEVMChain(chain);
	return def?.contracts.nativeToken || undefined;
}

/**
 * Get bridge adapter address for a chain
 */
export function getBridgeAdapterAddress(chain: Chain): string | undefined {
	const def = CHAIN_REGISTRY[chain];
	if (!def) return undefined;

	if (def.type === 'EVM') {
		return def.contracts.bridgeAdapter;
	} else {
		return def.contracts.bridgeAdapter.address;
	}
}

/**
 * L1-side adapter address serving a given L2 chain. Undefined for L1/Aztec.
 */
export function getL1AdapterForL2(chain: Chain): string | undefined {
	const def = getEVMChain(chain);
	return def?.role === 'L2' ? def.contracts.l1Adapter : undefined;
}

/**
 * L1-side adapter address serving the L2 with this EVM chain id.
 *
 * Returns undefined for an L1 chain id, which is the caller's signal to use L1WarpToad
 * as the local-root provider instead. Replaces `sourceChainId === 534351` checks.
 */
export function getL1AdapterForEvmChainId(chainId: number): string | undefined {
	for (const def of Object.values(CHAIN_REGISTRY)) {
		if (def.type === 'EVM' && def.role === 'L2' && def.chainId === chainId) {
			return def.contracts.l1Adapter;
		}
	}
	return undefined;
}

/**
 * Get GigaBridge address (only on L1)
 */
export function getGigaBridgeAddress(): string | undefined {
	const l1 = getEVMChain('Ethereum');
	return l1?.contracts.gigaBridge;
}

// ============================================================================
// Token Configuration
// ============================================================================

export interface TokenConfig {
	symbol: string;
	name: string;
	decimals: number;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
	{
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
	},
];

/**
 * Get token config by symbol
 */
export function getTokenConfig(symbol: string): TokenConfig | undefined {
	return SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
}
