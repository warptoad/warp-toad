<script lang="ts">
// StepInputField.svelte
// Reusable input field with optional secondary action (e.g., generate, search)
import { createEventDispatcher, onMount } from 'svelte';

export let label: string = '';
export let value: string = '';
export let placeholder: string = '';
export let error: string = '';
export let type: string = 'text';
export let buttonText: string = '';

const dispatch = createEventDispatcher();

function handleInput(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  dispatch('input', val);
  console.log('[StepInputField] Input:', val);
}

function handleButtonClick() {
  dispatch('buttonClick');
  console.log('[StepInputField] Button clicked');
}

onMount(() => {
  console.log('[StepInputField] Mounted. Label:', label);
});
</script>

<div class="flex flex-col items-center justify-center w-full gap-4">
  {#if label}
    <label class="text-lg font-semibold mb-2">{label}</label>
  {/if}
  <div class="flex flex-row gap-2 w-full max-w-md items-center justify-center">
    <input
      type={type}
      value={value}
      on:input={handleInput}
      placeholder={placeholder}
      class="flex-1 px-4 py-3 rounded-lg border-2 border-primary bg-base-200 text-base-content font-mono text-lg shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
      autocomplete="off"
    />
    {#if buttonText}
      <button
        type="button"
        class="btn btn-accent font-bold px-4 py-2 rounded-lg shadow-md hover:scale-105 transition"
        on:click={handleButtonClick}
      >
        {buttonText}
      </button>
    {/if}
  </div>
  {#if error}
    <p class="text-error text-sm mt-2">{error}</p>
  {/if}
</div>

<!--
  StepInputField.svelte
  - Props:
    - label: string
    - value: string
    - placeholder: string
    - error: string
    - type: string (default: 'text')
    - buttonText: string (opcional)
  - Emits:
    - input: string
    - buttonClick: void
  - Logs y comentarios en puntos clave
--> 