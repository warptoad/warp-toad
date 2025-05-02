<script lang="ts">
// WithdrawController.svelte
// Orquestador modular del flujo de retiro
import { onMount } from 'svelte';
import StepConnectWallet from '../shared/StepConnectWallet.svelte';
import StepSelectChain from '../shared/StepSelectChain.svelte';
import StepInputField from '../shared/StepInputField.svelte';
import WithdrawStepUploadProof from './WithdrawStepUploadProof.svelte';
import StepReview from '../shared/StepReview.svelte';
import StepProgress from '../shared/StepProgress.svelte';
import StepSuccess from '../shared/StepSuccess.svelte';
import { withdrawStore, nextWithdrawStep, prevWithdrawStep, resetWithdrawFlow } from './withdrawStore';
import type { WithdrawData } from './withdrawStore';
import { get } from 'svelte/store';

// Suscribirse al store de forma reactiva
let step: number;
let withdrawData: WithdrawData;
$: ({ step, withdrawData } = $withdrawStore);

onMount(() => {
  console.log('[WithdrawController] Montado');
});

// Validación de dirección EVM
function validateEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function generateMockAddress(): string {
  const hex = Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
  return '0x' + hex;
}

// Solo actualiza el campo withdrawAddress, sin avanzar de paso
function setWithdrawAddressOnly(address: string) {
  withdrawStore.update((state) => ({ ...state, withdrawData: { ...state.withdrawData, withdrawAddress: address, txError: '' } }));
}

// Simulación de envío de transacción de retiro
async function submitWithdrawTx() {
  // Proteger para que solo avance una vez
  if (get(withdrawStore).step !== 4) return;
  nextWithdrawStep({ isLoading: true, txError: '', progress: 0, progressStatus: 'Signing transaction...' });
  try {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    if (Math.random() < 0.1) throw new Error('Simulated transaction error');
    for (let i = 1; i <= 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      nextWithdrawStep({ progress: i * 20, progressStatus: i < 5 ? 'Processing withdrawal...' : 'Withdrawal complete' });
    }
    nextWithdrawStep({ isLoading: false });
    // Avanza solo si sigue en el paso correcto
    if (get(withdrawStore).step === 5) nextWithdrawStep();
  } catch (err) {
    nextWithdrawStep({ isLoading: false, txError: err instanceof Error ? err.message : 'Unknown error', progressStatus: 'Transaction error', progress: 0 });
    console.error('[WithdrawController] Error in submitWithdrawTx:', err);
  }
}

function handleViewReceipt() {
  console.log('[WithdrawController] View private receipt (mock)');
  alert('Private receipt (mock)');
}
</script>

<!-- Contenedor principal del flujo de retiro -->
<div class="flex flex-col items-center justify-center w-full h-full text-center gap-6 p-4">
  {#if step === 0}
    <StepConnectWallet on:next={(e) => nextWithdrawStep(e.detail)} title="Connect your wallet" />
  {:else if step === 1}
    <StepSelectChain
      mode="single"
      chainOptions={["Ethereum", "Aztec", "Scroll", "Optimism"]}
      title="Select Destination Chain"
      initialDestination={withdrawData.selectedChain}
      on:next={(e) => nextWithdrawStep({ selectedChain: e.detail.selectedChain })}
    />
  {:else if step === 2}
    <StepInputField
      label="Withdrawal address (EVM)"
      value={withdrawData.withdrawAddress}
      placeholder="0x..."
      error={withdrawData.txError || ''}
      buttonText="Generate new address"
      on:input={(e) => nextWithdrawStep({ withdrawAddress: e.detail, txError: '' })}
      on:buttonClick={() => setWithdrawAddressOnly(generateMockAddress())}
    />
    <button class="btn btn-primary mt-4" on:click={() => {
      if (!withdrawData.withdrawAddress) {
        nextWithdrawStep({ txError: 'Address is required' });
        return;
      }
      if (!validateEvmAddress(withdrawData.withdrawAddress)) {
        nextWithdrawStep({ txError: 'Invalid address (must be EVM format: 0x...)' });
        return;
      }
      nextWithdrawStep();
    }} disabled={withdrawData.isLoading}>Next</button>
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevWithdrawStep} disabled={withdrawData.isLoading}>Back</button>
  {:else if step === 3}
    <WithdrawStepUploadProof
      fileName={withdrawData.proofFileName}
      onFile={(file) => nextWithdrawStep({ proofFile: file, proofFileName: file.name, txError: '' })}
      error={withdrawData.txError || ''}
    />
    <button class="btn btn-primary mt-4" on:click={() => {
      if (!withdrawData.proofFile) {
        nextWithdrawStep({ txError: 'You must upload a withdrawal proof' });
        return;
      }
      nextWithdrawStep();
    }} disabled={withdrawData.isLoading}>Next</button>
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevWithdrawStep} disabled={withdrawData.isLoading}>Back</button>
  {:else if step === 4}
    <StepReview
      title="Review Withdrawal"
      summary={{
        'Chain': withdrawData.selectedChain,
        'Address': withdrawData.withdrawAddress,
        'Proof file': withdrawData.proofFileName
      }}
      buttonText="Confirm and sign"
      loadingText="Signing..."
      on:next={submitWithdrawTx}
    />
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevWithdrawStep} disabled={withdrawData.isLoading}>Back</button>
    {#if withdrawData.isLoading}
      <div class="mt-2 text-info">Processing withdrawal...</div>
    {/if}
    {#if withdrawData.txError}
      <div class="mt-2 text-error">{withdrawData.txError}</div>
    {/if}
  {:else if step === 5}
    <StepProgress
      progress={withdrawData.progress}
      status={withdrawData.progressStatus}
      title="Processing Withdrawal"
      autoComplete={false}
    />
    {#if withdrawData.txError}
      <div class="mt-2 text-error">{withdrawData.txError}</div>
      <button class="btn btn-warning mt-2" on:click={resetWithdrawFlow}>Retry</button>
    {/if}
  {:else if step === 6}
    {#key step}
      {console.log('[WithdrawController] Rendering StepSuccess, step:', step, withdrawData)}
      <StepSuccess
        title="Withdrawal completed successfully! 🎉"
        summary={{
          'Chain': withdrawData.selectedChain,
          'Address': withdrawData.withdrawAddress,
          'Proof file': withdrawData.proofFileName
        }}
        actions={[ 
          { label: 'View private receipt', event: 'viewReceipt' },
          { label: 'Start another withdrawal', event: 'restart' }
        ]}
        on:viewReceipt={handleViewReceipt}
        on:restart={resetWithdrawFlow}
      />
    {/key}
  {/if}
</div>

<!--
  Este controlador centraliza la lógica de pasos y estado del flujo de retiro.
  Los steps son componentes reutilizables y configurables.
  Los logs y comentarios facilitan el debugging y el onboarding.
--> 