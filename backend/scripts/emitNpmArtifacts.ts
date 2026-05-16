/**
 * Workarounds for two Hardhat 3 gaps around npm-sourced contracts.
 *
 * 1) `solidity.npmFilesToBuild` compiles npm sources into build-info, but
 *    Hardhat 3 only emits per-contract artifact JSON for SOME npm packages.
 *    Scoped ones like `@zk-kit/lazy-imt.sol` end up with an empty
 *    `artifacts/@zk-kit/` dir even though the bytecode is sitting in
 *    build-info. Without these per-contract JSONs, `m.library(name, ...)`
 *    and `hardhat ignition verify` cannot find the contract.
 *
 * 2) The same npm sources also never get an entry in
 *    `build-info/<id>.json` `userSourceNameMap`, which maps user-facing
 *    source names (`@zk-kit/lazy-imt.sol/LazyIMT.sol`) to the internal
 *    versioned keys used in `input.sources` and `output.contracts`
 *    (`npm/@zk-kit/lazy-imt.sol@2.0.0-beta.12/LazyIMT.sol`).
 *    `hardhat-verify` looks up `userSourceNameMap[sourceName]` to find the
 *    output entry; when undefined, it fails with HHE100 "The compiled
 *    contract output was not found in the build info." See
 *    @nomicfoundation/hardhat-verify/dist/src/internal/contract.js
 *    #matchAndBuild.
 *
 * This script does both:
 *   (a) Walks every `build-info/<id>.json` and adds the missing
 *       userSourceNameMap entries for `npm/<pkg>@<ver>/<file>` sources.
 *   (b) Walks every `build-info/<id>.output.json` and emits per-contract
 *       artifact JSONs under `artifacts/<package>/<file.sol>/<Contract>.json`.
 *
 * Both passes are idempotent: existing artifact files and existing
 * userSourceNameMap entries are left untouched. Run after `hardhat compile`
 * (`pnpm b:compile` does both in sequence).
 *
 * Usage:
 *   tsx scripts/emitNpmArtifacts.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");
const ARTIFACTS_DIR = path.join(BACKEND_DIR, "artifacts");
const BUILD_INFO_DIR = path.join(ARTIFACTS_DIR, "build-info");

// Source path format from solc input: `npm/<package>@<ver>/<file.sol>`.
// We strip the `npm/` prefix and the `@<ver>` suffix to recover the
// user-facing artifact path: `<package>/<file.sol>`.
const NPM_PREFIX = "npm/";

function stripNpmVersion(inputSourceName: string): string | null {
  if (!inputSourceName.startsWith(NPM_PREFIX)) return null;
  const rest = inputSourceName.slice(NPM_PREFIX.length);
  // Scoped:  `@scope/name@ver/path/to/file.sol` → strip the SECOND `@…`
  // Unscoped: `name@ver/path/to/file.sol`       → strip the FIRST `@…`
  const m = rest.match(/^(@[^/]+\/[^@/]+|[^@/]+)@[^/]+\/(.+)$/);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function buildArtifact(
  buildInfoId: string,
  inputSourceName: string,
  sourceName: string,
  contractName: string,
  compilerOutput: any,
) {
  return {
    _format: "hh3-artifact-1",
    contractName,
    sourceName,
    inputSourceName,
    buildInfoId,
    abi: compilerOutput.abi ?? [],
    bytecode: "0x" + (compilerOutput.evm?.bytecode?.object ?? ""),
    deployedBytecode: "0x" + (compilerOutput.evm?.deployedBytecode?.object ?? ""),
    linkReferences: compilerOutput.evm?.bytecode?.linkReferences ?? {},
    deployedLinkReferences: compilerOutput.evm?.deployedBytecode?.linkReferences ?? {},
    immutableReferences: compilerOutput.evm?.deployedBytecode?.immutableReferences ?? {},
  };
}

function patchUserSourceNameMap(): { filesPatched: number; entriesAdded: number } {
  const inputFiles = fs
    .readdirSync(BUILD_INFO_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".output.json"));
  let filesPatched = 0;
  let entriesAdded = 0;
  for (const inputFile of inputFiles) {
    const fp = path.join(BUILD_INFO_DIR, inputFile);
    const bi = JSON.parse(fs.readFileSync(fp, "utf8"));
    bi.userSourceNameMap = bi.userSourceNameMap ?? {};
    const sources: Record<string, unknown> = bi.input?.sources ?? {};
    let added = 0;
    for (const internalKey of Object.keys(sources)) {
      if (!internalKey.startsWith(NPM_PREFIX)) continue;
      const userKey = stripNpmVersion(internalKey);
      if (userKey && !(userKey in bi.userSourceNameMap)) {
        bi.userSourceNameMap[userKey] = internalKey;
        added++;
      }
    }
    if (added > 0) {
      // Match Hardhat's build-info format: compact JSON, no indent.
      fs.writeFileSync(fp, JSON.stringify(bi));
      console.log(`  patched ${inputFile} (+${added} userSourceNameMap entries)`);
      filesPatched++;
      entriesAdded += added;
    }
  }
  return { filesPatched, entriesAdded };
}

function main() {
  if (!fs.existsSync(BUILD_INFO_DIR)) {
    console.error(`No build-info dir at ${BUILD_INFO_DIR}; run \`hardhat compile\` first.`);
    process.exit(1);
  }

  // Pass 1: patch userSourceNameMap so `hardhat ignition verify` can resolve
  // npm-sourced contracts. Without this, verify fails with HHE100.
  const { filesPatched, entriesAdded } = patchUserSourceNameMap();
  console.log(
    `userSourceNameMap: patched ${filesPatched} build-info file(s), added ${entriesAdded} npm entries.`,
  );

  const outputFiles = fs.readdirSync(BUILD_INFO_DIR).filter((f) => f.endsWith(".output.json"));
  if (outputFiles.length === 0) {
    console.error("No build-info .output.json files found.");
    process.exit(1);
  }

  // Pass 2: emit per-contract artifact JSONs for npm sources.
  let written = 0;
  let skipped = 0;
  for (const outputFile of outputFiles) {
    const buildInfoId = outputFile.replace(/\.output\.json$/, "");
    // build-info shape is { _format, id, output: { contracts, sources } }.
    const buildInfo = JSON.parse(fs.readFileSync(path.join(BUILD_INFO_DIR, outputFile), "utf8"));
    const contracts = buildInfo?.output?.contracts ?? {};
    for (const [inputSourceName, perFile] of Object.entries(contracts)) {
      const sourceName = stripNpmVersion(inputSourceName);
      if (!sourceName) continue;
      for (const [contractName, contractOutput] of Object.entries(perFile as any)) {
        const fileFolder = path.join(ARTIFACTS_DIR, sourceName);
        const artifactFile = path.join(fileFolder, `${contractName}.json`);
        if (fs.existsSync(artifactFile)) {
          skipped++;
          continue;
        }
        fs.mkdirSync(fileFolder, { recursive: true });
        const artifact = buildArtifact(buildInfoId, inputSourceName, sourceName, contractName, contractOutput);
        fs.writeFileSync(artifactFile, JSON.stringify(artifact, null, 2));
        console.log(`  wrote ${path.relative(BACKEND_DIR, artifactFile)}`);
        written++;
      }
    }
  }
  console.log(`Done: ${written} artifact(s) emitted, ${skipped} already existed.`);
}

main();
