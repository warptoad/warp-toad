/**
 * Load an artifact for an npm-package contract directly from Hardhat's
 * build-info, bypassing the broken per-contract artifact emission for
 * scoped npm packages in Hardhat 3.
 *
 * Hardhat 3 reliably emits per-file artifacts for unscoped npm packages
 * (e.g., poseidon-solidity/PoseidonT3.sol → artifacts/poseidon-solidity/...)
 * but creates empty directories for scoped packages
 * (e.g., @zk-kit/lazy-imt.sol). This shim sidesteps the issue by reading the
 * compiled bytecode + ABI from the build-info JSON and synthesizing an
 * Ignition-compatible Artifact object.
 *
 * Usage in an Ignition module:
 *
 *   const lazyImtArtifact = loadNpmArtifact(
 *     "@zk-kit/lazy-imt.sol",
 *     "LazyIMT.sol",
 *     "LazyIMT",
 *   );
 *   const LazyIMTLib = m.library("LazyIMT", lazyImtArtifact, {
 *     libraries: { PoseidonT3: PoseidonT3Lib },
 *   });
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// modules/ → ignition/ → deploy/ → backend/
const BACKEND_DIR = path.resolve(__dirname, "..", "..", "..");
const BUILD_INFO_DIR = path.resolve(BACKEND_DIR, "artifacts", "build-info");

function findInputSourceName(buildInfoOutput: any, packageName: string, fileName: string): string | undefined {
  const contracts = buildInfoOutput?.output?.contracts ?? {};
  for (const key of Object.keys(contracts)) {
    // build-info source paths look like `npm/<package>@<ver>/<file>`. Match
    // the package + file ignoring the version.
    if (
      key.startsWith(`npm/${packageName}@`) &&
      key.endsWith(`/${fileName}`)
    ) {
      return key;
    }
  }
  return undefined;
}

export function loadNpmArtifact(packageName: string, fileName: string, contractName: string) {
  if (!fs.existsSync(BUILD_INFO_DIR)) {
    throw new Error(`No build-info dir at ${BUILD_INFO_DIR}; run \`pnpm b:compile\` first.`);
  }
  const outputFiles = fs
    .readdirSync(BUILD_INFO_DIR)
    .filter((f) => f.endsWith(".output.json"));
  if (outputFiles.length === 0) {
    throw new Error(`No build-info .output.json files in ${BUILD_INFO_DIR}.`);
  }

  for (const outFile of outputFiles) {
    const buildInfo = JSON.parse(fs.readFileSync(path.join(BUILD_INFO_DIR, outFile), "utf8"));
    const inputSourceName = findInputSourceName(buildInfo, packageName, fileName);
    if (inputSourceName === undefined) continue;
    const contracts = buildInfo.output.contracts[inputSourceName] ?? {};
    const compiled = contracts[contractName];
    if (compiled === undefined) {
      throw new Error(
        `Build-info has ${inputSourceName} but no contract "${contractName}". ` +
        `Available: ${Object.keys(contracts).join(", ")}`,
      );
    }
    const buildInfoId = outFile.replace(/\.output\.json$/, "");
    return {
      _format: "hh3-artifact-1" as const,
      contractName,
      sourceName: `${packageName}/${fileName}`,
      inputSourceName,
      buildInfoId,
      abi: compiled.abi ?? [],
      bytecode: "0x" + (compiled.evm?.bytecode?.object ?? ""),
      deployedBytecode: "0x" + (compiled.evm?.deployedBytecode?.object ?? ""),
      linkReferences: compiled.evm?.bytecode?.linkReferences ?? {},
      deployedLinkReferences: compiled.evm?.deployedBytecode?.linkReferences ?? {},
      immutableReferences: compiled.evm?.deployedBytecode?.immutableReferences ?? {},
    };
  }

  throw new Error(
    `Could not find npm/${packageName}@*/${fileName} in any build-info. ` +
    `Make sure ${packageName}/${fileName} is in solidity.npmFilesToBuild or imported by a project source file.`,
  );
}
