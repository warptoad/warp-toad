import { ethers } from 'ethers';
import type { ProfitabilityCheck } from '../types/index.js';

/**
 * Check if a relay transaction is profitable
 * 
 * @param feeFactor - Fee factor from the proof (basis points)
 * @param amount - Total withdrawal amount in wei
 * @param priorityFee - Priority fee from the proof in gwei
 * @param provider - Ethers provider to get current gas prices
 * @param minProfitUsd - Minimum profit required in USD
 * @param estimatedGasUnits - Estimated gas units for the transaction (default: 250000)
 * @returns ProfitabilityCheck object
 */
export async function checkProfitability(
  feeFactor: bigint,
  amount: bigint,
  priorityFee: bigint,
  provider: ethers.Provider,
  minProfitUsd: number = 1.0,
  estimatedGasUnits: bigint = 250000n
): Promise<ProfitabilityCheck> {
  try {
    // Special case: feeFactor=0 means altruistic testnet relayer
    // Accept without profitability check (for testnet demo purposes)
    if (feeFactor === 0n) {
      console.log('[TESTNET] Altruistic relay - accepting without fee');
      return {
        isProfitable: true,
        expectedGasCost: 0n,
        expectedRelayerFee: 0n,
        expectedProfit: 0n,
        reason: 'Altruistic testnet relay (no fee)'
      };
    }

    // Get current base fee from latest block
    const feeData = await provider.getFeeData();
    const baseFee = feeData.maxFeePerGas || feeData.gasPrice || 0n;
    
    if (baseFee === 0n) {
      return {
        isProfitable: false,
        expectedGasCost: 0n,
        expectedRelayerFee: 0n,
        expectedProfit: 0n,
        reason: 'Unable to fetch current gas prices'
      };
    }

    // Calculate relayer fee according to contract logic:
    // _relayerFee = _feeFactor * (block.basefee + _priorityFee)
    const expectedRelayerFee = feeFactor * (baseFee + priorityFee);
    
    // Check if relayer fee exceeds amount
    if (expectedRelayerFee > amount) {
      return {
        isProfitable: false,
        expectedGasCost: 0n,
        expectedRelayerFee,
        expectedProfit: 0n,
        reason: 'Relayer fee exceeds withdrawal amount'
      };
    }

    // Calculate actual gas cost that relayer will pay
    // Use current baseFee + priorityFee with 20% buffer
    const gasPriceWithBuffer = (baseFee + priorityFee) * 120n / 100n;
    const expectedGasCost = estimatedGasUnits * gasPriceWithBuffer;
    
    // Calculate profit
    const expectedProfit = expectedRelayerFee - expectedGasCost;
    
    // For now, we'll do a simple check: profit > 0
    // TODO: Convert to USD using price oracle
    const isProfitable = expectedProfit > 0n;
    
    if (!isProfitable) {
      return {
        isProfitable: false,
        expectedGasCost,
        expectedRelayerFee,
        expectedProfit,
        reason: `Expected profit (${ethers.formatEther(expectedProfit)} ETH) is negative or below minimum`
      };
    }

    return {
      isProfitable: true,
      expectedGasCost,
      expectedRelayerFee,
      expectedProfit
    };
  } catch (error) {
    return {
      isProfitable: false,
      expectedGasCost: 0n,
      expectedRelayerFee: 0n,
      expectedProfit: 0n,
      reason: `Error checking profitability: ${error}`
    };
  }
}

/**
 * Validate fee factor is within acceptable range
 * 
 * @param feeFactor - Fee factor to validate (in basis points or raw value)
 * @param minFeeFactor - Minimum allowed (basis points, e.g., 25 = 0.25%)
 * @param maxFeeFactor - Maximum allowed (basis points, e.g., 500 = 5%)
 * @returns true if valid, false otherwise
 */
export function validateFeeFactor(
  feeFactor: bigint,
  minFeeFactor: number,
  maxFeeFactor: number
): { isValid: boolean; reason?: string } {
  // Convert feeFactor to a number for comparison
  // Fee factor in contract is: relayerFee = feeFactor * (baseFee + priorityFee)
  // So feeFactor should be < 1 to make sense (e.g., 0.0025 for 0.25%)
  // But it could also be expressed in basis points
  
  // For safety, we'll check if it's reasonable
  // If feeFactor is too large, it might drain entire amount
  const feeFactorNum = Number(feeFactor);
  
  // Special case: feeFactor=0 is allowed for altruistic testnet relayer
  if (feeFactorNum === 0) {
    console.log('[TESTNET] Accepting feeFactor=0 for altruistic relay');
    return { isValid: true };
  }
  
  // We expect feeFactor to be a small decimal like 0.0025 (for 0.25%)
  // or could be expressed differently depending on implementation
  // For now, just ensure it's positive and not absurdly large
  if (feeFactorNum < 0) {
    return {
      isValid: false,
      reason: 'Fee factor cannot be negative'
    };
  }

  // If feeFactor > 1, it means more than 100% which doesn't make sense
  // unless it's using a different scale
  if (feeFactorNum > 1 && feeFactorNum < minFeeFactor) {
    // Likely using basis points
    if (feeFactorNum < minFeeFactor || feeFactorNum > maxFeeFactor) {
      return {
        isValid: false,
        reason: `Fee factor must be between ${minFeeFactor} and ${maxFeeFactor} basis points`
      };
    }
  }
  
  return { isValid: true };
}
