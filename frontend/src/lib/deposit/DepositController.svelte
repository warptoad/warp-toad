<script lang="ts">
// DepositController.svelte
// Orquestador modular del flujo de depósito
import { onMount } from 'svelte';
import StepConnectWallet from '../shared/StepConnectWallet.svelte';
import StepSelectChain from '../shared/StepSelectChain.svelte';
import StepInputAmount from '../shared/StepInputAmount.svelte';
import StepReview from '../shared/StepReview.svelte';
import StepProgress from '../shared/StepProgress.svelte';
import StepSuccess from '../shared/StepSuccess.svelte';
import { depositStore, resetDepositFlow, nextDepositStep } from './depositStore';
import type { DepositData } from './depositStore';

// Suscribirse al store de forma reactiva
let step: number;
let depositData: DepositData;
$: ({ step, depositData } = $depositStore);

onMount(() => {
  console.log('[DepositController] Montado');
});
</script>

<!-- Contenedor principal del flujo de depósito -->
<div class="flex flex-col items-center justify-center w-full h-full p-4">
  {#if step === 0}
    <StepConnectWallet on:next={(e) => nextDepositStep(e.detail)} title="Connect your wallet" />
  {:else if step === 1}
    <StepSelectChain
      mode="dual"
      chainOptions={["Ethereum", "Aztec", "Scroll", "Optimism"]}
      title="Select Source and Destination Chains"
      on:next={(e) => nextDepositStep(e.detail)}
    />
  {:else if step === 2}
    <StepInputAmount on:next={(e) => nextDepositStep(e.detail)} />
  {:else if step === 3}
    <StepReview
      title="Review Deposit"
      summary={{
        'Source Chain': depositData.sourceChain,
        'Destination Chain': depositData.destinationChain,
        'Amount': depositData.amount,
        'Estimated Fees': depositData.estimatedFees
      }}
      buttonText="Confirm and Sign"
      loadingText="Signing..."
      on:next={(e) => nextDepositStep(e.detail)}
    />
  {:else if step === 4}
    <StepProgress
      progress={depositData.progress}
      status="Processing deposit..."
      title="Processing Deposit"
      on:next={(e) => nextDepositStep(e.detail)}
    />
  {:else if step === 5}
    <StepSuccess
      title="Deposit Completed Privately 🎯"
      summary={{
        'Source Chain': depositData.sourceChain,
        'Destination Chain': depositData.destinationChain,
        'Amount': depositData.amount,
        'Estimated Fees': depositData.estimatedFees
      }}
      actions={[{ label: 'Start Another Deposit', event: 'reset' }]}
      on:reset={resetDepositFlow}
    />
  {/if}
</div>

<!--
  Este controlador centraliza la lógica de pasos y estado del flujo de depósito.
  Los steps son componentes reutilizables y configurables.
  Los logs y comentarios facilitan el debugging y el onboarding.
--> 