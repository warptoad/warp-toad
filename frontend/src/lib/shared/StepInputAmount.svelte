<script lang="ts">
// StepInputAmount.svelte
// Reusable step for entering an amount (e.g., deposit, transfer, etc.)
import { createEventDispatcher } from 'svelte';

export let title: string = 'Enter Amount';
export let message: string = '';
export let buttonText: string = 'Next';
export let feeCalculator: (amount: number) => string = (amount) => (amount * 0.01).toFixed(4) + ' ETH';

const dispatch = createEventDispatcher();
let amount = '';
let estimatedFees = '';
let error = '';
let loading = false;

function handleNext() {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    error = 'Please enter a valid amount.';
    return;
  }
  error = '';
  loading = true;
  setTimeout(() => {
    estimatedFees = feeCalculator(Number(amount));
    loading = false;
    console.log('[StepInputAmount] Amount:', amount, 'Estimated fees:', estimatedFees);
    dispatch('next', { amount, estimatedFees });
  }, 800);
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">{title}</h2>
  {#if message}
    <p class="mb-2">{message}</p>
  {/if}
  <input
    class="input input-bordered mb-2 text-center"
    type="number"
    min="0"
    step="any"
    placeholder="Amount"
    bind:value={amount}
    disabled={loading}
  />
  {#if estimatedFees}
    <div class="mb-2 text-sm text-gray-500">Estimated fees: {estimatedFees}</div>
  {/if}
  {#if error}
    <div class="text-red-500 mb-2">{error}</div>
  {/if}
  <button class="btn btn-primary" on:click={handleNext} disabled={loading}>
    {loading ? 'Calculating...' : buttonText}
  </button>
</div>

<!--
  StepInputAmount.svelte
  - Props:
    - title: string (default: 'Enter Amount')
    - message: string
    - buttonText: string (default: 'Next')
    - feeCalculator: (amount: number) => string (default: 1% fee)
  - Emits: 'next' con { amount, estimatedFees }
  - Logs y comentarios en puntos clave
--> 