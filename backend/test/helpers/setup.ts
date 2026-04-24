/**
 * Full test environment setup
 */

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

export async function setupEvmOnlyEnvironment(): Promise<EvmOnlyDeployment> {
  const evm = await deployEvmContracts();
  return { evm };
}

export async function setupFullEnvironment(): Promise<FullDeployment> {
  const { publicClient } = await getViemClients();
  const chainId = BigInt(await publicClient.getChainId());

  const evm = await deployEvmContracts({ withAztecAdapter: true });
  const l1BridgeAdapterAddress = evm.l1AztecBridgeAdapter!.address;
  const nativeTokenAddress = evm.nativeToken.address;

  const aztec = await deployAztecContracts(chainId, l1BridgeAdapterAddress, nativeTokenAddress);

  // L1WarpToad bakes the Aztec WarpToadCore address into its public inputs, so it must
  // be initialized AFTER the Aztec contract is deployed. deployEvmContracts skipped
  // initialize() for us when withAztecAdapter was true.
  const aztecWarpToadAddress = BigInt(aztec.warpToad.address.toString());
  const initHash = await evm.l1WarpToad.write.initialize([
    evm.gigaBridge.address,
    evm.l1WarpToad.address,
    aztecWarpToadAddress,
  ]);
  await evm.publicClient.waitForTransactionReceipt({ hash: initHash });

  // L1AztecBridgeAdapter needs the registry and L2 adapter address, both only available
  // after the Aztec deployment finishes.
  const aztecNodeInfo = await aztec.node.getNodeInfo();
  const registryAddress = aztecNodeInfo.l1ContractAddresses.registryAddress.toString();
  const l2BridgeAdapterAddressBytes32 = aztec.bridgeAdapter.address.toString();
  const initAdapterHash = await evm.l1AztecBridgeAdapter!.write.initialize([
    registryAddress,
    l2BridgeAdapterAddressBytes32,
    evm.gigaBridge.address,
  ]);
  await evm.publicClient.waitForTransactionReceipt({ hash: initAdapterHash });

  const evmWallets = evm.wallets;
  return { evm, aztec, evmWallets, chainId };
}

export function getTestFeeFactor() {
  return calculateFeeFactor(
    DEFAULT_FEE.ethPriceInToken,
    Number(GAS_COST_L1),
    DEFAULT_FEE.relayerBonusFactor,
  );
}

export function createCommitment(
  amount: bigint,
  destinationChainId: bigint,
  secret: bigint,
  nullifierPreimage: bigint,
) {
  const preCommitment = hashPreCommitment(nullifierPreimage, secret, destinationChainId);
  return { amount, destinationChainId, secret, nullifierPreimage, preCommitment };
}
