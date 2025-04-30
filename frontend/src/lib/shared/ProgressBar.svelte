<script lang="ts">
// ProgressBar reutilizable
// Props: progress (number), status (string)
import { onMount } from 'svelte';

export let progress: number = 0;
export let status: string = '';

onMount(() => {
  console.log('[ProgressBar] Mounted. Progress:', progress, 'Status:', status);
});
</script>

<div>
  {#if status}
    <h4>{status}</h4>
  {/if}
  <div class="w-full bg-gray-200 rounded-full h-4">
    <div class="bg-blue-500 h-4 rounded-full" style="width: {progress}%"></div>
  </div>
  <p>{progress}%</p>
</div> 