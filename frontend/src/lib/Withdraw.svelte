<script lang="ts">
// Withdraw.svelte – Withdraw flow orchestrator
// Controls global state, renders steps, and manages flow data.
import WithdrawStepConnectWallet from './withdraw/WithdrawStepConnectWallet.svelte';
import WithdrawStepSelectChain from './withdraw/WithdrawStepSelectChain.svelte';
import WithdrawStepInputAddress from './withdraw/WithdrawStepInputAddress.svelte';
import WithdrawStepUploadProof from './withdraw/WithdrawStepUploadProof.svelte';
import WithdrawStepReview from './withdraw/WithdrawStepReview.svelte';
import WithdrawStepProgress from './withdraw/WithdrawStepProgress.svelte';
import WithdrawStepSuccess from './withdraw/WithdrawStepSuccess.svelte';
import { accountStore } from '../stores/walletStore';
import { get } from 'svelte/store';

// Flow state
let step = 0;
let selectedChain = '';
let withdrawAddress = '';
let addressError = '';
let proofFile: File | null = null;
let proofFileName = '';
let proofError = '';
let progress = 0;
let progressStatus = '';
let isLoading = false;
let txError = '';

// Watch for wallet connection and auto-advance
$: if (step === 0 && $accountStore) {
  step = 1;
}

function resetFlow() {
  step = 0;
  selectedChain = '';
  withdrawAddress = '';
  addressError = '';
  proofFile = null;
  proofFileName = '';
  proofError = '';
  progress = 0;
  progressStatus = '';
  isLoading = false;
  txError = '';
}

function validateEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function generateMockAddress(): string {
  const hex = Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
  return '0x' + hex;
}

function nextStep() {
  step += 1;
  console.log('[Withdraw] Next step', step);
}

function prevStep() {
  if (step > 0) step -= 1;
}

function handleChainSelect(chain: string) {
  selectedChain = chain;
  nextStep();
}

function handleAddressInput(address: string) {
  withdrawAddress = address;
  addressError = '';
  if (address && !validateEvmAddress(address)) {
    addressError = 'Invalid address (must be EVM format: 0x...)';
  }
}

function handleAddressGenerate() {
  withdrawAddress = generateMockAddress();
  addressError = '';
}

function handleAddressNext() {
  if (!withdrawAddress) {
    addressError = 'Address is required';
    return;
  }
  if (!validateEvmAddress(withdrawAddress)) {
    addressError = 'Invalid address (must be EVM format: 0x...)';
    return;
  }
  nextStep();
}

function handleProofFile(file: File) {
  proofFile = file;
  proofFileName = file.name;
  proofError = '';
}

function handleProofNext() {
  if (!proofFile) {
    proofError = 'You must upload a withdrawal proof';
    return;
  }
  nextStep();
}

// Simulated async hook for withdraw submit (replace with real contract logic)
async function submitWithdrawTx({ chain, address, proofFile }: { chain: string; address: string; proofFile: File | null }) {
  isLoading = true;
  txError = '';
  progress = 0;
  progressStatus = 'Signing transaction...';
  try {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    if (Math.random() < 0.1) throw new Error('Simulated transaction error');
    for (let i = 1; i <= 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      progress = i * 20;
      progressStatus = i < 5 ? 'Processing withdrawal...' : 'Withdrawal complete';
    }
    isLoading = false;
    nextStep();
  } catch (err) {
    isLoading = false;
    txError = err instanceof Error ? err.message : 'Unknown error';
    progressStatus = 'Transaction error';
    progress = 0;
    console.error('[Withdraw] Error in submitWithdrawTx:', txError);
  }
}

async function handleConfirm() {
  await submitWithdrawTx({ chain: selectedChain, address: withdrawAddress, proofFile });
}

function handleRestart() {
  resetFlow();
}

function handleViewReceipt() {
  console.log('[Withdraw] View private receipt (mock)');
  alert('Private receipt (mock)');
}
</script>

<!-- Centered main flow container -->
<div class="flex flex-col items-center justify-center w-full h-full text-center gap-6 p-4">
  {#if step === 0}
    <WithdrawStepConnectWallet />
  {:else if step === 1}
    <WithdrawStepSelectChain selectedChain={selectedChain} onSelect={handleChainSelect} />
  {:else if step === 2}
    <WithdrawStepInputAddress
      address={withdrawAddress}
      onInput={handleAddressInput}
      onGenerate={handleAddressGenerate}
      error={addressError}
    />
    <button class="btn btn-primary mt-4" on:click={handleAddressNext} disabled={isLoading}>Next</button>
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevStep} disabled={isLoading}>Back</button>
  {:else if step === 3}
    <WithdrawStepUploadProof
      fileName={proofFileName}
      onFile={handleProofFile}
      error={proofError}
    />
    <button class="btn btn-primary mt-4" on:click={handleProofNext} disabled={isLoading}>Next</button>
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevStep} disabled={isLoading}>Back</button>
  {:else if step === 4}
    <WithdrawStepReview
      summary={{ chain: selectedChain, address: withdrawAddress, fileName: proofFileName }}
      onConfirm={handleConfirm}
    />
    <button class="btn btn-secondary mt-4 ml-2" on:click={prevStep} disabled={isLoading}>Back</button>
    {#if isLoading}
      <div class="mt-2 text-info">Processing withdrawal...</div>
    {/if}
    {#if txError}
      <div class="mt-2 text-error">{txError}</div>
    {/if}
  {:else if step === 5}
    <WithdrawStepProgress progress={progress} status={progressStatus} />
    {#if txError}
      <div class="mt-2 text-error">{txError}</div>
      <button class="btn btn-warning mt-2" on:click={handleRestart}>Retry</button>
    {/if}
  {:else if step === 6}
    <WithdrawStepSuccess onViewReceipt={handleViewReceipt} onRestart={handleRestart} />
  {/if}
</div>