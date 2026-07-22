// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { EVM_TREE_DEPTH } from "../../../lib/constants.js";
import TestTokenModule from "./TestToken.js";
import { loadNpmArtifact } from "./_loadNpmArtifact.js";

// Same Hardhat 3 scoped-npm-artifact bug as in L1WarpToad. See _loadNpmArtifact.ts.
const LAZY_IMT_ARTIFACT = loadNpmArtifact("@zk-kit/lazy-imt.sol", "LazyIMT.sol", "LazyIMT");

/**
 * Deploys the L2 stack on a ZK Stack chain: libs, verifier, L2WarpToad, and the
 * L2ZkStackBridgeAdapter that pairs with an L1ZkStackBridgeAdapter slot on Sepolia.
 *
 * Replaces L2Scroll.ts. Deliberately NOT named per-chain: the exact same module is
 * deployed to every ZK Stack chain, each into its own chain-<id> deployment dir, so the
 * deployment keys are `L2ZkStackModule#L2WarpToad` etc. everywhere. Nothing here is
 * Era-specific.
 *
 * The L2 adapter needs no messenger address: L1Messenger is a system contract at a
 * fixed address on every ZK Stack chain, so the adapter hardcodes it.
 *
 * Native token (USDcoin) is freshly deployed via useModule.
 *
 * Parameters:
 *   PoseidonT3LibAddress     deterministic PoseidonT3 address on this L2
 *                            (orchestrator deploys it before this module)
 *   L1ZkStackBridgeAdapter   L1 adapter slot claimed for THIS chain, from the Sepolia
 *                            deploy. Wrong slot here means the alias check in
 *                            receiveGigaRoot rejects every giga root, silently.
 *
 * L2WarpToad.initialize() is NOT called here. Use L2ZkStackWire after L1 + Aztec
 * deploys are settled so the cross-chain addresses can be wired in.
 */
export default buildModule("L2ZkStackModule", (m: any) => {
  const { USDcoin } = m.useModule(TestTokenModule);

  const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
  const L1ZkStackBridgeAdapterAddress = m.getParameter("L1ZkStackBridgeAdapter");

  const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress);

  const LazyIMTLib = m.library("LazyIMT", LAZY_IMT_ARTIFACT, {
    libraries: { PoseidonT3: PoseidonT3Lib },
  });

  const ZKTranscriptLib = m.library("ZKTranscriptLib");
  const RelationsLib = m.library("RelationsLib");

  const WithdrawVerifier = m.contract("HonkVerifier", [], {
    libraries: { ZKTranscriptLib, RelationsLib },
  });

  const L2WarpToad = m.contract(
    "L2WarpToad",
    [EVM_TREE_DEPTH, WithdrawVerifier, USDcoin, "wrpToad-USD Coin", "wrpToad-USDC"],
    { libraries: { LazyIMT: LazyIMTLib, PoseidonT3: PoseidonT3Lib } },
  );

  const L2ZkStackBridgeAdapter = m.contract(
    "L2ZkStackBridgeAdapter",
    [L1ZkStackBridgeAdapterAddress, L2WarpToad],
  );

  return { L2WarpToad, WithdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ZkStackBridgeAdapter, USDcoin };
});
