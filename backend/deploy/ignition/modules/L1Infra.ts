// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { GIGA_TREE_DEPTH } from "../../../lib/constants.js";
import L1WarpToadModule from "./L1WarpToad.js";

/**
 * Deploys the L1 bridge adapters and GigaBridge on top of L1WarpToad.
 *
 * The L1WarpToad + LazyIMT come from L1WarpToadModule via useModule(), so a
 * single `hardhat ignition deploy L1Infra` brings up the whole L1 stack.
 *
 * Parameters:
 *   L1ScrollMessengerAddress  L1 messenger contract for Scroll (network-
 *                             specific constant; see backend/lib/constants.ts).
 *
 * Initialize() is NOT called here. Use the L1Wire module after Aztec and
 * Scroll are deployed.
 */
export default buildModule("L1InfraModule", (m: any) => {
  const { L1WarpToad, LazyIMTLib } = m.useModule(L1WarpToadModule);

  const L1ScrollMessengerAddress = m.getParameter("L1ScrollMessengerAddress");

  const L1AztecBridgeAdapter = m.contract("L1AztecBridgeAdapter", []);
  const L1ScrollBridgeAdapter = m.contract("L1ScrollBridgeAdapter", [L1ScrollMessengerAddress]);

  const gigaRootRecipients = [L1WarpToad, L1AztecBridgeAdapter, L1ScrollBridgeAdapter];
  const GigaBridge = m.contract("GigaBridge", [gigaRootRecipients, GIGA_TREE_DEPTH], {
    libraries: { LazyIMT: LazyIMTLib },
  });

  return { GigaBridge, L1AztecBridgeAdapter, L1ScrollBridgeAdapter, L1WarpToad };
});
