/**
 * Full test environment setup
 */

import { ethers } from "ethers";
import { deployEvmContracts, type EvmDeployment } from "./deploy-evm";
import { deployAztecContracts, type AztecDeployment } from "./deploy-aztec";
import { hashPreCommitment } from "../../lib/hashing";
import { calculateFeeFactor } from "../../lib/proving";
import { DEFAULT_FEE, GAS_COST_L1 } from "./constants";
import { getViemClients } from "./artifacts";

export interface EvmOnlyDeployment {
  evm: EvmDeployment;
}

export interface FullDeployment {
  evm: EvmDeployment;
  aztec: AztecDeployment;
  evmWallets: any[];
  chainId: bigint;
}

/**
 * Deploy EVM-only environment for same-chain tests.
 */
export async function setupEvmOnlyEnvironment(): Promise<EvmOnlyDeployment> {
  const evm = await deployEvmContracts();
  return { evm };
}

/**
 * Deploy full EVM + Aztec environment for cross-chain tests.
 * Requires a running Aztec sandbox AND the Hardhat network to point at the
 * sandbox's bundled anvil (http://localhost:8545) so warp-toad's L1 contracts
 * share an L1 with the Aztec rollup/outbox/inbox.
 */
export async function setupFullEnvironment(): Promise<FullDeployment> {
  const { publicClient } = await getViemClients();
  const chainId = BigInt(await publicClient.getChainId());

  const evm = await deployEvmContracts({ withAztecAdapter: true });
  const l1BridgeAdapterAddress = await evm.l1AztecBridgeAdapter!.getAddress();
  const nativeTokenAddress = await evm.nativeToken.getAddress();

  const aztec = await deployAztecContracts(chainId, l1BridgeAdapterAddress, nativeTokenAddress);

  // L1WarpToad bakes the Aztec WarpToadCore address into its public inputs (the on-chain
  // verifier checks the proof's `aztec_warptoad_address` against this stored value), so it
  // must be initialized AFTER the Aztec contract is deployed. deployEvmContracts skipped
  // initialize() for us when withAztecAdapter was true.
  const aztecWarpToadAddress = BigInt(aztec.warpToad.address.toString());
  await (await evm.l1WarpToad.initialize(
    await evm.gigaBridge.getAddress(),
    await evm.l1WarpToad.getAddress(),
    aztecWarpToadAddress,
  )).wait();

  // L1AztecBridgeAdapter needs to know the Aztec L1 registry (to find rollup/outbox/inbox)
  // and the L2 adapter address. Both are only available after the Aztec deployment finishes,
  // so wire it up here as the last setup step.
  const aztecNodeInfo = await aztec.node.getNodeInfo();
  const registryAddress = aztecNodeInfo.l1ContractAddresses.registryAddress.toString();
  const l2BridgeAdapterAddressBytes32 = aztec.bridgeAdapter.address.toString();
  const gigaBridgeAddress = await evm.gigaBridge.getAddress();
  await (await evm.l1AztecBridgeAdapter!.initialize(
    registryAddress,
    l2BridgeAdapterAddressBytes32,
    gigaBridgeAddress,
  )).wait();

  const evmWallets = evm.signers;
  return { evm, aztec, evmWallets, chainId };
}

/** Calculate the fee factor for relayer tests */
export function getTestFeeFactor() {
  return calculateFeeFactor(
    DEFAULT_FEE.ethPriceInToken,
    Number(GAS_COST_L1),
    DEFAULT_FEE.relayerBonusFactor,
  );
}

/** Create a commitment pre-image and compute its preCommitment hash */
export function createCommitment(
  amount: bigint,
  destinationChainId: bigint,
  secret: bigint,
  nullifierPreimage: bigint,
) {
  const preCommitment = hashPreCommitment(nullifierPreimage, secret, destinationChainId);
  return { amount, destinationChainId, secret, nullifierPreimage, preCommitment };
}
