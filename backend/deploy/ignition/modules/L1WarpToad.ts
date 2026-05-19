// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { EVM_TREE_DEPTH } from "../../../lib/constants.js";
import TestTokenModule from "./TestToken.js";
import { loadNpmArtifact } from "./_loadNpmArtifact.js";

// Hardhat 3 fails to emit per-file artifacts for scoped npm packages
// (@zk-kit/lazy-imt.sol). We load LazyIMT directly from build-info via the
// m.library(name, artifact, options) overload to bypass that bug.
const LAZY_IMT_ARTIFACT = loadNpmArtifact("@zk-kit/lazy-imt.sol", "LazyIMT.sol", "LazyIMT");

/**
 * Deploys the L1 WarpToad core: poseidon (linked from a pre-deployed address),
 * LazyIMT, ZKTranscriptLib, the HonkVerifier, and L1WarpToad itself.
 *
 * The native token (USDcoin) is pulled in via `m.useModule(TestTokenModule)`,
 * so a fresh deploy on a clean chain transitively deploys the token too.
 *
 * Parameters:
 *   PoseidonT3LibAddress  Address of the deterministic PoseidonT3 (Nick's
 *                         method via poseidon-solidity, deployed by the
 *                         orchestrator before this module runs).
 *
 * Initialize() is NOT called here. Use the L1Wire module after Aztec and
 * Scroll are deployed so the cross-chain pointers can be wired in.
 */
export default buildModule("L1WarpToadModule", (m: any) => {
  const { USDcoin } = m.useModule(TestTokenModule);

  const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
  const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress);

  const LazyIMTLib = m.library("LazyIMT", LAZY_IMT_ARTIFACT, {
    libraries: { PoseidonT3: PoseidonT3Lib },
  });

  const ZKTranscriptLib = m.library("ZKTranscriptLib");
  const RelationsLib = m.library("RelationsLib");

  const WithdrawVerifier = m.contract("HonkVerifier", [], {
    libraries: { ZKTranscriptLib, RelationsLib },
  });

  // USDcoin is hardcoded as name="USD Coin", symbol="USDC".
  const L1WarpToad = m.contract(
    "L1WarpToad",
    [EVM_TREE_DEPTH, WithdrawVerifier, USDcoin, "wrpToad-USD Coin", "wrpToad-USDC"],
    { libraries: { LazyIMT: LazyIMTLib, PoseidonT3: PoseidonT3Lib } },
  );

  return { L1WarpToad, WithdrawVerifier, PoseidonT3Lib, LazyIMTLib, USDcoin };
});
