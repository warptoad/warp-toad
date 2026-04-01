/**
 * Aztec contract deployment helpers for tests
 *
 * Deploys Aztec Noir contracts (WarpToadCore, L2AztecBridgeAdapter)
 * and sets up wallets + PXE for the local sandbox.
 */

import { createAztecNodeClient, type AztecNode } from "@aztec/aztec.js/node";
import { type Wallet as AztecWallet } from "@aztec/aztec.js/wallet";
import { Contract } from "@aztec/aztec.js/contracts";
import type { EthAddressLike } from "@aztec/aztec.js/abi";
import type { PXE } from "@aztec/pxe/server";
import { getAztecTestAccounts, initPXE } from "../../deploy/utils/aztecUtilsNoEnv";
import { WarpToadCoreContractArtifact, WarpToadCoreContract } from "../../aztec/WarpToadCore/src/artifacts/WarpToadCore";
import { L2AztecBridgeAdapterContractArtifact, L2AztecBridgeAdapterContract } from "../../aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter";
import { AZTEC_NODE_URL } from "./constants";

export interface AztecDeployment {
  node: AztecNode;
  pxe: PXE;
  wallets: AztecWallet[];
  warpToad: WarpToadCoreContract;
  bridgeAdapter: L2AztecBridgeAdapterContract;
}

/** Create Aztec node client */
export function createNode(): AztecNode {
  return createAztecNodeClient(AZTEC_NODE_URL);
}

/** Set up PXE and test accounts */
export async function setupAztecEnvironment(node: AztecNode, l1ChainId: bigint) {
  const pxe = await initPXE(node, l1ChainId);
  const wallets = await getAztecTestAccounts(node);
  return { pxe, wallets };
}

/** Deploy WarpToadCore on Aztec */
async function deployWarpToadCore(
  wallet: AztecWallet,
  nativeTokenAddress: string,
): Promise<WarpToadCoreContract> {
  const deployer = (await wallet.getAccounts())[0].item;
  const constructorArgs = [nativeTokenAddress, "wrpToad-TestUSD", "wrpToad-TUSD", 6n];
  const contract = await Contract.deploy(wallet, WarpToadCoreContractArtifact, constructorArgs)
    .send({ from: deployer })
    .deployed() as WarpToadCoreContract;
  return contract;
}

/** Deploy L2AztecBridgeAdapter on Aztec */
async function deployBridgeAdapter(
  wallet: AztecWallet,
  l1BridgeAdapterAddress: string,
): Promise<L2AztecBridgeAdapterContract> {
  const deployer = (await wallet.getAccounts())[0].item;
  const contract = await Contract.deploy(wallet, L2AztecBridgeAdapterContractArtifact, [l1BridgeAdapterAddress])
    .send({ from: deployer })
    .deployed() as L2AztecBridgeAdapterContract;
  return contract;
}

/**
 * Deploy all Aztec contracts and wire them together.
 *
 * @param l1ChainId - L1 chain ID (for PXE initialization)
 * @param l1BridgeAdapterAddress - Address of the L1AztecBridgeAdapter on EVM
 * @param nativeTokenAddress - Address of the native token on L1
 */
export async function deployAztecContracts(
  l1ChainId: bigint,
  l1BridgeAdapterAddress: string,
  nativeTokenAddress: string,
): Promise<AztecDeployment> {
  const node = createNode();
  const { pxe, wallets } = await setupAztecEnvironment(node, l1ChainId);
  const deployerWallet = wallets[0];
  const deployer = (await deployerWallet.getAccounts())[0].item;

  const warpToad = await deployWarpToadCore(deployerWallet, nativeTokenAddress);
  const bridgeAdapter = await deployBridgeAdapter(deployerWallet, l1BridgeAdapterAddress);

  // Initialize WarpToadCore: connect bridge adapter and L1 adapter
  await warpToad.methods
    .initialize(bridgeAdapter.address, l1BridgeAdapterAddress as any as EthAddressLike)
    .send({ from: deployer })
    .wait();

  return { node, pxe, wallets, warpToad, bridgeAdapter };
}
