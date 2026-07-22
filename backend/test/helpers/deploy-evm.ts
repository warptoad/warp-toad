/**
 * EVM contract deployment helpers for tests.
 *
 * Deploys Solidity contracts via viem on Hardhat's EDR network and returns
 * viem contract handles for the lib layer and tests.
 */

import { type Address, type PublicClient, type WalletClient, getContract } from "viem";
import {
  getViemClients,
  deployFromArtifact,
  deployLibFromBuildInfo,
} from "./artifacts";
import { EVM_TREE_DEPTH, GIGA_TREE_DEPTH } from "./constants";

export interface EvmDeployment {
  nativeToken: any;
  withdrawVerifier: any;
  l1WarpToad: any;
  gigaBridge: any;
  l1AztecBridgeAdapter: any | null;
  /** Claimed ZK Stack adapter slots, in slot order. Empty unless requested. */
  l1ZkStackBridgeAdapters: any[];
  publicClient: PublicClient;
  deployer: WalletClient;
  wallets: WalletClient[];
}

/** Build a viem contract handle with both read and write bound to a wallet. */
function bindContract(address: Address, abi: any[], publicClient: PublicClient, walletClient: WalletClient) {
  return getContract({ address, abi, client: { public: publicClient, wallet: walletClient } });
}

export async function deployEvmContracts(opts?: {
  withAztecAdapter?: boolean;
  // When set, also deploys N L1ZkStackBridgeAdapter slots and includes them in
  // gigaRootRecipients. Every slot is byte identical until initialize() picks its
  // chain, so only the shared Bridgehub address is needed here.
  withZkStackAdapters?: { bridgehub: Address; slots?: number } | false;
  aztecWarptoadAddress?: bigint;
  // Hardhat network name (e.g. "local", "sepolia", "zksyncEraSepolia"). Defaults
  // to "local" so existing test invocations stay unchanged.
  networkName?: string;
}): Promise<EvmDeployment> {
  const { deployer, publicClient, viem, testWallets } = await getViemClients(opts?.networkName);

  // 1. Libraries
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

  // 2. Native token
  const nativeTokenDeploy = await deployFromArtifact("USDcoin", [], deployer, publicClient);

  // 3. Verifier (HonkVerifier depends on ZKTranscriptLib + RelationsLib)
  const zkTranscriptLibDeploy = await deployFromArtifact("ZKTranscriptLib", [], deployer, publicClient);
  const relationsLibDeploy = await deployFromArtifact("RelationsLib", [], deployer, publicClient);
  const verifierDeploy = await deployFromArtifact("HonkVerifier", [], deployer, publicClient, {
    ZKTranscriptLib: zkTranscriptLibDeploy.address,
    RelationsLib: relationsLibDeploy.address,
  });

  // 4. Token metadata for WarpToad name/symbol
  const nativeTokenViem = await viem.getContractAt("USDcoin", nativeTokenDeploy.address);
  const tokenName = await nativeTokenViem.read.name();
  const tokenSymbol = await nativeTokenViem.read.symbol();

  // 5. L1WarpToad
  // Constructor signature: (maxDepth, verifier, nativeToken, name, symbol)
  // name = long form ("wrpToad-USD Coin"), symbol = short form ("wrpToad-USDC").
  // Previous code had these swapped, which made MetaMask reject wallet_watchAsset
  // because the symbol didn't match what users expected.
  const l1WarpToadDeploy = await deployFromArtifact(
    "L1WarpToad",
    [EVM_TREE_DEPTH, verifierDeploy.address, nativeTokenDeploy.address, `wrpToad-${tokenName}`, `wrpToad-${tokenSymbol}`],
    deployer,
    publicClient,
    libs,
  );

  // 6. L1AztecBridgeAdapter (optional)
  let l1AztecAdapterDeploy: { address: Address; abi: any[] } | null = null;
  const gigaRootRecipients: Address[] = [l1WarpToadDeploy.address];

  if (opts?.withAztecAdapter) {
    l1AztecAdapterDeploy = await deployFromArtifact("L1AztecBridgeAdapter", [], deployer, publicClient);
    gigaRootRecipients.push(l1AztecAdapterDeploy.address);
  }

  // 6b. L1ZkStackBridgeAdapter slots (optional). Constructor takes only the shared
  // Bridgehub; l2ChainId and the L2 adapter address are set later via initialize().
  const l1ZkStackAdapterDeploys: { address: Address; abi: any[] }[] = [];
  if (opts?.withZkStackAdapters) {
    const slots = opts.withZkStackAdapters.slots ?? 1;
    for (let i = 0; i < slots; i++) {
      const d = await deployFromArtifact(
        "L1ZkStackBridgeAdapter",
        [opts.withZkStackAdapters.bridgehub],
        deployer,
        publicClient,
      );
      l1ZkStackAdapterDeploys.push(d);
      gigaRootRecipients.push(d.address);
    }
  }

  // 7. GigaBridge (needs LazyIMT)
  const gigaBridgeDeploy = await deployFromArtifact(
    "GigaBridge",
    [gigaRootRecipients, GIGA_TREE_DEPTH],
    deployer,
    publicClient,
    { LazyIMT: lazyIMTAddr },
  );

  // 8. Wrap as viem contract handles
  const nativeToken = bindContract(nativeTokenDeploy.address, nativeTokenDeploy.abi, publicClient, deployer);
  const withdrawVerifier = bindContract(verifierDeploy.address, verifierDeploy.abi, publicClient, deployer);
  const l1WarpToad = bindContract(l1WarpToadDeploy.address, l1WarpToadDeploy.abi, publicClient, deployer);
  const gigaBridge = bindContract(gigaBridgeDeploy.address, gigaBridgeDeploy.abi, publicClient, deployer);
  const l1AztecBridgeAdapter = l1AztecAdapterDeploy
    ? bindContract(l1AztecAdapterDeploy.address, l1AztecAdapterDeploy.abi, publicClient, deployer)
    : null;
  const l1ZkStackBridgeAdapters = l1ZkStackAdapterDeploys.map((d) =>
    bindContract(d.address, d.abi, publicClient, deployer),
  );

  // 9. Initialize L1WarpToad for non-Aztec cases (Aztec path does it from setupFullEnvironment).
  if (!opts?.withAztecAdapter) {
    const aztecAddr = opts?.aztecWarptoadAddress ?? 0n;
    const hash = await (l1WarpToad.write.initialize as any)([gigaBridge.address, l1WarpToad.address, aztecAddr]);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  return {
    nativeToken,
    withdrawVerifier,
    l1WarpToad,
    gigaBridge,
    l1AztecBridgeAdapter,
    l1ZkStackBridgeAdapters,
    publicClient,
    deployer,
    wallets: testWallets,
  };
}
