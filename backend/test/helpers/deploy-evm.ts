/**
 * EVM contract deployment helpers for tests
 *
 * Deploys all Solidity contracts needed for the WarpToad bridge system.
 * Uses Hardhat v3 viem APIs.
 */

import hre from "hardhat";
import { type Address } from "viem";
import { EVM_TREE_DEPTH, GIGA_TREE_DEPTH } from "./constants";

export interface EvmDeployment {
  nativeToken: any;        // USDcoin contract instance
  poseidonT3: any;         // PoseidonT3 library
  lazyIMT: any;            // LazyIMT library
  withdrawVerifier: any;   // WithdrawVerifier contract
  l1WarpToad: any;         // L1WarpToad contract
  gigaBridge: any;         // GigaBridge contract
  l1AztecBridgeAdapter: any; // L1AztecBridgeAdapter contract
}

/** Deploy PoseidonT3 and LazyIMT libraries */
async function deployLibraries() {
  const poseidonT3 = await hre.viem.deployContract("PoseidonT3");
  const lazyIMT = await hre.viem.deployContract("LazyIMT", [], {
    libraries: { PoseidonT3: poseidonT3.address },
  });
  return { poseidonT3, lazyIMT };
}

/** Deploy the native token (test USDC) */
async function deployNativeToken() {
  return await hre.viem.deployContract("USDcoin");
}

/** Deploy L1WarpToad with its verifier */
async function deployL1WarpToad(
  nativeTokenAddress: Address,
  lazyIMTAddress: Address,
  poseidonT3Address: Address,
) {
  const withdrawVerifier = await hre.viem.deployContract("WithdrawVerifier");

  const name = await (await hre.viem.getContractAt("USDcoin", nativeTokenAddress)).read.name();
  const symbol = await (await hre.viem.getContractAt("USDcoin", nativeTokenAddress)).read.symbol();

  const l1WarpToad = await hre.viem.deployContract(
    "L1WarpToad",
    [EVM_TREE_DEPTH, withdrawVerifier.address, nativeTokenAddress, `wrpToad-${symbol}`, `wrpToad-${name}`],
    {
      libraries: {
        LazyIMT: lazyIMTAddress,
        PoseidonT3: poseidonT3Address,
      },
    },
  );

  return { l1WarpToad, withdrawVerifier };
}

/** Deploy GigaBridge with local root providers */
async function deployGigaBridge(
  lazyIMTAddress: Address,
  gigaRootRecipients: Address[],
) {
  return await hre.viem.deployContract("GigaBridge", [gigaRootRecipients, GIGA_TREE_DEPTH], {
    libraries: { LazyIMT: lazyIMTAddress },
  });
}

/** Deploy L1AztecBridgeAdapter */
async function deployL1AztecBridgeAdapter() {
  return await hre.viem.deployContract("L1AztecBridgeAdapter");
}

/**
 * Deploy all EVM contracts and wire them together.
 *
 * @param opts.withAztecAdapter - Whether to deploy the L1AztecBridgeAdapter (default: false)
 * @param opts.aztecWarptoadAddress - Aztec WarpToad address (as bigint) for L1 initialization
 */
export async function deployEvmContracts(opts?: {
  withAztecAdapter?: boolean;
  aztecWarptoadAddress?: bigint;
}): Promise<EvmDeployment> {
  const { poseidonT3, lazyIMT } = await deployLibraries();
  const nativeToken = await deployNativeToken();
  const { l1WarpToad, withdrawVerifier } = await deployL1WarpToad(
    nativeToken.address,
    lazyIMT.address,
    poseidonT3.address,
  );

  let l1AztecBridgeAdapter: any = null;
  const gigaRootRecipients: Address[] = [l1WarpToad.address];

  if (opts?.withAztecAdapter) {
    l1AztecBridgeAdapter = await deployL1AztecBridgeAdapter();
    gigaRootRecipients.push(l1AztecBridgeAdapter.address);
  }

  const gigaBridge = await deployGigaBridge(lazyIMT.address, gigaRootRecipients);

  // Initialize L1WarpToad: connect to GigaBridge, itself as L1 adapter, Aztec address
  const aztecAddr = opts?.aztecWarptoadAddress ?? 0n;
  await l1WarpToad.write.initialize([gigaBridge.address, l1WarpToad.address, aztecAddr]);

  return {
    nativeToken,
    poseidonT3,
    lazyIMT,
    withdrawVerifier,
    l1WarpToad,
    gigaBridge,
    l1AztecBridgeAdapter,
  };
}
