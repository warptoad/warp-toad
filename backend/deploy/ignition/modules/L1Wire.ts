// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ZK_STACK_CHAINS } from "../../../lib/constants.js";
import L1InfraModule from "./L1Infra.js";

/**
 * Wires the L1 stack to its cross-chain counterparts by calling initialize()
 * on every L1 contract that needs Aztec / L2 addresses baked in.
 *
 * This MUST run AFTER L1Infra has been deployed AND after the Aztec + L2 deploys have
 * produced the cross-chain addresses below.
 *
 * Only the ZK Stack slots listed in ZK_STACK_CHAINS get initialized. Spare slots are
 * left untouched on purpose: an uninitialized adapter cannot bridge and reverts on
 * getLocalRootAndBlock(), which is exactly what we want until a chain claims it.
 * Claiming a spare later means appending to ZK_STACK_CHAINS and re-running this module,
 * which is a no-op for the slots already done.
 *
 * Parameters:
 *   aztecRegistry            L1 contract address Aztec uses as registry
 *                            (read off `node.getNodeInfo()`)
 *   aztecWarpToadAddress     Aztec WarpToadCore address, encoded as uint256
 *                            (i.e. Fr decimal; the contract takes uint256, not bytes32)
 *   l2AztecAdapterBytes32    Aztec L2AztecBridgeAdapter address, padded to bytes32
 *   l2ZkStackAdapter_<slot>  Address of L2ZkStackBridgeAdapter on the chain claiming
 *                            that slot, one parameter per entry in ZK_STACK_CHAINS
 *
 * Ignition tracks each m.call separately, so if a re-run finds a call
 * already completed it's a no-op. Combined with the contracts' own
 * `require(isInitialized == false, ...)` guards, this is safe to re-run.
 */
export default buildModule("L1WireModule", (m: any) => {
  const infra = m.useModule(L1InfraModule);
  const { L1WarpToad, L1AztecBridgeAdapter, GigaBridge } = infra;

  const aztecRegistry = m.getParameter("aztecRegistry");
  const aztecWarpToadAddress = m.getParameter("aztecWarpToadAddress");
  const l2AztecAdapterBytes32 = m.getParameter("l2AztecAdapterBytes32");

  m.call(L1WarpToad, "initialize", [GigaBridge, L1WarpToad, aztecWarpToadAddress], {
    id: "initL1WarpToad",
  });

  m.call(
    L1AztecBridgeAdapter,
    "initialize",
    [aztecRegistry, l2AztecAdapterBytes32, GigaBridge],
    { id: "initL1AztecBridgeAdapter" },
  );

  for (const { slot, chainId } of ZK_STACK_CHAINS) {
    const adapter = infra[`L1ZkStackBridgeAdapter_${slot}`];
    const l2Adapter = m.getParameter(`l2ZkStackAdapter_${slot}`);

    m.call(adapter, "initialize", [chainId, l2Adapter, GigaBridge], {
      id: `initL1ZkStackBridgeAdapter_${slot}`,
    });
  }

  return { L1WarpToad, L1AztecBridgeAdapter, GigaBridge };
});
