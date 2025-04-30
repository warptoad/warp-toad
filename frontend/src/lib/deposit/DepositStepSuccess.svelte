<script lang="ts">
import { createEventDispatcher } from 'svelte';
export let depositData: any;
const dispatch = createEventDispatcher();

function handleReset() {
  console.log('[DepositStepSuccess] Resetting deposit flow');
  dispatch('reset');
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-2xl font-bold mb-4 text-success">Deposit Completed Privately 🎯</h2>
  <div class="mb-4 p-4 border rounded bg-base-200 w-full max-w-md">
    <div class="mb-2"><b>Source Chain:</b> {depositData.sourceChain}</div>
    <div class="mb-2"><b>Destination Chain:</b> {depositData.destinationChain}</div>
    <div class="mb-2"><b>Amount:</b> {depositData.amount}</div>
    <div class="mb-2"><b>Estimated Fees:</b> {depositData.estimatedFees}</div>
  </div>
  <button class="btn btn-primary" on:click={handleReset}>
    Start Another Deposit
  </button>
</div>
<!-- Logs and comments at key points for debugging --> 