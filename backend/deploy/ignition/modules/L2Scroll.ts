// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { EVM_TREE_DEPTH } from "../../../lib/constants.js";
import TestTokenModule from "./TestToken.js";
import { loadNpmArtifact } from "./_loadNpmArtifact.js";

// Same Hardhat 3 scoped-npm-artifact bug as in L1WarpToad. See _loadNpmArtifact.ts.
const LAZY_IMT_ARTIFACT = loadNpmArtifact("@zk-kit/lazy-imt.sol", "LazyIMT.sol", "LazyIMT");

/**
 * Deploys the L2 (Scroll Sepolia) stack: libs, verifier, L2WarpToad, and the
 * L2ScrollBridgeAdapter that pairs with L1ScrollBridgeAdapter.
 *
 * Native token (USDcoin) is freshly deployed on Scroll via useModule.
 *
 * Parameters:
 *   PoseidonT3LibAddress         deterministic PoseidonT3 address on Scroll
 *                                (orchestrator deploys it before this module)
 *   L1ScrollBridgeAdapter        L1 adapter address (passed across from chain-11155111)
 *   l2ScrollMessengerAddress     L2 messenger constant for Scroll Sepolia
 *
 * L2WarpToad.initialize() is NOT called here. Use L2ScrollWire after L1 +
 * Aztec deploys are settled so the cross-chain addresses can be wired in.
 */
export default buildModule("L2ScrollModule", (m: any) => {
  const { USDcoin } = m.useModule(TestTokenModule);

  const PoseidonT3LibAddress = m.getParameter("PoseidonT3LibAddress");
  const L1ScrollBridgeAdapterAddress = m.getParameter("L1ScrollBridgeAdapter");
  const l2ScrollMessengerAddress = m.getParameter("l2ScrollMessengerAddress");

  const PoseidonT3Lib = m.contractAt("PoseidonT3", PoseidonT3LibAddress);

  const LazyIMTLib = m.library("LazyIMT", LAZY_IMT_ARTIFACT, {
    libraries: { PoseidonT3: PoseidonT3Lib },
  });

  const ZKTranscriptLib = m.library("ZKTranscriptLib");
  const RelationsLib = m.library("RelationsLib");

  const WithdrawVerifier = m.contract("HonkVerifier", [], {
    libraries: { ZKTranscriptLib, RelationsLib },
  });

  // USDcoin: name="USD Coin", symbol="USDC". The previous hand-rolled deploy
  // had name/symbol swapped, which made MetaMask wallet_watchAsset reject the
  // token (symbol didn't match what users expected). Fixed here.
  const L2WarpToad = m.contract(
    "L2WarpToad",
    [EVM_TREE_DEPTH, WithdrawVerifier, USDcoin, "wrpToad-USD Coin", "wrpToad-USDC"],
    { libraries: { LazyIMT: LazyIMTLib, PoseidonT3: PoseidonT3Lib } },
  );

  const L2ScrollBridgeAdapter = m.contract(
    "L2ScrollBridgeAdapter",
    [l2ScrollMessengerAddress, L1ScrollBridgeAdapterAddress, L2WarpToad],
  );

  return { L2WarpToad, WithdrawVerifier, PoseidonT3Lib, LazyIMTLib, L2ScrollBridgeAdapter, USDcoin };
});
