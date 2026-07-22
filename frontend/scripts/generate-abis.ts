/**
 * Script to generate typed ABIs from backend contracts
 * This creates viem-compatible, fully-typed ABI files in the frontend.
 *
 * TypeChain was dropped in the Hardhat 3 migration, so we read the `.abi`
 * field straight out of the compiled Hardhat artifact JSON (the same source
 * the backend's getViemContract() uses via hre.artifacts.readArtifact).
 * Run a backend compile first (`pnpm l:deploy` or `pnpm --filter
 * @warp-toad/backend compile`) so the artifacts exist.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKEND_ROOT = path.resolve(__dirname, '../../backend');
const ARTIFACTS_ROOT = path.join(BACKEND_ROOT, 'artifacts/contracts');
const OUTPUT_DIR = path.resolve(__dirname, '../src/lib/contracts/abis');

// Contracts we want to generate ABIs for.
//   artifactName = the Solidity contract name as compiled (artifact basename)
//   name         = the symbol/file name used in the frontend (`${name}Abi`)
// We locate `${artifactName}.json` by name under artifacts/contracts so the
// list survives Solidity source-tree reorganizations.
const CONTRACTS_TO_GENERATE = [
  // Test tokens
  { artifactName: 'USDcoin', name: 'USDcoin' },
  { artifactName: 'ERC20', name: 'ERC206Dec' }, // ERC206Dec.sol declares `contract ERC20`

  // Core contracts
  { artifactName: 'L1WarpToad', name: 'L1WarpToad' },
  { artifactName: 'L2WarpToad', name: 'L2WarpToad' },

  // Bridge adapters
  { artifactName: 'L1AztecBridgeAdapter', name: 'L1AztecBridgeAdapter' },
  { artifactName: 'L1ZkStackBridgeAdapter', name: 'L1ZkStackBridgeAdapter' },
  { artifactName: 'L2ZkStackBridgeAdapter', name: 'L2ZkStackBridgeAdapter' },

  // GigaBridge
  { artifactName: 'GigaBridge', name: 'GigaBridge' },
];

interface ABIItem {
  type: string;
  name?: string;
  inputs?: any[];
  outputs?: any[];
  stateMutability?: string;
  anonymous?: boolean;
}

/**
 * Recursively find `${fileName}` under `dir`. Returns the first match, or all
 * matches when `collectAll` is set (used to warn on ambiguous basenames).
 */
function findArtifactFiles(dir: string, fileName: string): string[] {
  const matches: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findArtifactFiles(full, fileName));
    } else if (entry.name === fileName) {
      matches.push(full);
    }
  }
  return matches;
}

/**
 * Read the ABI array from a Hardhat artifact JSON file.
 */
function extractABIFromArtifact(filePath: string): ABIItem[] | null {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(json.abi)) {
      console.warn(`   No .abi array in ${filePath}`);
      return null;
    }
    return json.abi;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

/**
 * Generate typed ABI file for viem
 */
function generateTypedABIFile(contractName: string, abi: ABIItem[]): string {
  // Format ABI as a const assertion for maximum type inference
  const abiString = JSON.stringify(abi, null, 2);

  return `/**
 * ${contractName} Contract ABI
 * Auto-generated from backend Hardhat artifacts
 * DO NOT EDIT MANUALLY
 */

export const ${contractName}Abi = ${abiString} as const;

export type ${contractName}Abi = typeof ${contractName}Abi;
`;
}

/**
 * Main generation function
 */
function generateABIs() {
  console.log('Generating typed ABIs from backend artifacts...\n');

  if (!fs.existsSync(ARTIFACTS_ROOT)) {
    console.error(`Artifacts not found at ${ARTIFACTS_ROOT}`);
    console.error('Compile the backend first (e.g. `pnpm l:deploy` or `pnpm --filter @warp-toad/backend compile`).');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const generatedFiles: string[] = [];
  const failedContracts: string[] = [];

  for (const contract of CONTRACTS_TO_GENERATE) {
    console.log(`📄 Processing ${contract.name}...`);

    const matches = findArtifactFiles(ARTIFACTS_ROOT, `${contract.artifactName}.json`);

    if (matches.length === 0) {
      console.warn(`   Artifact not found: ${contract.artifactName}.json under ${ARTIFACTS_ROOT}`);
      failedContracts.push(contract.name);
      continue;
    }
    if (matches.length > 1) {
      console.warn(`   Multiple artifacts named ${contract.artifactName}.json, using first:\n      ${matches.join('\n      ')}`);
    }

    const abi = extractABIFromArtifact(matches[0]);

    if (!abi) {
      failedContracts.push(contract.name);
      continue;
    }

    // Generate typed ABI file
    const outputFileName = `${contract.name}.ts`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);
    const fileContent = generateTypedABIFile(contract.name, abi);

    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    generatedFiles.push(outputFileName);

    console.log(`Generated ${outputFileName} (${abi.length} ABI entries)`);
  }

  // Generate index file that exports all ABIs
  generateIndexFile(generatedFiles);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Successfully generated: ${generatedFiles.length} contracts`);

  if (failedContracts.length > 0) {
    console.log(`Failed: ${failedContracts.length} contracts`);
    console.log(`      ${failedContracts.join(', ')}`);
    process.exitCode = 1;
  }

  console.log('\nDone! Your ABIs are now fully typed for viem.');
  console.log(`Location: ${OUTPUT_DIR}\n`);
}

/**
 * Generate index.ts barrel export file
 */
function generateIndexFile(generatedFiles: string[]) {
  // Re-export only the value `XAbi` (a const). Each ABI file also declares
  // `export type XAbi = typeof XAbi` next to the const, sharing the same name.
  // Re-exporting both `X` and `type X` from the barrel produces "duplicate
  // identifier" errors under verbatimModuleSyntax. Anyone needing the type can
  // do `import { XAbi } from '$lib/contracts/abis'; type X = typeof XAbi;`.
  const exports = generatedFiles
    .map(file => {
      const contractName = file.replace('.ts', '');
      return `export { ${contractName}Abi } from './${contractName}';`;
    })
    .join('\n');

  const indexContent = `/**
 * Contract ABIs
 * Auto-generated barrel exports
 * DO NOT EDIT MANUALLY
 */

${exports}
`;

  const indexPath = path.join(OUTPUT_DIR, 'index.ts');
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
  console.log(`\nGenerated index.ts with all exports`);
}

// Run the script
generateABIs();
