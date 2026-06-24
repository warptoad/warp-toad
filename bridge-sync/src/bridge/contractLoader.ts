/**
 * Standalone contract loader for bridge-sync.
 *
 * The backend's `scripts/deployment.ts` and `scripts/utils.ts` transitively
 * import `hardhat`, which boots the Hardhat runtime and looks for a config in
 * the current working directory - irrelevant for a long-running HTTP service.
 *
 * Instead we read the Hardhat-compiled artifact JSONs straight off disk,
 * extract their ABIs, and build viem contract handles. This mirrors how
 * `backend/scripts/syncLocal.ts` (the known-working sandbox sync script) wires
 * things up, just without the Hardhat dependency.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getContract,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// bridge-sync/src/bridge → ../../../backend
const BACKEND_DIR = path.resolve(__dirname, '..', '..', '..', 'backend');

interface HardhatArtifact {
  abi: any[];
}

function loadAbi(relPath: string): any[] {
  const fullPath = path.join(BACKEND_DIR, 'artifacts', 'contracts', relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Hardhat artifact not found at ${fullPath}. Did you run \`pnpm b:compile\`?`);
  }
  const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as HardhatArtifact;
  return artifact.abi;
}

export const L1_WARPTOAD_ABI = () => loadAbi('core/L1WarpToad.sol/L1WarpToad.json');
const GIGA_BRIDGE_ABI = () => loadAbi('bridge/GigaBridge.sol/GigaBridge.json');
const L1_AZTEC_BRIDGE_ADAPTER_ABI = () =>
  loadAbi('bridge/adapters/L1AztecBridgeAdapter.sol/L1AztecBridgeAdapter.json');
const L1_SCROLL_BRIDGE_ADAPTER_ABI = () =>
  loadAbi('bridge/adapters/L1ScrollBridgeAdapter.sol/L1ScrollBridgeAdapter.json');
const L2_WARPTOAD_ABI = () => loadAbi('core/L2WarpToad.sol/L2WarpToad.json');
const L2_SCROLL_BRIDGE_ADAPTER_ABI = () =>
  loadAbi('bridge/adapters/L2ScrollBridgeAdapter.sol/L2ScrollBridgeAdapter.json');

interface DeployedAddresses {
  [key: string]: string;
}

function loadDeployedAddresses(chainId: bigint): DeployedAddresses {
  const file = path.join(
    BACKEND_DIR,
    'deploy',
    'ignition',
    'deployments',
    `chain-${chainId.toString()}`,
    'deployed_addresses.json',
  );
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment for chain ${chainId} at ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export interface L1ContractHandles {
  L1Warptoad: any;
  gigaBridge: any;
  L1Adapter: any;
  l1WarpToadAddress: Address;
  gigaBridgeAddress: Address;
  l1AdapterAddress: Address;
}

/**
 * Load L1 contract handles for the given chain. `isAztec` selects between the
 * Aztec adapter and the Scroll adapter as the L1 adapter binding.
 */
export function loadL1Contracts(
  l1ChainId: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
  isAztec: boolean,
): L1ContractHandles {
  const addrs = loadDeployedAddresses(l1ChainId);

  const l1WarpToadAddress =
    (addrs['L1InfraModule#L1WarpToad'] || addrs['L1WarpToadModule#L1WarpToad']) as Address;
  const gigaBridgeAddress = addrs['L1InfraModule#GigaBridge'] as Address;
  const l1AdapterAddress = (
    isAztec
      ? addrs['L1InfraModule#L1AztecBridgeAdapter']
      : addrs['L1InfraModule#L1ScrollBridgeAdapter'] || addrs['L1InfraModule#L1AztecBridgeAdapter']
  ) as Address;

  if (!l1WarpToadAddress) throw new Error(`L1WarpToad address missing for chain ${l1ChainId}`);
  if (!gigaBridgeAddress) throw new Error(`GigaBridge address missing for chain ${l1ChainId}`);
  if (!l1AdapterAddress) throw new Error(`L1 bridge adapter address missing for chain ${l1ChainId}`);

  const L1Warptoad = getContract({
    address: l1WarpToadAddress,
    abi: L1_WARPTOAD_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });
  const gigaBridge = getContract({
    address: gigaBridgeAddress,
    abi: GIGA_BRIDGE_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });
  const L1Adapter = getContract({
    address: l1AdapterAddress,
    abi: isAztec ? L1_AZTEC_BRIDGE_ADAPTER_ABI() : L1_SCROLL_BRIDGE_ADAPTER_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });

  return { L1Warptoad, gigaBridge, L1Adapter, l1WarpToadAddress, gigaBridgeAddress, l1AdapterAddress };
}

/**
 * Load a specific L1 adapter contract handle by type. Useful for multi-hop
 * routes (aztec↔scroll) where both adapters need to be accessed from the same
 * executor run.
 */
export function loadL1AdapterByType(
  l1ChainId: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
  kind: 'aztec' | 'scroll',
): { adapter: any; address: Address };
export function loadL1AdapterByType(
  l1ChainId: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
  kind: 'aztec' | 'scroll',
  optional: boolean,
): { adapter: any; address: Address } | null;
export function loadL1AdapterByType(
  l1ChainId: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
  kind: 'aztec' | 'scroll',
  optional = false,
): { adapter: any; address: Address } | null {
  const addrs = loadDeployedAddresses(l1ChainId);
  const address = (
    kind === 'aztec'
      ? addrs['L1InfraModule#L1AztecBridgeAdapter']
      : addrs['L1InfraModule#L1ScrollBridgeAdapter']
  ) as Address;
  if (!address) {
    // Local/dev deploys omit the Scroll adapter (Scroll is disabled). Optional
    // callers treat a missing adapter as "not a recipient" instead of failing.
    if (optional) return null;
    throw new Error(`L1 ${kind} adapter address missing for chain ${l1ChainId}`);
  }
  const adapter = getContract({
    address,
    abi: kind === 'aztec' ? L1_AZTEC_BRIDGE_ADAPTER_ABI() : L1_SCROLL_BRIDGE_ADAPTER_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });
  return { adapter, address };
}

export interface ScrollContractHandles {
  L2WarpToad: any;
  L2Adapter: any;
}

export function loadScrollContracts(
  l2ChainId: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient,
): ScrollContractHandles {
  const addrs = loadDeployedAddresses(l2ChainId);
  const l2WarpToadAddress = addrs['L2ScrollModule#L2WarpToad'] as Address;
  const l2AdapterAddress = addrs['L2ScrollModule#L2ScrollBridgeAdapter'] as Address;
  if (!l2WarpToadAddress) throw new Error(`L2WarpToad missing for chain ${l2ChainId}`);
  if (!l2AdapterAddress) throw new Error(`L2ScrollBridgeAdapter missing for chain ${l2ChainId}`);

  const L2WarpToad = getContract({
    address: l2WarpToadAddress,
    abi: L2_WARPTOAD_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });
  const L2Adapter = getContract({
    address: l2AdapterAddress,
    abi: L2_SCROLL_BRIDGE_ADAPTER_ABI(),
    client: { public: publicClient, wallet: walletClient },
  });
  return { L2WarpToad, L2Adapter };
}

export interface AztecContractMetadata {
  AztecWarpToad: { address: string; constructorArgs: any[]; salt: string; deployer: string };
  L2AztecBridgeAdapter: { address: string; constructorArgs: any[]; salt: string; deployer: string };
}

export function loadAztecContractMetadata(l1ChainId: bigint): AztecContractMetadata {
  const file = path.join(
    BACKEND_DIR,
    'deploy',
    'aztec',
    'aztecDeployments',
    l1ChainId.toString(),
    'deployed_addresses.json',
  );
  if (!fs.existsSync(file)) {
    throw new Error(`No Aztec deployment for L1 chain ${l1ChainId} at ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
