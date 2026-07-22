export type ChainId = string; // '11155111' | '300' | '31337' | 'aztec'
export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface ChainConfig {
  id: ChainId;
  name: string;
  type: 'L1' | 'L2' | 'Aztec';
  chainId?: bigint; // undefined for Aztec
  rpcUrl: string;
  isAztec: boolean;
}

export interface BridgeOperation {
  operationId: string;
  fromChainId: ChainId;
  toChainId: ChainId;
  status: OperationStatus;
  startTime: number;
  endTime?: number;
  txHashes?: Record<string, string>;
  error?: string;
  logFile?: string;
  confirmations: number;
}

export interface BridgeRequest {
  waitForCompletion?: boolean;
  confirmations?: number;
  timeoutMs?: number; // Custom timeout in milliseconds (capped at 6 hours)
}

export interface BridgeResult {
  sendRootToL1Tx?: any;
  sendRootToL1TxHash?: string;
  updateGigaRootTxHash?: string;
  sendGigaRootTxHash?: string;
}

export interface QueueItem {
  operationId: string;
  fromChainId: ChainId;
  toChainId: ChainId;
  confirmations: number;
  timestamp: number;
}
