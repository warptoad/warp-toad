import { writable } from 'svelte/store';

// Tipado del estado del flujo de retiro
export interface WithdrawData {
  walletConnected: boolean;
  selectedChain: string;
  withdrawAddress: string;
  proofFile: File | null;
  proofFileName: string;
  progress: number;
  progressStatus: string;
  isLoading: boolean;
  txError: string;
  reviewConfirmed: boolean;
}

export interface WithdrawFlowState {
  step: number;
  withdrawData: WithdrawData;
}

const initialWithdrawData: WithdrawData = {
  walletConnected: false,
  selectedChain: '',
  withdrawAddress: '',
  proofFile: null,
  proofFileName: '',
  progress: 0,
  progressStatus: '',
  isLoading: false,
  txError: '',
  reviewConfirmed: false
};

const initialState: WithdrawFlowState = {
  step: 0,
  withdrawData: { ...initialWithdrawData }
};

export const withdrawStore = writable<WithdrawFlowState>({ ...initialState });

const MAX_STEP = 6;

export function nextWithdrawStep(data: Partial<WithdrawData> = {}) {
  withdrawStore.update((state) => {
    const newData = { ...state.withdrawData, ...data };
    const newStep = Math.min(state.step + 1, MAX_STEP);
    console.log('[withdrawStore] Avanzando a step', newStep, newData);
    return { step: newStep, withdrawData: newData };
  });
}

export function prevWithdrawStep() {
  withdrawStore.update((state) => {
    const newStep = Math.max(0, state.step - 1);
    console.log('[withdrawStore] Retrocediendo a step', newStep);
    return { ...state, step: newStep };
  });
}

export function resetWithdrawFlow() {
  withdrawStore.set({ ...initialState });
  console.log('[withdrawStore] Flow reseteado');
} 