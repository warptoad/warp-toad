// @ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { GIGA_TREE_DEPTH, ZK_STACK_ADAPTER_SLOTS } from "../../../lib/constants.js";
import L1WarpToadModule from "./L1WarpToad.js";

/**
 * Deploys the L1 bridge adapters and GigaBridge on top of L1WarpToad.
 *
 * The L1WarpToad + LazyIMT come from L1WarpToadModule via useModule(), so a
 * single `hardhat ignition deploy L1Infra` brings up the whole L1 stack.
 *
 * GigaBridge's recipient set is decided HERE and can never change afterwards: it
 * assigns recipient indexes in its constructor with no setter, and its address is baked
 * into the one-shot initialize() of L1WarpToad and every adapter. That is why this
 * module deploys ZK_STACK_ADAPTER_SLOTS adapters rather than one per known chain. Every
 * L1ZkStackBridgeAdapter is byte identical until initialized (the constructor takes
 * only the Bridgehub), so an unclaimed slot can later be pointed at any ZK Stack chain
 * on the same Bridgehub with a single initialize() call in L1Wire.
 *
 * Slot order is positional and permanent. See ZK_STACK_CHAINS in lib/constants.ts for
 * which chain claims which slot.
 *
 * Parameters:
 *   bridgehubAddress  ZK Stack Bridgehub on this L1. One address covers every ZK Stack
 *                     chain settling here (see ZK_STACK_BRIDGEHUB_* in constants).
 *
 * Initialize() is NOT called here. Use the L1Wire module after Aztec and the L2s are
 * deployed.
 */
export default buildModule("L1InfraModule", (m: any) => {
  const { L1WarpToad, LazyIMTLib } = m.useModule(L1WarpToadModule);

  const bridgehubAddress = m.getParameter("bridgehubAddress");

  const L1AztecBridgeAdapter = m.contract("L1AztecBridgeAdapter", []);

  const zkStackAdapters = Array.from({ length: ZK_STACK_ADAPTER_SLOTS }, (_, slot) =>
    m.contract("L1ZkStackBridgeAdapter", [bridgehubAddress], {
      id: `L1ZkStackBridgeAdapter_${slot}`,
    }),
  );

  const gigaRootRecipients = [L1WarpToad, L1AztecBridgeAdapter, ...zkStackAdapters];
  const GigaBridge = m.contract("GigaBridge", [gigaRootRecipients, GIGA_TREE_DEPTH], {
    libraries: { LazyIMT: LazyIMTLib },
  });

  // returned as flat named keys (L1ZkStackBridgeAdapter_0, _1, ...) so consumers can
  // index a slot directly; Ignition module results are a flat record of futures.
  const slotResults = Object.fromEntries(
    zkStackAdapters.map((adapter, slot) => [`L1ZkStackBridgeAdapter_${slot}`, adapter]),
  );

  return { GigaBridge, L1AztecBridgeAdapter, L1WarpToad, ...slotResults };
});
