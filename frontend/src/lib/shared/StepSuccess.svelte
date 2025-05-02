<script lang="ts">
// StepSuccess.svelte
// Reusable step for showing success/final state (deposit, withdraw, etc.)
import { createEventDispatcher } from 'svelte';

export let title: string = 'Success!';
export let message: string = '';
export let summary: Record<string, string> = {};
export let actions: { label: string; event: string }[] = [
  { label: 'Restart', event: 'restart' }
];

const dispatch = createEventDispatcher();

function handleAction(event: string) {
  console.log(`[StepSuccess] Action:`, event);
  dispatch(event);
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-2xl font-bold mb-4 text-success">{title}</h2>
  {#if message}
    <div class="mb-2">{message}</div>
  {/if}
  {#if Object.keys(summary).length > 0}
    <div class="mb-4 p-4 border rounded bg-base-200 w-full max-w-md">
      {#each Object.entries(summary) as [key, value]}
        <div class="mb-2"><b>{key}:</b> {value}</div>
      {/each}
    </div>
  {/if}
  <div class="flex gap-4 mt-2">
    {#each actions as action}
      <button class="btn btn-primary" on:click={() => handleAction(action.event)}>{action.label}</button>
    {/each}
  </div>
</div>

<!--
  StepSuccess.svelte
  - Props:
    - title: string (default: 'Success!')
    - message: string
    - summary: Record<string, string> (campos a mostrar)
    - actions: { label: string; event: string }[] (botones de acción)
  - Emits: evento según acción seleccionada
  - Logs y comentarios en puntos clave
--> 