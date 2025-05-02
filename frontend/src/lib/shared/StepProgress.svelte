<script lang="ts">
// StepProgress.svelte
// Reusable step for showing progress (deposit, withdraw, etc.)
import { createEventDispatcher, onMount } from 'svelte';
import ProgressBar from './ProgressBar.svelte';

export let progress: number = 0;
export let status: string = '';
export let title: string = 'Processing';
export let autoComplete: boolean = true;
export let completeDelay: number = 2000; // ms

const dispatch = createEventDispatcher();
let internalProgress = progress;
let interval: any;

onMount(() => {
  console.log('[StepProgress] Progress started', internalProgress, status);
  if (autoComplete) {
    interval = setInterval(() => {
      internalProgress += 10;
      if (internalProgress >= 100) {
        internalProgress = 100;
        clearInterval(interval);
        setTimeout(() => {
          console.log('[StepProgress] Progress complete');
          dispatch('next', { progress: 100 });
        }, completeDelay);
      }
    }, 200);
  }
  return () => clearInterval(interval);
});
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">{title}</h2>
  <div class="w-full max-w-md mb-4">
    <ProgressBar progress={internalProgress} status={status} />
  </div>
  <div class="text-sm text-gray-500">{status}</div>
</div>

<!--
  StepProgress.svelte
  - Props:
    - progress: number (default: 0)
    - status: string
    - title: string (default: 'Processing')
    - autoComplete: boolean (default: true)
    - completeDelay: number (ms, default: 2000)
  - Emits: 'next' al completar
  - Usa ProgressBar compartido
  - Logs y comentarios en puntos clave
--> 