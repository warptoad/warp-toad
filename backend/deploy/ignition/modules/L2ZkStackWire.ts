// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import L2ZkStackModule from "./L2ZkStack.js";

/**
 * Calls L2WarpToad.initialize() on a ZK Stack chain. Replaces L2ScrollWire.ts.
 *
 * The WarpToadCore initialize signature is:
 *   initialize(gigaRootProvider, l1BridgeAdapter, aztecWarptoadAddress)
 *
 * For L2WarpToad here, the gigaRootProvider is its OWN bridge adapter
 * (L2ZkStackBridgeAdapter), the l1BridgeAdapter is the L1 adapter slot claimed for this
 * chain on Sepolia, and the aztecWarptoadAddress is the Aztec WarpToadCore as uint256.
 *
 * Parameters:
 *   l1ZkStackBridgeAdapter  L1 adapter address for THIS chain (from the Sepolia deploy)
 *   aztecWarpToadAddress    Aztec WarpToadCore address as uint256
 *
 * Forgetting this step was the source of the "L1->L2 giga sync silently
 * FailedRelayedMessages" bug on Scroll. Folding it into the Ignition module makes it
 * impossible to skip going forward.
 */
export default buildModule("L2ZkStackWireModule", (m: any) => {
  const { L2WarpToad, L2ZkStackBridgeAdapter } = m.useModule(L2ZkStackModule);

  const l1ZkStackBridgeAdapter = m.getParameter("l1ZkStackBridgeAdapter");
  const aztecWarpToadAddress = m.getParameter("aztecWarpToadAddress");

  m.call(
    L2WarpToad,
    "initialize",
    [L2ZkStackBridgeAdapter, l1ZkStackBridgeAdapter, aztecWarpToadAddress],
    { id: "initL2WarpToad" },
  );

  return { L2WarpToad, L2ZkStackBridgeAdapter };
});
