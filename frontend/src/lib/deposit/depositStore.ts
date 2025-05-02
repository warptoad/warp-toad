import { writable } from 'svelte/store';

// Tipado del estado del flujo de depósito
export interface DepositData {
  walletConnected: boolean;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  estimatedFees: string;
  reviewConfirmed: boolean;
  progress: number;
  success: boolean;
}

export interface DepositFlowState {
  step: number;
  depositData: DepositData;
}

const initialDepositData: DepositData = {
  walletConnected: false,
  sourceChain: '',
  destinationChain: '',
  amount: '',
  estimatedFees: '',
  reviewConfirmed: false,
  progress: 0,
  success: false
};

const initialState: DepositFlowState = {
  step: 0,
  depositData: { ...initialDepositData }
};

export const depositStore = writable<DepositFlowState>({ ...initialState });

export function nextDepositStep(data: Partial<DepositData> = {}) {
  depositStore.update((state) => {
    const newData = { ...state.depositData, ...data };
    const newStep = state.step + 1;
    console.log('[depositStore] Avanzando a step', newStep, newData);
    return { step: newStep, depositData: newData };
  });
}

export function resetDepositFlow() {
  depositStore.set({ ...initialState });
  console.log('[depositStore] Flow reseteado');
} 