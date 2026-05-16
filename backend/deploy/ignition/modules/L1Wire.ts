// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import L1InfraModule from "./L1Infra.js";

/**
 * Wires the L1 stack to its cross-chain counterparts by calling initialize()
 * on every L1 contract that needs Aztec / Scroll addresses baked in.
 *
 * This MUST run AFTER L1Infra has been deployed AND after the Aztec + Scroll
 * deploys have produced the cross-chain addresses below.
 *
 * Parameters:
 *   aztecRegistry          L1 contract address Aztec uses as registry
 *                          (read off `node.getNodeInfo()`)
 *   aztecWarpToadAddress   Aztec WarpToadCore address, encoded as uint256
 *                          (i.e. Fr decimal; the contract takes uint256, not
 *                          bytes32)
 *   l2AztecAdapterBytes32  Aztec L2AztecBridgeAdapter address, padded to bytes32
 *   l2ScrollAdapter        Address of L2ScrollBridgeAdapter on Scroll Sepolia
 *
 * Ignition tracks each m.call separately, so if a re-run finds a call
 * already completed it's a no-op. Combined with the contracts' own
 * `require(isInitialized == false, ...)` guards, this is safe to re-run.
 */
export default buildModule("L1WireModule", (m: any) => {
  const { L1WarpToad, L1AztecBridgeAdapter, L1ScrollBridgeAdapter, GigaBridge } =
    m.useModule(L1InfraModule);

  const aztecRegistry = m.getParameter("aztecRegistry");
  const aztecWarpToadAddress = m.getParameter("aztecWarpToadAddress");
  const l2AztecAdapterBytes32 = m.getParameter("l2AztecAdapterBytes32");
  const l2ScrollAdapter = m.getParameter("l2ScrollAdapter");

  m.call(L1WarpToad, "initialize", [GigaBridge, L1WarpToad, aztecWarpToadAddress], {
    id: "initL1WarpToad",
  });

  m.call(
    L1AztecBridgeAdapter,
    "initialize",
    [aztecRegistry, l2AztecAdapterBytes32, GigaBridge],
    { id: "initL1AztecBridgeAdapter" },
  );

  m.call(L1ScrollBridgeAdapter, "initialize", [l2ScrollAdapter, GigaBridge], {
    id: "initL1ScrollBridgeAdapter",
  });

  return { L1WarpToad, L1AztecBridgeAdapter, L1ScrollBridgeAdapter, GigaBridge };
});
