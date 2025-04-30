<script lang="ts">
// Step 5: Review withdrawal details and confirm
// Styled summary and button for confirmation
import { onMount } from 'svelte';

export let summary: {
  chain: string;
  address: string;
  fileName: string;
};
export let onConfirm: () => void;

onMount(() => {
  console.log('[WithdrawStepReview] Mounted. Summary:', summary);
});

function handleConfirm() {
  console.log('[WithdrawStepReview] Confirming withdrawal...');
  onConfirm && onConfirm();
}
</script>

<div class="flex flex-col items-center justify-center w-full gap-6">
  <h3 class="text-xl font-bold mb-2">Review withdrawal</h3>
  <ul class="bg-base-200 rounded-lg shadow-md px-6 py-4 text-left w-full max-w-md space-y-2">
    <li><b>Chain:</b> <span class="font-mono">{summary.chain}</span></li>
    <li><b>Address:</b> <span class="font-mono">{summary.address}</span></li>
    <li><b>Proof file:</b> <span class="font-mono">{summary.fileName}</span></li>
  </ul>
  <button
    type="button"
    class="btn btn-success font-bold px-6 py-3 rounded-lg shadow-md hover:scale-105 transition text-lg flex items-center gap-2"
    on:click={handleConfirm}
  >
    <span>✅ Confirm and sign</span>
  </button>
</div> 