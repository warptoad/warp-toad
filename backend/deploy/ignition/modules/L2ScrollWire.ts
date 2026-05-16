// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import L2ScrollModule from "./L2Scroll.js";

/**
 * Calls L2WarpToad.initialize() on Scroll Sepolia.
 *
 * The WarpToadCore initialize signature is:
 *   initialize(gigaRootProvider, l1BridgeAdapter, aztecWarptoadAddress)
 *
 * For L2WarpToad on Scroll, the gigaRootProvider is its OWN bridge adapter
 * (L2ScrollBridgeAdapter), the l1BridgeAdapter is the L1 Scroll adapter on
 * Sepolia, and the aztecWarptoadAddress is the Aztec WarpToadCore as uint256.
 *
 * Parameters:
 *   l1ScrollBridgeAdapter   L1 Scroll adapter address (from Sepolia deploy)
 *   aztecWarpToadAddress    Aztec WarpToadCore address as uint256
 *
 * Forgetting this step was the source of the "L1->L2 giga sync silently
 * FailedRelayedMessages" bug. Folding it into the Ignition module makes it
 * impossible to skip going forward.
 */
export default buildModule("L2ScrollWireModule", (m: any) => {
  const { L2WarpToad, L2ScrollBridgeAdapter } = m.useModule(L2ScrollModule);

  const l1ScrollBridgeAdapter = m.getParameter("l1ScrollBridgeAdapter");
  const aztecWarpToadAddress = m.getParameter("aztecWarpToadAddress");

  m.call(
    L2WarpToad,
    "initialize",
    [L2ScrollBridgeAdapter, l1ScrollBridgeAdapter, aztecWarpToadAddress],
    { id: "initL2WarpToad" },
  );

  return { L2WarpToad, L2ScrollBridgeAdapter };
});
