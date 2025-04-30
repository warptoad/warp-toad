<script lang="ts">
import { createEventDispatcher, onMount } from 'svelte';
import ProgressBar from '../shared/ProgressBar.svelte';
export let depositData: any;
const dispatch = createEventDispatcher();

let progress = 0;
let interval: any;

onMount(() => {
  console.log('[DepositStepProgress] Progress started');
  interval = setInterval(() => {
    progress += 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => {
        console.log('[DepositStepProgress] Progress complete');
        dispatch('next', { progress: 100 });
      }, 500);
    }
  }, 200);
});
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">Processing Deposit</h2>
  <div class="w-full max-w-md mb-4">
    <ProgressBar {progress} />
  </div>
  <div class="text-sm text-gray-500">Your deposit is being processed privately...</div>
</div>
<!-- Logs and comments at key points for debugging --> 