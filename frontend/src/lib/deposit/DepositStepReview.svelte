<script lang="ts">
import { createEventDispatcher } from 'svelte';
export let depositData: any;
const dispatch = createEventDispatcher();

let confirming = false;
let error = '';

function handleConfirm() {
  confirming = true;
  error = '';
  // Simulate async signature
  setTimeout(() => {
    confirming = false;
    console.log('[DepositStepReview] Confirmed deposit:', depositData);
    dispatch('next', { reviewConfirmed: true });
  }, 1200);
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">Review Deposit</h2>
  <div class="mb-4 p-4 border rounded bg-base-200 w-full max-w-md">
    <div class="mb-2"><b>Source Chain:</b> {depositData.sourceChain}</div>
    <div class="mb-2"><b>Destination Chain:</b> {depositData.destinationChain}</div>
    <div class="mb-2"><b>Amount:</b> {depositData.amount}</div>
    <div class="mb-2"><b>Estimated Fees:</b> {depositData.estimatedFees}</div>
  </div>
  {#if error}
    <div class="text-red-500 mb-2">{error}</div>
  {/if}
  <button class="btn btn-primary" on:click={handleConfirm} disabled={confirming}>
    {confirming ? 'Signing...' : 'Confirm and Sign'}
  </button>
</div>
<!-- Logs and comments at key points for debugging --> 