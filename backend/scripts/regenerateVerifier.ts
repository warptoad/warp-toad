import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(here, "..", "..");
const circuitPath = path.join(repoRoot, "backend/circuits/withdraw/target/withdraw.json");
const verifierOut = path.join(repoRoot, "backend/contracts/verifier/WithdrawVerifier.sol");

const circuit = JSON.parse(fs.readFileSync(circuitPath, "utf-8"));

const threads = os.cpus().length;
console.log(`bb.js WASM, threads=${threads}`);
const api = await Barretenberg.new({ threads });
const backend = new UltraHonkBackend(circuit.bytecode, api);

console.log("getVerificationKey({ keccakZK: true })...");
const vk = await backend.getVerificationKey({ keccakZK: true });
console.log("vk bytes:", vk.length);

console.log("getSolidityVerifier(vk, { keccakZK: true })...");
const verifierSol = await backend.getSolidityVerifier(vk, { keccakZK: true });
console.log("verifier bytes:", verifierSol.length);

fs.writeFileSync(verifierOut, verifierSol);
console.log("wrote", verifierOut);

await api.destroy();
process.exit(0);
