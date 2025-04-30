<script lang="ts">
// Step 4: Upload withdrawal proof
// Styled file input with feedback and custom button
import { onMount } from 'svelte';

export let fileName: string = '';
export let onFile: (file: File) => void;
export let error: string = '';

onMount(() => {
  console.log('[WithdrawStepUploadProof] Mounted.');
});

function handleFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    console.log('[WithdrawStepUploadProof] File selected:', files[0].name);
    onFile && onFile(files[0]);
  }
}
</script>

<div class="flex flex-col items-center justify-center w-full gap-4">
  <label for="withdraw-proof" class="text-lg font-semibold mb-2">Upload withdrawal proof</label>
  <div class="w-full max-w-md flex flex-col items-center">
    <label
      for="withdraw-proof"
      class="btn btn-primary cursor-pointer px-6 py-3 rounded-lg shadow-md hover:scale-105 transition font-bold mb-2 flex items-center gap-2"
    >
      <span class="text-xl">📤</span> {fileName ? 'Change file' : 'Select file'}
      <input
        id="withdraw-proof"
        type="file"
        accept=".json,.txt"
        class="hidden"
        on:change={handleFileChange}
      />
    </label>
    <div class="text-base-content text-sm mt-1">
      {#if fileName}
        <span class="text-success">Selected: {fileName}</span>
      {:else}
        <span class="opacity-60">No file selected</span>
      {/if}
    </div>
    {#if error}
      <p class="text-error text-sm mt-2">{error}</p>
    {/if}
  </div>
</div> 