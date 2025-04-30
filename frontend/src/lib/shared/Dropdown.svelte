<script lang="ts">
// Dropdown reutilizable para selección de opciones
// Props: options (string[]), selected (string), onSelect (callback)
import { onMount } from 'svelte';

export let options: string[] = [];
export let selected: string = '';
export let onSelect: (value: string) => void;

onMount(() => {
  console.log('[Dropdown] Mounted. Options:', options);
});

function handleSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  onSelect && onSelect(value);
}
</script>

<select on:change={handleSelect}>
  <option value="">-- Selecciona --</option>
  {#each options as option}
    <option value={option} selected={option === selected}>{option}</option>
  {/each}
</select> 