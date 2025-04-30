<script lang="ts">
// Paso 7: Éxito del retiro
// Muestra mensaje de éxito y opciones para ver recibo o hacer otro retiro.
import { onMount } from 'svelte';

export let onViewReceipt: () => void;
export let onRestart: () => void;

onMount(() => {
  console.log('[WithdrawStepSuccess] Mounted.');
});
</script>

<div class="text-center">
  <h2 class="text-success">¡Retiro completado exitosamente! 🎉</h2>
  <button type="button" on:click={onViewReceipt}>Ver recibo privado</button>
  <button type="button" on:click={onRestart}>Hacer otro retiro</button>
</div> 