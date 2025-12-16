/**
 * Script to generate typed ABIs from backend contracts
 * This creates viem-compatible, fully-typed ABI files in the frontend
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKEND_ROOT = path.resolve(__dirname, '../../backend');
const TYPECHAIN_ROOT = path.join(BACKEND_ROOT, 'typechain-types/factories');
const OUTPUT_DIR = path.resolve(__dirname, '../src/lib/contracts/abis');

// Contracts we want to generate ABIs for (using factory files)
const CONTRACTS_TO_GENERATE = [
  // Test tokens
  { path: 'contracts/evm/test/USDcoin__factory.ts', name: 'USDcoin' },
  { path: 'contracts/evm/test/ERC206Dec.sol/ERC20__factory.ts', name: 'ERC206Dec' },
  
  // Core contracts
  { path: 'contracts/evm/warptoad/L1WarpToad__factory.ts', name: 'L1WarpToad' },
  { path: 'contracts/evm/warptoad/L2WarpToad__factory.ts', name: 'L2WarpToad' },
  
  // Bridge adapters
  { path: 'contracts/evm/adapters/L1AztecBridgeAdapter__factory.ts', name: 'L1AztecBridgeAdapter' },
  { path: 'contracts/evm/adapters/L1ScrollBridgeAdapter__factory.ts', name: 'L1ScrollBridgeAdapter' },
  { path: 'contracts/evm/adapters/L2ScrollBridgeAdapter__factory.ts', name: 'L2ScrollBridgeAdapter' },
  
  // GigaBridge
  { path: 'contracts/evm/GigaBridge__factory.ts', name: 'GigaBridge' },
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
 * Extract ABI from TypeChain generated factory file
 */
function extractABIFromTypechainFile(filePath: string): ABIItem[] | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Look for _abi constant definition in the factory file
    // Match from "const _abi = [" to "] as const;"
    const abiMatch = content.match(/const _abi = (\[[\s\S]*?\]) as const;/);
    
    if (abiMatch) {
      // Parse the ABI array - need to handle the JavaScript object notation
      const abiString = abiMatch[1];
      // Use Function constructor instead of eval for better safety
      const abi = new Function(`return ${abiString}`)();
      return abi;
    }
    
    console.warn(`Could not extract ABI from ${filePath}`);
    return null;
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
 * Auto-generated from backend typechain types
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
  console.log('Generating typed ABIs from backend contracts...\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const generatedFiles: string[] = [];
  const failedContracts: string[] = [];
  
  for (const contract of CONTRACTS_TO_GENERATE) {
    const typechainPath = path.join(TYPECHAIN_ROOT, contract.path);
    
    console.log(`📄 Processing ${contract.name}...`);
    
    if (!fs.existsSync(typechainPath)) {
      console.warn(`   TypeChain file not found: ${typechainPath}`);
      failedContracts.push(contract.name);
      continue;
    }
    
    const abi = extractABIFromTypechainFile(typechainPath);
    
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
    
    console.log(`Generated ${outputFileName}`);
  }
  
  // Generate index file that exports all ABIs
  generateIndexFile(generatedFiles);
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`Successfully generated: ${generatedFiles.length} contracts`);
  
  if (failedContracts.length > 0) {
    console.log(`Failed: ${failedContracts.length} contracts`);
    console.log(`      ${failedContracts.join(', ')}`);
  }
  
  console.log('\nDone! Your ABIs are now fully typed for viem.');
  console.log(`Location: ${OUTPUT_DIR}\n`);
}

/**
 * Generate index.ts barrel export file
 */
function generateIndexFile(generatedFiles: string[]) {
  const exports = generatedFiles
    .map(file => {
      const contractName = file.replace('.ts', '');
      return `export { ${contractName}Abi, type ${contractName}Abi } from './${contractName}';`;
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
