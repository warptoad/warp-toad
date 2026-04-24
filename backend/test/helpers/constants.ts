/**
 * Shared test constants
 */

export const AZTEC_NODE_URL = "http://localhost:8080";

export const EVM_TREE_DEPTH = 32;
export const GIGA_TREE_DEPTH = 5;

/** Gas cost estimates per chain (for relayer fee calculation) */
export const GAS_COST_L1 = 520968n;

/** Default relayer fee parameters */
export const DEFAULT_FEE = {
  priorityFee: 100_000_000n,  // 0.1 gwei
  maxFee: 5n * 10n ** 18n,    // 5 tokens max
  ethPriceInToken: 1700.34,   // 1 ETH = 1700.34 tokens
  relayerBonusFactor: 1.1,    // 10% relayer margin
} as const;

/** Test commitment pre-images */
export const TEST_COMMITMENT_1 = {
  amount: 5n * 10n ** 18n,
  secret: 1234n,
  nullifierPreimage: 4321n,
} as const;

export const TEST_COMMITMENT_2 = {
  amount: 4n * 10n ** 18n,
  secret: 12341111111n,
  nullifierPreimage: 432111111n,
} as const;

/** Initial token balance for test accounts */
export const INITIAL_BALANCE = 10n * 10n ** 18n;
