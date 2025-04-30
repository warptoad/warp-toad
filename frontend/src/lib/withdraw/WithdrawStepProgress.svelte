<script lang="ts">
// Paso 6: Progreso del retiro
// Muestra una barra de progreso o animación mientras se procesa el retiro.
import { onMount } from 'svelte';

export let progress: number = 0; // 0 a 100
export let status: string = 'Procesando retiro...';

onMount(() => {
  console.log('[WithdrawStepProgress] Mounted. Progress:', progress);
});
</script>

<div>
  <h3>{status}</h3>
  <!-- Aquí irá el ProgressBar reutilizable -->
  <div class="w-full bg-gray-200 rounded-full h-4">
    <div class="bg-blue-500 h-4 rounded-full" style="width: {progress}%"></div>
  </div>
  <p>{progress}%</p>
</div> 