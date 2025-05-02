<script lang="ts">
// StepSelectChain.svelte
// Reusable step for selecting blockchain(s) in deposit/withdraw flows
import { createEventDispatcher, onMount } from 'svelte';

export let mode: 'single' | 'dual' = 'dual'; // 'single' (withdraw) or 'dual' (deposit)
export let chainOptions: string[] = ["Ethereum", "Aztec", "Scroll", "Optimism"];
export let initialSource: string = '';
export let initialDestination: string = '';
export let title: string = 'Select Chain(s)';
export let message: string = '';

const dispatch = createEventDispatcher();
let sourceChain: string = initialSource;
let destinationChain: string = initialDestination;
let error = '';
let openSource = false;
let openDest = false;
let sourceDropdownRef: HTMLDivElement;
let destDropdownRef: HTMLDivElement;

function handleNext() {
  if (mode === 'dual') {
    if (!sourceChain || !destinationChain) {
      error = 'Please select both source and destination chains.';
      return;
    }
    if (sourceChain === destinationChain) {
      error = 'Source and destination chains must be different.';
      return;
    }
    error = '';
    console.log('[StepSelectChain] Selected:', { sourceChain, destinationChain });
    dispatch('next', { sourceChain, destinationChain });
  } else {
    if (!destinationChain) {
      error = 'Please select a chain.';
      return;
    }
    error = '';
    console.log('[StepSelectChain] Selected:', { selectedChain: destinationChain });
    dispatch('next', { selectedChain: destinationChain });
  }
}

function handleSelectSource(chain: string) {
  sourceChain = chain;
  openSource = false;
}
function handleSelectDest(chain: string) {
  destinationChain = chain;
  openDest = false;
}

function handleKeyDownSource(event: KeyboardEvent) {
  if (event.key === 'Escape') openSource = false;
}
function handleKeyDownDest(event: KeyboardEvent) {
  if (event.key === 'Escape') openDest = false;
}

onMount(() => {
  function handleClickOutside(event: MouseEvent) {
    if (sourceDropdownRef && !sourceDropdownRef.contains(event.target as Node)) openSource = false;
    if (destDropdownRef && !destDropdownRef.contains(event.target as Node)) openDest = false;
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<div class="flex flex-col items-center justify-center w-full gap-6 overflow-visible pb-32">
  <h2 class="text-xl font-bold mb-4">{title}</h2>
  {#if message}
    <p class="mb-2">{message}</p>
  {/if}
  <div class="flex flex-row gap-8 mb-4">
    {#if mode === 'dual'}
      <!-- Source Chain Dropdown -->
      <div class="relative w-64" bind:this={sourceDropdownRef} tabindex="0" on:keydown={handleKeyDownSource} style="overflow:visible;">
        <label class="block mb-1 text-lg font-semibold">Source Chain</label>
        <button
          class="flex items-center justify-between w-full px-4 py-3 rounded-lg border-2 border-primary bg-base-200 text-base-content font-medium shadow-md transition focus:outline-none focus:ring-2 focus:ring-primary"
          type="button"
          on:click={() => (openSource = !openSource)}
          aria-haspopup="listbox"
          aria-expanded={openSource}
        >
          <span>{sourceChain || '-- Select a chain --'}</span>
          <svg class="ml-2 h-5 w-5 text-primary transition-transform" style:transform={openSource ? 'rotate(180deg)' : ''} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {#if openSource}
          <ul class="absolute z-50 mt-2 w-full bg-base-200 border-2 border-primary rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in" role="listbox">
            {#each chainOptions as chain}
              <li
                class="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-content transition rounded text-center text-xl font-bold font-sheila"
                role="option"
                aria-selected={sourceChain === chain}
                tabindex="0"
                on:click={() => handleSelectSource(chain)}
                on:keydown={(e) => e.key === 'Enter' && handleSelectSource(chain)}
              >
                {chain}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    <!-- Destination Chain Dropdown (always present) -->
    <div class="relative w-64" bind:this={destDropdownRef} tabindex="0" on:keydown={handleKeyDownDest} style="overflow:visible;">
      <label class="block mb-1 text-lg font-semibold">{mode === 'dual' ? 'Destination Chain' : 'Select Chain'}</label>
      <button
        class="flex items-center justify-between w-full px-4 py-3 rounded-lg border-2 border-primary bg-base-200 text-base-content font-medium shadow-md transition focus:outline-none focus:ring-2 focus:ring-primary"
        type="button"
        on:click={() => (openDest = !openDest)}
        aria-haspopup="listbox"
        aria-expanded={openDest}
      >
        <span>{destinationChain || '-- Select a chain --'}</span>
        <svg class="ml-2 h-5 w-5 text-primary transition-transform" style:transform={openDest ? 'rotate(180deg)' : ''} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {#if openDest}
        <ul class="absolute z-50 mt-2 w-full bg-base-200 border-2 border-primary rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in" role="listbox">
          {#each chainOptions as chain}
            <li
              class="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-content transition rounded text-center text-xl font-bold font-sheila"
              role="option"
              aria-selected={destinationChain === chain}
              tabindex="0"
              on:click={() => handleSelectDest(chain)}
              on:keydown={(e) => e.key === 'Enter' && handleSelectDest(chain)}
            >
              {chain}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  {#if error}
    <div class="text-red-500 mb-2">{error}</div>
  {/if}
  <button class="btn btn-primary" on:click={handleNext}>
    Next
  </button>
</div>

<style>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.15s ease;
}
</style>

<!--
  StepSelectChain.svelte
  - Props:
    - mode: 'single' | 'dual' (default: 'dual')
    - chainOptions: string[]
    - initialSource: string
    - initialDestination: string
    - title: string
    - message: string
  - Emits: 'next' con los valores seleccionados
  - Logs y comentarios en puntos clave
--> 