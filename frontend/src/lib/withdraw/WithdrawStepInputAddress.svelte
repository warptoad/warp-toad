<script lang="ts">
// Step 3: Enter withdrawal address (EVM)
// Styled input and button for address entry and mock generation
import { onMount } from 'svelte';

export let address: string = '';
export let onInput: (address: string) => void;
export let onGenerate: () => void;
export let error: string = '';

onMount(() => {
  console.log('[WithdrawStepInputAddress] Mounted. Address:', address);
});

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  onInput && onInput(value);
}

function handleGenerate() {
  console.log('[WithdrawStepInputAddress] Generating mock address');
  onGenerate && onGenerate();
}
</script>

<div class="flex flex-col items-center justify-center w-full gap-4">
  <label for="withdraw-address" class="text-lg font-semibold mb-2">Withdrawal address (EVM)</label>
  <div class="flex flex-row gap-2 w-full max-w-md items-center justify-center">
    <input
      id="withdraw-address"
      type="text"
      value={address}
      on:input={handleInput}
      placeholder="0x..."
      class="flex-1 px-4 py-3 rounded-lg border-2 border-primary bg-base-200 text-base-content font-mono text-lg shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
      autocomplete="off"
    />
    <button
      type="button"
      class="btn btn-accent font-bold px-4 py-2 rounded-lg shadow-md hover:scale-105 transition"
      on:click={handleGenerate}
    >
      Generate new address
    </button>
  </div>
  {#if error}
    <p class="text-error text-sm mt-2">{error}</p>
  {/if}
</div> 