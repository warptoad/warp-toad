/**
 * Full test environment setup
 *
 * Combines EVM and Aztec deployments into a single setup function
 * that wires everything together for integration tests.
 */

import hre from "hardhat";
import { type Address, type WalletClient, type PublicClient } from "viem";
import { deployEvmContracts, type EvmDeployment } from "./deploy-evm";
import { deployAztecContracts, createNode, type AztecDeployment } from "./deploy-aztec";
import { hashPreCommitment } from "../../lib/hashing";
import { calculateFeeFactor } from "../../lib/proving";
import { DEFAULT_FEE, GAS_COST_L1 } from "./constants";

export interface FullDeployment {
  evm: EvmDeployment;
  aztec: AztecDeployment;
  evmWallets: WalletClient[];
  publicClient: PublicClient;
  chainId: bigint;
}

/**
 * Deploy everything (EVM + Aztec) for a full cross-chain integration test.
 *
 * This deploys:
 * - USDcoin, PoseidonT3, LazyIMT, WithdrawVerifier, L1WarpToad (EVM)
 * - L1AztecBridgeAdapter (EVM)
 * - GigaBridge (EVM)
 * - WarpToadCore (Aztec)
 * - L2AztecBridgeAdapter (Aztec)
 *
 * Then wires everything together (initialize calls, adapter connections).
 */
export async function setupFullEnvironment(): Promise<FullDeployment> {
  const publicClient = await hre.viem.getPublicClient();
  const evmWallets = await hre.viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  // Deploy EVM contracts first (with Aztec adapter placeholder)
  const evm = await deployEvmContracts({ withAztecAdapter: true });

  // Deploy Aztec contracts, wired to the L1 adapter
  const aztec = await deployAztecContracts(
    BigInt(chainId),
    evm.l1AztecBridgeAdapter.address,
    evm.nativeToken.address,
  );

  // Initialize L1AztecBridgeAdapter with Aztec registry and L2 adapter
  const nodeInfo = await aztec.node.getNodeInfo();
  const registryAddress = nodeInfo.l1ContractAddresses.registryAddress.toString();
  await evm.l1AztecBridgeAdapter.write.initialize([
    registryAddress,
    aztec.bridgeAdapter.address.toString(),
    evm.gigaBridge.address,
  ]);

  // Re-initialize L1WarpToad with the actual Aztec address
  // Note: L1WarpToad was already initialized in deployEvmContracts with aztecAddr=0,
  // so we need the contract to support re-initialization or we deploy fresh.
  // For now, the aztecWarptoadAddress is set during EVM deploy via a second pass.

  return {
    evm,
    aztec,
    evmWallets,
    publicClient,
    chainId: BigInt(chainId),
  };
}

/**
 * Deploy EVM-only environment (no Aztec) for L1-to-L1 tests.
 */
export async function setupEvmOnlyEnvironment() {
  const publicClient = await hre.viem.getPublicClient();
  const evmWallets = await hre.viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  const evm = await deployEvmContracts();

  return { evm, evmWallets, publicClient, chainId: BigInt(chainId) };
}

/**
 * Calculate the fee factor for relayer tests.
 */
export function getTestFeeFactor(chainId: bigint) {
  return calculateFeeFactor(
    DEFAULT_FEE.ethPriceInToken,
    Number(GAS_COST_L1),
    DEFAULT_FEE.relayerBonusFactor,
  );
}

/**
 * Create a commitment pre-image and compute its preCommitment hash.
 */
export function createCommitment(
  amount: bigint,
  destinationChainId: bigint,
  secret: bigint,
  nullifierPreimage: bigint,
) {
  const preCommitment = hashPreCommitment(nullifierPreimage, secret, destinationChainId);
  return {
    amount,
    destinationChainId,
    secret,
    nullifierPreimage,
    preCommitment,
  };
}
