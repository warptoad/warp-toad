import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getChainConfig } from './chainMapper.js';
import type { ChainId, BridgeResult } from '../types/index.js';

const BACKEND_DIR = path.join(process.cwd(), '..', 'backend');
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Ensure log directory exists
fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Generate timestamp for log files
 */
function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Determine bridge direction and build command arguments
 */
function buildBridgeCommand(
  fromChainId: ChainId,
  toChainId: ChainId,
  privateKey: string
): { args: string[]; logName: string } {
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);
  
  // Determine L1 and L2
  const isFromAztec = fromChain.isAztec;
  const isToAztec = toChain.isAztec;
  const isAztec = isFromAztec || isToAztec;
  
  // L1 is the non-Aztec EVM chain
  const l1Rpc = fromChain.type === 'L1' || fromChain.type === 'L2' ? fromChain.rpcUrl : toChain.rpcUrl;
  const l2Rpc = isAztec 
    ? (isFromAztec ? fromChain.rpcUrl : toChain.rpcUrl)
    : (fromChain.type === 'L2' ? fromChain.rpcUrl : toChain.rpcUrl);
  
  const args = [
    'workspace',
    '@warp-toad/backend',
    'tsx',
    'scripts/dev_op/bridge.ts',
    '--L1Rpc',
    l1Rpc,
    '--L2Rpc',
    l2Rpc,
    '--evmPrivatekey',
    privateKey,
  ];
  
  if (isAztec) {
    args.push('--isAztec');
  }
  
  const logName = isAztec ? 'aztec' : 'scroll';
  
  return { args, logName };
}

/**
 * Execute bridge operation by spawning the backend bridge script
 */
export async function executeBridge(
  operationId: string,
  fromChainId: ChainId,
  toChainId: ChainId,
  privateKey: string,
  confirmations: number = 3
): Promise<BridgeResult> {
  console.log(`[${operationId}] Starting bridge: ${fromChainId} -> ${toChainId}`);
  
  const fromChain = getChainConfig(fromChainId);
  const toChain = getChainConfig(toChainId);
  
  console.log(`[${operationId}] From: ${fromChain.name} (${fromChain.type})`);
  console.log(`[${operationId}] To: ${toChain.name} (${toChain.type})`);
  
  // Build command
  const { args, logName } = buildBridgeCommand(fromChainId, toChainId, privateKey);
  
  // Create log file
  const stamp = timestamp();
  const logFile = path.join(LOG_DIR, `${logName}_${fromChainId}-to-${toChainId}_${stamp}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  logStream.write(`[BridgeKeeper] Operation ID: ${operationId}\n`);
  logStream.write(`[BridgeKeeper] From: ${fromChainId} -> To: ${toChainId}\n`);
  logStream.write(`[BridgeKeeper] Started at: ${new Date().toISOString()}\n`);
  logStream.write(`[BridgeKeeper] Command: yarn ${args.join(' ')}\n\n`);
  
  console.log(`[${operationId}] Log file: ${logFile}`);
  console.log(`[${operationId}] Executing bridge script...`);
  
  return new Promise((resolve, reject) => {
    const child = spawn('yarn', args, {
      cwd: path.join(process.cwd(), '..'),
      env: {
        ...process.env,
        DEFAULT_CONFIRMATIONS: confirmations.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stdoutData = '';
    let stderrData = '';
    
    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdoutData += str;
      logStream.write(str);
      // Log important lines to console
      if (str.includes('completed') || str.includes('txHashes') || str.includes('error')) {
        console.log(`[${operationId}]`, str.trim());
      }
    });
    
    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderrData += str;
      logStream.write(`[STDERR] ${str}`);
      console.error(`[${operationId}]`, str.trim());
    });
    
    child.on('error', (err) => {
      logStream.write(`\n[BridgeKeeper] Process error: ${String(err)}\n`);
      logStream.end();
      console.error(`[${operationId}] Process error:`, err);
      reject(new Error(`Failed to start bridge process: ${String(err)}`));
    });
    
    child.on('close', (code) => {
      logStream.write(`\n[BridgeKeeper] Exited with code: ${code}\n`);
      logStream.write(`[BridgeKeeper] Ended at: ${new Date().toISOString()}\n`);
      logStream.end();
      
      if (code === 0) {
        console.log(`[${operationId}] Bridge completed successfully`);
        
        // Parse transaction hashes from output
        const txHashes: Record<string, string> = {};
        const txHashMatch = stdoutData.match(/txHashes[:\s]+({[^}]+})/);
        if (txHashMatch) {
          try {
            const parsed = JSON.parse(txHashMatch[1]);
            Object.assign(txHashes, parsed);
          } catch (e) {
            console.warn(`[${operationId}] Could not parse tx hashes from output`);
          }
        }
        
        resolve({
          sendRootToL1TxHash: txHashes.sendRootToL1TxHash,
          updateGigaRootTxHash: txHashes.updateGigaRootTxHash,
          sendGigaRootTxHash: txHashes.sendGigaRootTxHash,
        });
      } else {
        console.error(`[${operationId}] Bridge failed with code: ${code}`);
        reject(new Error(`Bridge script exited with code ${code}`));
      }
    });
  });
}
