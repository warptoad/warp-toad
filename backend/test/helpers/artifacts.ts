/**
 * Contract utilities for tests
 *
 * Deploys contracts using viem on the EDR network, then wraps them
 * as ethers Contract instances for lib layer compatibility.
 * Everything runs on a single network (Hardhat's EDR).
 */

import { ethers } from "ethers";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type WalletClient, type PublicClient, type Address, type Hex } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache the connection so all helpers share the same EDR instance
let _connectionCache: any = null;
let _ethersProviderCache: ethers.BrowserProvider | null = null;

async function getConnection() {
  if (!_connectionCache) {
    // Hardhat 3 ignores `defaultNetwork` in user config and uses the CLI `--network`
    // flag or its built-in "default" (edr-simulated) network. We pass the name
    // explicitly so tests use the `local` network from hardhat.config.ts, which
    // points at the Aztec sandbox's L1 anvil.
    _connectionCache = await hre.network.connect("local");
  }
  return _connectionCache;
}

/**
 * Get ethers provider connected to EDR. Cached for consistency.
 */
export async function getEthersProvider(): Promise<ethers.BrowserProvider> {
  if (!_ethersProviderCache) {
    const connection = await getConnection();
    // Disable block caching so getBlockNumber() always returns the latest
    _ethersProviderCache = new ethers.BrowserProvider(connection.provider, undefined, { cacheTimeout: -1 });
  }
  return _ethersProviderCache;
}

/**
 * Get ethers signers connected to EDR.
 */
export async function getEthersSigners(): Promise<ethers.JsonRpcSigner[]> {
  const provider = await getEthersProvider();
  return await provider.listAccounts() as ethers.JsonRpcSigner[];
}

/**
 * Get viem clients connected to EDR.
 */
export async function getViemClients() {
  const connection = await getConnection();
  const [deployer] = await connection.viem.getWalletClients();
  const publicClient = await connection.viem.getPublicClient();
  return { deployer, publicClient, viem: connection.viem };
}

/**
 * Extract ABI and bytecode from Hardhat build-info for npm library contracts.
 */
function getFromBuildInfo(sourcePath: string, contractName: string) {
  const buildInfoDir = path.resolve(__dirname, "../../artifacts/build-info");
  const files = fs.readdirSync(buildInfoDir).filter((f: string) => f.includes("output"));
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(buildInfoDir, f), "utf8"));
    const contracts = data.output?.contracts?.[sourcePath];
    if (contracts?.[contractName]) {
      const c = contracts[contractName];
      return { abi: c.abi, bytecode: ("0x" + c.evm.bytecode.object) as Hex };
    }
  }
  throw new Error(`Contract ${contractName} not found in build-info at ${sourcePath}`);
}

/**
 * Manually link library references in bytecode.
 */
function linkBytecode(
  bytecode: Hex,
  linkReferences: Record<string, Record<string, Array<{ start: number; length: number }>>>,
  libraries: Record<string, Address>,
): Hex {
  let linked = bytecode.slice(2);
  for (const [, contractRefs] of Object.entries(linkReferences)) {
    for (const [contractName, refs] of Object.entries(contractRefs)) {
      const addr = libraries[contractName];
      if (!addr) throw new Error(`Missing library address for ${contractName}`);
      const cleanAddr = addr.slice(2).toLowerCase();
      for (const ref of refs) {
        const start = ref.start * 2;
        const length = ref.length * 2;
        linked = linked.slice(0, start) + cleanAddr.padStart(length, "0") + linked.slice(start + length);
      }
    }
  }
  return ("0x" + linked) as Hex;
}

/**
 * Deploy a contract from a Hardhat artifact via viem on EDR.
 */
export async function deployFromArtifact(
  contractName: string,
  args: any[],
  deployer: WalletClient,
  publicClient: PublicClient,
  libraries?: Record<string, Address>,
): Promise<{ address: Address; abi: any[] }> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  let bytecode = artifact.bytecode as Hex;

  if (libraries && Object.keys(artifact.linkReferences).length > 0) {
    bytecode = linkBytecode(bytecode, artifact.linkReferences, libraries);
  }

  const hash = await deployer.deployContract({ abi: artifact.abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`Deployment of ${contractName} failed`);

  return { address: receipt.contractAddress, abi: artifact.abi };
}

/**
 * Deploy a library from build-info (for npm packages without standalone artifacts).
 */
export async function deployLibFromBuildInfo(
  sourcePath: string,
  contractName: string,
  deployer: WalletClient,
  publicClient: PublicClient,
  libraries?: Record<string, Address>,
): Promise<Address> {
  const { abi, bytecode: rawBytecode } = getFromBuildInfo(sourcePath, contractName);
  let bytecode = rawBytecode;

  if (libraries) {
    let hex = bytecode.slice(2);
    for (const [, addr] of Object.entries(libraries)) {
      const cleanAddr = addr.slice(2).toLowerCase().padStart(40, "0");
      hex = hex.replace(/__\$[a-fA-F0-9]{34}\$__/g, cleanAddr);
    }
    bytecode = ("0x" + hex) as Hex;
  }

  const hash = await deployer.deployContract({ abi, bytecode, args: [] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`Deployment of ${contractName} failed`);
  return receipt.contractAddress;
}

/**
 * Create an ethers Contract connected to EDR with a specific signer.
 */
export async function toEthersContract(
  abi: any[],
  address: string,
  signerIndex: number = 0,
): Promise<ethers.Contract> {
  const signers = await getEthersSigners();
  return new ethers.Contract(address, abi, signers[signerIndex]);
}
