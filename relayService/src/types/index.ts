export interface RelayerInfo {
  relayerAddress: string;
  minFeeFactor: number; // basis points (e.g., 25 = 0.25%)
  maxFeeFactor: number; // basis points (e.g., 500 = 5%)
  currentGasPrice: string; // in wei
  estimatedGasCost: string; // in wei
}

export interface WithdrawRequest {
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

export interface RelayOperation {
  operationId: string;
  status: 'pending' | 'validating' | 'submitting' | 'completed' | 'failed';
  txHash?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  gasUsed?: string;
  relayerFee?: string;
}

export interface RelayResponse {
  ok: boolean;
  operationId: string;
  status: string;
  txHash?: string;
  error?: string;
  estimatedConfirmationTime?: number; // seconds
}

export interface ProfitabilityCheck {
  isProfitable: boolean;
  expectedGasCost: bigint;
  expectedRelayerFee: bigint;
  expectedProfit: bigint;
  reason?: string;
}
