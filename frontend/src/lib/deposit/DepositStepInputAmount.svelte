<script lang="ts">
import { createEventDispatcher } from 'svelte';
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
  // Mock fee calculation
  setTimeout(() => {
    estimatedFees = (Number(amount) * 0.01).toFixed(4) + ' ETH';
    loading = false;
    console.log('[DepositStepInputAmount] Amount:', amount, 'Estimated fees:', estimatedFees);
    dispatch('next', { amount, estimatedFees });
  }, 800);
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">Enter Amount to Deposit</h2>
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
    {loading ? 'Calculating...' : 'Next'}
  </button>
</div>
<!-- Logs and comments at key points for debugging --> 