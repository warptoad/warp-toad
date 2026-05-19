import { createPublicClient, http, getAddress, type Address } from "viem";
import { sepolia, scrollSepolia } from "viem/chains";
import fs from "node:fs";
import path from "node:path";

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
const SCROLL_RPC = process.env.SCROLL_SEPOLIA_RPC_URL;
if (!SEPOLIA_RPC || !SCROLL_RPC) throw new Error("set SEPOLIA_RPC_URL + SCROLL_SEPOLIA_RPC_URL");

const root = path.resolve(import.meta.dirname, "..", "..");
const sepDep = JSON.parse(fs.readFileSync(path.join(root, "backend/deploy/ignition/deployments/chain-11155111/deployed_addresses.json"), "utf-8"));
const scrDep = JSON.parse(fs.readFileSync(path.join(root, "backend/deploy/ignition/deployments/chain-534351/deployed_addresses.json"), "utf-8"));
const aztecDep = JSON.parse(fs.readFileSync(path.join(root, "backend/deploy/aztec/aztecDeployments/11155111/deployed_addresses.json"), "utf-8"));

const sep = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
const scr = createPublicClient({ chain: scrollSepolia, transport: http(SCROLL_RPC) });

const expected = {
  sepolia: {
    L1WarpToad: sepDep["L1WarpToadModule#L1WarpToad"] as Address,
    HonkVerifier: sepDep["L1WarpToadModule#HonkVerifier"] as Address,
    L1AztecBridgeAdapter: sepDep["L1InfraModule#L1AztecBridgeAdapter"] as Address,
    L1ScrollBridgeAdapter: sepDep["L1InfraModule#L1ScrollBridgeAdapter"] as Address,
    GigaBridge: sepDep["L1InfraModule#GigaBridge"] as Address,
    USDcoin: sepDep["TestToken#USDcoin"] as Address,
  },
  scroll: {
    L2WarpToad: scrDep["L2ScrollModule#L2WarpToad"] as Address,
    HonkVerifier: scrDep["L2ScrollModule#HonkVerifier"] as Address,
    L2ScrollBridgeAdapter: scrDep["L2ScrollModule#L2ScrollBridgeAdapter"] as Address,
    USDcoin: scrDep["TestToken#USDcoin"] as Address,
  },
  aztec: {
    WarpToad: aztecDep.AztecWarpToad.address as string,
    BridgeAdapter: aztecDep.L2AztecBridgeAdapter.address as string,
  },
};

const aztecWarpAsUint = BigInt(expected.aztec.WarpToad);
const aztecAdapterAsBytes32 = expected.aztec.BridgeAdapter.toLowerCase();

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, actual: string | bigint | boolean, want: string | bigint | boolean) => {
  const a = typeof actual === "string" ? actual.toLowerCase() : actual;
  const w = typeof want === "string" ? want.toLowerCase() : want;
  results.push({ name, pass: a === w, detail: a === w ? String(actual) : `got ${actual}, want ${want}` });
};

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

const scrollAdapterL1Abi = [
  { type: "function", name: "gigaBridge", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "l2ScrollBridgeAdapter", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const gigaAbi = [
  { type: "function", name: "isLocalRootProviders", inputs: [{ type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "amountOfLocalRoots", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

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
  results.push({ name: "L1AztecBridgeAdapter.rollup != 0 (registry resolved)", pass: rollup !== "0x0000000000000000000000000000000000000000", detail: rollup });
}

console.log("=== Sepolia: L1ScrollBridgeAdapter ===");
{
  const a = { address: expected.sepolia.L1ScrollBridgeAdapter, abi: scrollAdapterL1Abi } as const;
  check("L1ScrollBridgeAdapter.gigaBridge == GigaBridge", await sep.readContract({ ...a, functionName: "gigaBridge" }), expected.sepolia.GigaBridge);
  check("L1ScrollBridgeAdapter.l2ScrollBridgeAdapter == scroll L2 adapter", await sep.readContract({ ...a, functionName: "l2ScrollBridgeAdapter" }), expected.scroll.L2ScrollBridgeAdapter);
}

console.log("=== Sepolia: GigaBridge ===");
{
  const a = { address: expected.sepolia.GigaBridge, abi: gigaAbi } as const;
  for (const [name, addr] of [
    ["L1WarpToad", expected.sepolia.L1WarpToad],
    ["L1AztecBridgeAdapter", expected.sepolia.L1AztecBridgeAdapter],
    ["L1ScrollBridgeAdapter", expected.sepolia.L1ScrollBridgeAdapter],
  ] as const) {
    check(`GigaBridge.isLocalRootProviders(${name})`, await sep.readContract({ ...a, functionName: "isLocalRootProviders", args: [addr] }), true);
  }
  const count = await sep.readContract({ ...a, functionName: "amountOfLocalRoots" });
  results.push({ name: "GigaBridge.amountOfLocalRoots", pass: count === 3n, detail: String(count) });
}

console.log("=== Scroll Sepolia: L2WarpToad ===");
{
  const a = { address: expected.scroll.L2WarpToad, abi: wtAbi } as const;
  check("L2WarpToad.gigaRootProvider == L2ScrollBridgeAdapter", await scr.readContract({ ...a, functionName: "gigaRootProvider" }), expected.scroll.L2ScrollBridgeAdapter);
  check("L2WarpToad.l1BridgeAdapter == L1ScrollBridgeAdapter (Sepolia)", await scr.readContract({ ...a, functionName: "l1BridgeAdapter" }), expected.sepolia.L1ScrollBridgeAdapter);
  check("L2WarpToad.aztecWarptoadAddress == AztecWarpToad", await scr.readContract({ ...a, functionName: "aztecWarptoadAddress" }), aztecWarpAsUint);
  check("L2WarpToad.withdrawVerifier == HonkVerifier (Scroll)", await scr.readContract({ ...a, functionName: "withdrawVerifier" }), expected.scroll.HonkVerifier);
  check("L2WarpToad.nativeToken == USDcoin (Scroll)", await scr.readContract({ ...a, functionName: "nativeToken" }), expected.scroll.USDcoin);
}

console.log("\n=== Results ===");
let fails = 0;
for (const r of results) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.name}  (${r.detail})`);
  if (!r.pass) fails++;
}
console.log(`\n${results.length - fails}/${results.length} passed`);

console.log("\n=== Aztec contracts (verify manually) ===");
console.log(`  AztecWarpToad         ${expected.aztec.WarpToad}`);
console.log(`  L2AztecBridgeAdapter  ${expected.aztec.BridgeAdapter}`);
console.log(`  AztecWarpToad.nativeToken constructor arg: ${aztecDep.AztecWarpToad.constructorArgs[0]}  (== ${expected.sepolia.USDcoin}?)`);
console.log(`  L2AztecBridgeAdapter.l1Adapter constructor arg: ${aztecDep.L2AztecBridgeAdapter.constructorArgs[0]}  (== ${expected.sepolia.L1AztecBridgeAdapter}?)`);

process.exit(fails > 0 ? 1 : 0);
