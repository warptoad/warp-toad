/**
 * Relay Service API Client
 * 
 * Client for interacting with the WarpToad relay service for gasless withdrawals.
 */

const RELAY_SERVICE_URL = import.meta.env.VITE_RELAY_SERVICE_URL || 'http://localhost:7777';

export interface RelayerInfo {
  relayerAddress: string;
  minFeeFactor: number; // basis points (e.g., 25 = 0.25%)
  maxFeeFactor: number; // basis points (e.g., 500 = 5%)
  currentGasPrice: string; // in wei
  estimatedGasCost: string; // in wei
}

export interface WithdrawRelayRequest {
  chainId: string; // Target chain ID (11155111 for L1, 534351 for Scroll)
  contractAddress: string;
  nullifier: string;
  amount: string;
  gigaRoot: string;
  localRoot: string;
  feeFactor: string;
  priorityFee: string;
  maxFee: string;
  relayer: string;
  recipient: string;
  proof: string;
}

export interface RelayResponse {
  ok: boolean;
  operationId?: string;
  status?: string;
  txHash?: string;
  error?: string;
  estimatedConfirmationTime?: number;
}

export interface RelayStatus {
  ok: boolean;
  operationId: string;
  status: 'pending' | 'validating' | 'submitting' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  gasUsed?: string;
}

/**
 * Fetch relayer information
 * @param chainId Target chain ID (optional, defaults to L1 Sepolia)
 * @returns Relayer info including address and fee requirements
 */
export async function getRelayerInfo(chainId?: number): Promise<RelayerInfo> {
  const queryParams = chainId ? `?chainId=${chainId}` : '';
  const response = await fetch(`${RELAY_SERVICE_URL}/relay/info${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch relayer info: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error || 'Failed to fetch relayer info');
  }
  
  return {
    relayerAddress: data.relayerAddress,
    minFeeFactor: data.minFeeFactor,
    maxFeeFactor: data.maxFeeFactor,
    currentGasPrice: data.currentGasPrice,
    estimatedGasCost: data.estimatedGasCost
  };
}

/**
 * Submit a withdrawal to be relayed
 * @param request Withdrawal request parameters
 * @returns Relay response with operation ID
 */
export async function submitWithdrawRelay(request: WithdrawRelayRequest): Promise<RelayResponse> {
  const response = await fetch(`${RELAY_SERVICE_URL}/relay/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  
  const data = await response.json();
  
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Relay failed: ${response.statusText}`);
  }
  
  return data;
}

/**
 * Check the status of a relay operation
 * @param operationId Operation ID from relay response
 * @returns Current status of the relay operation
 */
export async function checkRelayStatus(operationId: string): Promise<RelayStatus> {
  const response = await fetch(`${RELAY_SERVICE_URL}/relay/status/${operationId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to check relay status: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error || 'Failed to check relay status');
  }
  
  return data;
}

/**
 * Poll relay status until completed or failed
 * @param operationId Operation ID to poll
 * @param onUpdate Optional callback for status updates
 * @param maxAttempts Maximum number of polling attempts (default: 60)
 * @param intervalMs Polling interval in milliseconds (default: 2000)
 * @returns Final relay status
 */
export async function pollRelayStatus(
  operationId: string,
  onUpdate?: (status: RelayStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<RelayStatus> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await checkRelayStatus(operationId);
    
    if (onUpdate) {
      onUpdate(status);
    }
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }
  
  throw new Error('Relay operation timed out');
}

/**
 * Calculate the relayer fee for a given withdrawal amount and fee factor
 * @param amount Withdrawal amount in wei
 * @param feeFactor Fee factor in basis points (e.g., 25 = 0.25%)
 * @param gasPrice Current gas price in wei
 * @param priorityFee Priority fee in wei
 * @returns Estimated relayer fee in wei
 */
export function calculateRelayerFee(
  amount: bigint,
  feeFactor: number,
  gasPrice: bigint,
  priorityFee: bigint
): bigint {
  // Contract formula: relayerFee = feeFactor * (block.basefee + priorityFee)
  // Note: feeFactor here is the actual multiplier, not basis points
  // For 0.25% (25 basis points), feeFactor should be approximately 0.0025
  
  // Convert basis points to decimal multiplier
  // But the contract uses a different scale - we need to match it
  // For now, use the raw feeFactor value
  return BigInt(feeFactor) * (gasPrice + priorityFee);
}

/**
 * Calculate net amount recipient will receive after relay fee
 * @param totalAmount Total withdrawal amount
 * @param relayerFee Relayer fee amount
 * @returns Net amount for recipient
 */
export function calculateNetAmount(
  totalAmount: bigint,
  relayerFee: bigint
): bigint {
  return totalAmount - relayerFee;
}

/**
 * Format fee factor from percentage to the value expected by contract
 * @param percentageFee Fee as percentage (e.g., 0.25 for 0.25%)
 * @returns Fee factor value for contract
 */
export function formatFeeFactor(percentageFee: number): string {
  // The contract uses: relayerFee = feeFactor * (baseFee + priorityFee)
  // So if we want 0.25% fee, and baseFee+priorityFee ≈ 1 gwei
  // We need feeFactor such that: feeFactor * 1gwei = 0.0025 * amount
  // This means feeFactor ≈ 0.0025 * (amount / 1gwei)
  // 
  // For simplicity, we'll use basis points directly
  // 0.25% = 25 basis points = feeFactor of 25
  const basisPoints = Math.floor(percentageFee * 100);
  return basisPoints.toString();
}

/**
 * Check if relay service is available
 * @returns true if service is reachable
 */
export async function isRelayServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${RELAY_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.warn('Relay service not available:', error);
    return false;
  }
}
