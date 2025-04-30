<script lang="ts">
// Step 1: Wallet connection
// Shows wallet state and allows connect/disconnect using the global store.
import { accountStore } from '../../stores/walletStore';
import { onMount } from 'svelte';
import type { Account } from '@nemi-fi/wallet-sdk';
import ConnectWalletButton from '../ConnectWalletButton.svelte';

let account: Account | undefined;

$: $accountStore, account = $accountStore;

onMount(() => {
  console.log('[WithdrawStepConnectWallet] Mounted. Account:', account);
});

// Emitir evento cuando la wallet se conecta/desconecta (a implementar)
</script>

<div class="flex flex-col items-center justify-center w-full h-full text-center gap-4">
  {#if !account}
    <p class="text-lg">No wallet connected</p>
    <ConnectWalletButton />
  {/if}
</div> 