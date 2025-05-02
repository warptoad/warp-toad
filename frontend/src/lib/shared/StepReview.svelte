<script lang="ts">
// StepReview.svelte
// Reusable step for reviewing and confirming data (deposit, withdraw, etc.)
import { createEventDispatcher } from 'svelte';

export let title: string = 'Review';
export let summary: Record<string, string> = {};
export let buttonText: string = 'Confirm and Sign';
export let loadingText: string = 'Signing...';
export let message: string = '';

const dispatch = createEventDispatcher();
let confirming = false;
let error = '';

function handleConfirm() {
  confirming = true;
  error = '';
  // Simulate async signature (can be replaced by parent logic)
  setTimeout(() => {
    confirming = false;
    console.log('[StepReview] Confirmed:', summary);
    dispatch('next', { reviewConfirmed: true });
  }, 1200);
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">{title}</h2>
  {#if message}
    <p class="mb-2">{message}</p>
  {/if}
  <div class="mb-4 p-4 border rounded bg-base-200 w-full max-w-md">
    {#each Object.entries(summary) as [key, value]}
      <div class="mb-2"><b>{key}:</b> {value}</div>
    {/each}
  </div>
  {#if error}
    <div class="text-red-500 mb-2">{error}</div>
  {/if}
  <button class="btn btn-primary" on:click={handleConfirm} disabled={confirming}>
    {confirming ? loadingText : buttonText}
  </button>
</div>

<!--
  StepReview.svelte
  - Props:
    - title: string (default: 'Review')
    - summary: Record<string, string> (campos a mostrar)
    - buttonText: string (default: 'Confirm and Sign')
    - loadingText: string (default: 'Signing...')
    - message: string
  - Emits: 'next' al confirmar
  - Logs y comentarios en puntos clave
--> 