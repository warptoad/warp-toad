/**
 * EVM contract deployment helpers for tests
 *
 * Deploys all Solidity contracts on Hardhat's EDR network using viem,
 * then wraps them as ethers Contract instances for the lib layer.
 * Everything runs on a single in-process network.
 */

import { ethers } from "ethers";
import { type Address } from "viem";
import {
  getViemClients,
  deployFromArtifact,
  deployLibFromBuildInfo,
  toEthersContract,
  getEthersSigners,
  getEthersProvider,
} from "./artifacts";
import { EVM_TREE_DEPTH, GIGA_TREE_DEPTH } from "./constants";

export interface EvmDeployment {
  nativeToken: ethers.Contract;
  withdrawVerifier: ethers.Contract;
  l1WarpToad: ethers.Contract;
  gigaBridge: ethers.Contract;
  l1AztecBridgeAdapter: ethers.Contract | null;
  provider: ethers.BrowserProvider;
  signers: ethers.Signer[];
}

/**
 * Deploy all EVM contracts and wire them together.
 */
export async function deployEvmContracts(opts?: {
  withAztecAdapter?: boolean;
  aztecWarptoadAddress?: bigint;
}): Promise<EvmDeployment> {
  const { deployer, publicClient, viem } = await getViemClients();
  const provider = await getEthersProvider();
  const signers = await getEthersSigners();

  // 1. Deploy libraries
  const poseidonT3Addr = await deployLibFromBuildInfo(
    "npm/poseidon-solidity@0.0.5/PoseidonT3.sol",
    "PoseidonT3",
    deployer,
    publicClient,
  );

  const lazyIMTAddr = await deployLibFromBuildInfo(
    "npm/@zk-kit/lazy-imt.sol@2.0.0-beta.12/LazyIMT.sol",
    "LazyIMT",
    deployer,
    publicClient,
    { PoseidonT3: poseidonT3Addr },
  );

  const libs: Record<string, Address> = {
    LazyIMT: lazyIMTAddr,
    PoseidonT3: poseidonT3Addr,
  };

  // 2. Deploy native token
  const nativeTokenDeploy = await deployFromArtifact("USDcoin", [], deployer, publicClient);

  // 3. Deploy verifier (HonkVerifier depends on ZKTranscriptLib)
  const zkTranscriptLibDeploy = await deployFromArtifact("ZKTranscriptLib", [], deployer, publicClient);
  const verifierDeploy = await deployFromArtifact("HonkVerifier", [], deployer, publicClient, {
    ZKTranscriptLib: zkTranscriptLibDeploy.address,
  });

  // 4. Get token metadata for WarpToad name/symbol
  const nativeTokenViem = await viem.getContractAt("USDcoin", nativeTokenDeploy.address);
  const tokenName = await nativeTokenViem.read.name();
  const tokenSymbol = await nativeTokenViem.read.symbol();

  // 5. Deploy L1WarpToad (needs libraries)
  const l1WarpToadDeploy = await deployFromArtifact(
    "L1WarpToad",
    [EVM_TREE_DEPTH, verifierDeploy.address, nativeTokenDeploy.address, `wrpToad-${tokenSymbol}`, `wrpToad-${tokenName}`],
    deployer,
    publicClient,
    libs,
  );

  // 6. Deploy L1AztecBridgeAdapter (optional)
  let l1AztecAdapterDeploy: { address: Address; abi: any[] } | null = null;
  const gigaRootRecipients: Address[] = [l1WarpToadDeploy.address];

  if (opts?.withAztecAdapter) {
    l1AztecAdapterDeploy = await deployFromArtifact("L1AztecBridgeAdapter", [], deployer, publicClient);
    gigaRootRecipients.push(l1AztecAdapterDeploy.address);
  }

  // 7. Deploy GigaBridge (needs LazyIMT)
  const gigaBridgeDeploy = await deployFromArtifact(
    "GigaBridge",
    [gigaRootRecipients, GIGA_TREE_DEPTH],
    deployer,
    publicClient,
    { LazyIMT: lazyIMTAddr },
  );

  // 8. Wrap as ethers Contracts
  const nativeToken = await toEthersContract(nativeTokenDeploy.abi, nativeTokenDeploy.address);
  const withdrawVerifier = await toEthersContract(verifierDeploy.abi, verifierDeploy.address);
  const l1WarpToad = await toEthersContract(l1WarpToadDeploy.abi, l1WarpToadDeploy.address);
  const gigaBridge = await toEthersContract(gigaBridgeDeploy.abi, gigaBridgeDeploy.address);

  let l1AztecBridgeAdapter: ethers.Contract | null = null;
  if (l1AztecAdapterDeploy) {
    l1AztecBridgeAdapter = await toEthersContract(l1AztecAdapterDeploy.abi, l1AztecAdapterDeploy.address);
  }

  // 9. Initialize L1WarpToad
  const aztecAddr = opts?.aztecWarptoadAddress ?? 0n;
  const initTx = await l1WarpToad.initialize(
    await gigaBridge.getAddress(),
    await l1WarpToad.getAddress(),
    aztecAddr,
  );
  await initTx.wait();

  return {
    nativeToken,
    withdrawVerifier,
    l1WarpToad,
    gigaBridge,
    l1AztecBridgeAdapter,
    provider,
    signers,
  };
}
