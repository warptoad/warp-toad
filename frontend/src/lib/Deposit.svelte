<script lang="ts">
// Main orchestrator for the Deposit flow
import { onMount } from 'svelte';
import DepositStepConnectWallet from './deposit/DepositStepConnectWallet.svelte';
import DepositStepSelectChains from './deposit/DepositStepSelectChains.svelte';
import DepositStepInputAmount from './deposit/DepositStepInputAmount.svelte';
import DepositStepReview from './deposit/DepositStepReview.svelte';
import DepositStepProgress from './deposit/DepositStepProgress.svelte';
import DepositStepSuccess from './deposit/DepositStepSuccess.svelte';

// Mocked state for demonstration
let step = 0;
let depositData = {
  walletConnected: false,
  sourceChain: '',
  destinationChain: '',
  amount: '',
  estimatedFees: '',
  reviewConfirmed: false,
  progress: 0,
  success: false
};

function nextStep(data = {}) {
  depositData = { ...depositData, ...data };
  step += 1;
  console.log('[Deposit] Advancing to step', step, depositData);
}

function resetFlow() {
  step = 0;
  depositData = {
    walletConnected: false,
    sourceChain: '',
    destinationChain: '',
    amount: '',
    estimatedFees: '',
    reviewConfirmed: false,
    progress: 0,
    success: false
  };
  console.log('[Deposit] Flow reset');
}

onMount(() => {
  console.log('[Deposit] Flow mounted');
});
</script>

<!-- Centered content, visually consistent with Withdraw flow -->
<div class="flex flex-col items-center justify-center w-full h-full p-4">
  {#if step === 0}
    <DepositStepConnectWallet on:next={e => nextStep(e.detail)} />
  {:else if step === 1}
    <DepositStepSelectChains on:next={e => nextStep(e.detail)} />
  {:else if step === 2}
    <DepositStepInputAmount on:next={e => nextStep(e.detail)} />
  {:else if step === 3}
    <DepositStepReview {depositData} on:next={e => nextStep(e.detail)} />
  {:else if step === 4}
    <DepositStepProgress {depositData} on:next={e => nextStep(e.detail)} />
  {:else if step === 5}
    <DepositStepSuccess {depositData} on:reset={resetFlow} />
  {/if}
</div>

<!-- Logs for debugging and monitoring at key points -->
<!-- All props and events are documented in subcomponents --> 