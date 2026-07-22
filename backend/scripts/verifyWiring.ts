import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "viem/chains";
import fs from "node:fs";
import path from "node:path";

import { ZK_STACK_ADAPTER_SLOTS, ZK_STACK_CHAINS } from "../lib/constants.js";
import {
  ZK_STACK_TARGETS,
  assertZkStackRegistryConsistent,
  unclaimedZkStackSlots,
} from "../lib/zkStackChains.js";

assertZkStackRegistryConsistent();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
if (!SEPOLIA_RPC) throw new Error("set SEPOLIA_RPC_URL");

const root = path.resolve(import.meta.dirname, "..", "..");
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf-8"));

const sepDep = readJson("backend/deploy/ignition/deployments/chain-11155111/deployed_addresses.json");
const aztecDep = readJson("backend/deploy/aztec/aztecDeployments/11155111/deployed_addresses.json");

const sep = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });

const expected = {
  sepolia: {
    L1WarpToad: sepDep["L1WarpToadModule#L1WarpToad"] as Address,
    HonkVerifier: sepDep["L1WarpToadModule#HonkVerifier"] as Address,
    L1AztecBridgeAdapter: sepDep["L1InfraModule#L1AztecBridgeAdapter"] as Address,
    GigaBridge: sepDep["L1InfraModule#GigaBridge"] as Address,
    USDcoin: sepDep["TestToken#USDcoin"] as Address,
  },
  aztec: {
    WarpToad: aztecDep.AztecWarpToad.address as string,
    BridgeAdapter: aztecDep.L2AztecBridgeAdapter.address as string,
  },
};

const zkSlotAddress = (slot: number) =>
  sepDep[`L1InfraModule#L1ZkStackBridgeAdapter_${slot}`] as Address;

const aztecWarpAsUint = BigInt(expected.aztec.WarpToad);
const aztecAdapterAsBytes32 = expected.aztec.BridgeAdapter.toLowerCase();

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, actual: string | bigint | boolean, want: string | bigint | boolean) => {
  const a = typeof actual === "string" ? actual.toLowerCase() : actual;
  const w = typeof want === "string" ? want.toLowerCase() : want;
  results.push({ name, pass: a === w, detail: a === w ? String(actual) : `got ${actual}, want ${want}` });
};
const record = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

const wtAbi = [
  { type: "function", name: "gigaRootProvider", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l1BridgeAdapter", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "aztecWarptoadAddress", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "withdrawVerifier", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "nativeToken", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const aztecAdapterL1Abi = [
  { type: "function", name: "gigaBridge", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l2AztecBridgeAdapter", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { type: "function", name: "rollup", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const zkStackAdapterL1Abi = [
  { type: "function", name: "gigaBridge", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l2ZkStackBridgeAdapter", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l2ChainId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "bridgehub", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const zkStackAdapterL2Abi = [
  { type: "function", name: "l1ZkStackBridgeAdapter", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l1ZkStackBridgeAdapterAliased", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l2WarpToad", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const gigaAbi = [
  { type: "function", name: "isLocalRootProviders", inputs: [{ type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "amountOfLocalRoots", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const ALIAS_OFFSET = BigInt("0x1111000000000000000000000000000000001111");
const applyL1ToL2Alias = (addr: Address): Address =>
  `0x${((BigInt(addr) + ALIAS_OFFSET) % (1n << 160n)).toString(16).padStart(40, "0")}` as Address;

console.log("=== Sepolia: L1WarpToad ===");
{
  const a = { address: expected.sepolia.L1WarpToad, abi: wtAbi } as const;
  check("L1WarpToad.gigaRootProvider == GigaBridge", await sep.readContract({ ...a, functionName: "gigaRootProvider" }), expected.sepolia.GigaBridge);
  check("L1WarpToad.l1BridgeAdapter == L1WarpToad (self)", await sep.readContract({ ...a, functionName: "l1BridgeAdapter" }), expected.sepolia.L1WarpToad);
  check("L1WarpToad.aztecWarptoadAddress == AztecWarpToad", await sep.readContract({ ...a, functionName: "aztecWarptoadAddress" }), aztecWarpAsUint);
  check("L1WarpToad.withdrawVerifier == HonkVerifier", await sep.readContract({ ...a, functionName: "withdrawVerifier" }), expected.sepolia.HonkVerifier);
  check("L1WarpToad.nativeToken == USDcoin", await sep.readContract({ ...a, functionName: "nativeToken" }), expected.sepolia.USDcoin);
}

console.log("=== Sepolia: L1AztecBridgeAdapter ===");
{
  const a = { address: expected.sepolia.L1AztecBridgeAdapter, abi: aztecAdapterL1Abi } as const;
  check("L1AztecBridgeAdapter.gigaBridge == GigaBridge", await sep.readContract({ ...a, functionName: "gigaBridge" }), expected.sepolia.GigaBridge);
  check("L1AztecBridgeAdapter.l2AztecBridgeAdapter == aztec L2 adapter", await sep.readContract({ ...a, functionName: "l2AztecBridgeAdapter" }), aztecAdapterAsBytes32);
  const rollup = await sep.readContract({ ...a, functionName: "rollup" });
  record("L1AztecBridgeAdapter.rollup != 0 (registry resolved)", rollup !== "0x0000000000000000000000000000000000000000", rollup);
}

// Claimed ZK Stack slots: L1 side wired, and the L2 counterpart agrees.
for (const target of ZK_STACK_TARGETS) {
  const l1Adapter = zkSlotAddress(target.slot);
  console.log(`=== Sepolia: L1ZkStackBridgeAdapter_${target.slot} (${target.label}) ===`);
  const a = { address: l1Adapter, abi: zkStackAdapterL1Abi } as const;
  check(`slot ${target.slot}.gigaBridge == GigaBridge`, await sep.readContract({ ...a, functionName: "gigaBridge" }), expected.sepolia.GigaBridge);
  check(`slot ${target.slot}.l2ChainId == ${target.chainId}`, await sep.readContract({ ...a, functionName: "l2ChainId" }), BigInt(target.chainId));

  const l1SaysL2Adapter = await sep.readContract({ ...a, functionName: "l2ZkStackBridgeAdapter" }) as Address;

  const depFile = `backend/deploy/ignition/deployments/chain-${target.chainId}/deployed_addresses.json`;
  if (!fs.existsSync(path.join(root, depFile))) {
    record(`${target.label} deployment dir present`, false, `missing ${depFile}`);
    continue;
  }
  const l2Dep = readJson(depFile);
  const l2Adapter = l2Dep["L2ZkStackModule#L2ZkStackBridgeAdapter"] as Address;
  const l2WarpToad = l2Dep["L2ZkStackModule#L2WarpToad"] as Address;
  const l2Verifier = l2Dep["L2ZkStackModule#HonkVerifier"] as Address;
  const l2Usdc = l2Dep["TestToken#USDcoin"] as Address;

  check(`slot ${target.slot}.l2ZkStackBridgeAdapter == ${target.label} L2 adapter`, l1SaysL2Adapter, l2Adapter);

  const rpc = process.env[target.rpcEnv] ?? target.viemChain.rpcUrls.default.http[0];
  const l2 = createPublicClient({ chain: target.viemChain, transport: http(rpc) });

  console.log(`=== ${target.label}: L2ZkStackBridgeAdapter ===`);
  {
    const b = { address: l2Adapter, abi: zkStackAdapterL2Abi } as const;
    check(`L2 adapter.l1ZkStackBridgeAdapter == slot ${target.slot}`, await l2.readContract({ ...b, functionName: "l1ZkStackBridgeAdapter" }), l1Adapter);
    // The alias is the entire auth check for inbound giga roots; if the cached value
    // is wrong, every L1->L2 sync silently reverts on the L2 side.
    check(`L2 adapter.l1ZkStackBridgeAdapterAliased == alias(slot ${target.slot})`, await l2.readContract({ ...b, functionName: "l1ZkStackBridgeAdapterAliased" }), applyL1ToL2Alias(l1Adapter));
    check("L2 adapter.l2WarpToad == L2WarpToad", await l2.readContract({ ...b, functionName: "l2WarpToad" }), l2WarpToad);
  }

  console.log(`=== ${target.label}: L2WarpToad ===`);
  {
    const b = { address: l2WarpToad, abi: wtAbi } as const;
    check("L2WarpToad.gigaRootProvider == L2ZkStackBridgeAdapter", await l2.readContract({ ...b, functionName: "gigaRootProvider" }), l2Adapter);
    check("L2WarpToad.l1BridgeAdapter == L1 slot adapter (Sepolia)", await l2.readContract({ ...b, functionName: "l1BridgeAdapter" }), l1Adapter);
    check("L2WarpToad.aztecWarptoadAddress == AztecWarpToad", await l2.readContract({ ...b, functionName: "aztecWarptoadAddress" }), aztecWarpAsUint);
    check("L2WarpToad.withdrawVerifier == HonkVerifier (L2)", await l2.readContract({ ...b, functionName: "withdrawVerifier" }), l2Verifier);
    check("L2WarpToad.nativeToken == USDcoin (L2)", await l2.readContract({ ...b, functionName: "nativeToken" }), l2Usdc);
  }
}

// Spare slots must be registered with GigaBridge but NOT initialized. An initialized
// spare would mean a slot got claimed without the registry knowing.
console.log("=== Sepolia: unclaimed ZK Stack slots ===");
for (const slot of unclaimedZkStackSlots()) {
  const addr = zkSlotAddress(slot);
  if (!addr) {
    record(`slot ${slot} deployed`, false, "missing from deployed_addresses.json");
    continue;
  }
  const chainId = await sep.readContract({ address: addr, abi: zkStackAdapterL1Abi, functionName: "l2ChainId" }) as bigint;
  record(`slot ${slot} is an unclaimed spare (l2ChainId == 0)`, chainId === 0n, chainId === 0n ? `${addr} unclaimed` : `${addr} claimed by chain ${chainId} but not in ZK_STACK_CHAINS`);
}

console.log("=== Sepolia: GigaBridge ===");
{
  const a = { address: expected.sepolia.GigaBridge, abi: gigaAbi } as const;
  const recipients: [string, Address][] = [
    ["L1WarpToad", expected.sepolia.L1WarpToad],
    ["L1AztecBridgeAdapter", expected.sepolia.L1AztecBridgeAdapter],
    ...Array.from({ length: ZK_STACK_ADAPTER_SLOTS }, (_, slot) =>
      [`L1ZkStackBridgeAdapter_${slot}`, zkSlotAddress(slot)] as [string, Address],
    ),
  ];
  for (const [name, addr] of recipients) {
    check(`GigaBridge.isLocalRootProviders(${name})`, await sep.readContract({ ...a, functionName: "isLocalRootProviders", args: [addr] }), true);
  }
  // 2 fixed recipients (L1WarpToad, Aztec) plus every ZK Stack slot, spares included.
  const want = BigInt(2 + ZK_STACK_ADAPTER_SLOTS);
  const count = await sep.readContract({ ...a, functionName: "amountOfLocalRoots" });
  record("GigaBridge.amountOfLocalRoots", count === want, `${count} (want ${want})`);
}

console.log("\n=== Results ===");
let fails = 0;
for (const r of results) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.name}  (${r.detail})`);
  if (!r.pass) fails++;
}
console.log(`\n${results.length - fails}/${results.length} passed`);
console.log(`\nClaimed ZK Stack slots: ${ZK_STACK_CHAINS.map((c) => `${c.slot}=${c.name}`).join(", ") || "(none)"}`);
console.log(`Unclaimed spares:       ${unclaimedZkStackSlots().join(", ") || "(none)"}`);

console.log("\n=== Aztec contracts (verify manually) ===");
console.log(`  AztecWarpToad         ${expected.aztec.WarpToad}`);
console.log(`  L2AztecBridgeAdapter  ${expected.aztec.BridgeAdapter}`);
console.log(`  AztecWarpToad.nativeToken constructor arg: ${aztecDep.AztecWarpToad.constructorArgs[0]}  (== ${expected.sepolia.USDcoin}?)`);
console.log(`  L2AztecBridgeAdapter.l1Adapter constructor arg: ${aztecDep.L2AztecBridgeAdapter.constructorArgs[0]}  (== ${expected.sepolia.L1AztecBridgeAdapter}?)`);

process.exit(fails > 0 ? 1 : 0);
