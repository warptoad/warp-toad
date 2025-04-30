<script lang="ts">
// Button reutilizable
// Props: label (string), type ('button' | 'submit' | 'reset'), onClick (callback)
import { onMount } from 'svelte';

export let label: string = '';
export let type: 'button' | 'submit' | 'reset' = 'button';
export let onClick: () => void;

onMount(() => {
  console.log('[Button] Mounted. Label:', label);
});

function handleClick() {
  onClick && onClick();
}
</script>

<button type={type} on:click={handleClick} class="btn btn-primary">
  {label}
</button> 