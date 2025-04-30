<script lang="ts">
// Step 2: Select destination blockchain
// Custom dropdown (not native <select>) for chain selection
import { onMount } from 'svelte';

export let chains: string[] = ["Ethereum", "Aztec", "Scroll", "Optimism"];
export let selectedChain: string = '';
export let onSelect: (chain: string) => void;

let open = false;
let dropdownRef: HTMLDivElement;

onMount(() => {
  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      open = false;
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
});

function handleSelect(chain: string) {
  onSelect && onSelect(chain);
  open = false;
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') open = false;
}
</script>

<!--
  Fix: force overflow-visible and add padding-bottom to avoid dropdown being cut off in draggable window.
-->
<div class="flex flex-col items-center justify-center w-full gap-4 overflow-visible pb-32">
  <label class="text-lg font-semibold mb-2">Select destination blockchain</label>
  <div class="relative w-64" bind:this={dropdownRef} tabindex="0" on:keydown={handleKeyDown} style="overflow:visible;">
    <button
      class="flex items-center justify-between w-full px-4 py-3 rounded-lg border-2 border-primary bg-base-200 text-base-content font-medium shadow-md transition focus:outline-none focus:ring-2 focus:ring-primary"
      type="button"
      on:click={() => (open = !open)}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span>{selectedChain || '-- Select a chain --'}</span>
      <svg class="ml-2 h-5 w-5 text-primary transition-transform" style:transform={open ? 'rotate(180deg)' : ''} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if open}
      <ul class="absolute z-50 mt-2 w-full bg-base-200 border-2 border-primary rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in" role="listbox">
        {#each chains as chain}
          <li
            class="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-content transition rounded text-center text-xl font-bold font-sheila"
            role="option"
            aria-selected={selectedChain === chain}
            tabindex="0"
            on:click={() => handleSelect(chain)}
            on:keydown={(e) => e.key === 'Enter' && handleSelect(chain)}
          >
            {chain}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if !selectedChain}
    <p class="text-error text-sm mt-2">Please select a chain to continue</p>
  {/if}
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