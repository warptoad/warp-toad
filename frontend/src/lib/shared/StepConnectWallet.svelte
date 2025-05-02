<script lang="ts">
// StepConnectWallet.svelte
// Reusable wallet connection step for any flow (deposit, withdraw, etc.)
// Emits an event (default: 'next') when the wallet is connected.
import { createEventDispatcher, onMount } from 'svelte';
import { accountStore } from '../../stores/walletStore';
import ConnectWalletButton from '../ConnectWalletButton.svelte';
import type { Account } from '@nemi-fi/wallet-sdk';

// Props for customization
export let title: string = 'Connect your wallet';
export let message: string = '';
export let emitOnConnect: boolean = true;
export let eventName: string = 'next';

const dispatch = createEventDispatcher();
let account: Account | undefined;

// Reactively update account from store
$: $accountStore, account = $accountStore;

// Emit event when wallet connects (if enabled)
$: if (emitOnConnect && account) {
  console.log(`[StepConnectWallet] Wallet connected:`, account);
  dispatch(eventName, { walletConnected: true, account });
}

onMount(() => {
  console.log('[StepConnectWallet] Mounted. Account:', account);
});
</script>

<div class="flex flex-col items-center justify-center w-full h-full text-center gap-4">
  <h2 class="text-xl font-bold mb-4">{title}</h2>
  {#if message}
    <p class="mb-2">{message}</p>
  {/if}
  {#if !account}
    <ConnectWalletButton />
    <p class="text-lg mt-2 text-warning">No wallet connected</p>
  {/if}
</div>

<!--
  StepConnectWallet.svelte
  - Props:
    - title: string (optional, default 'Connect your wallet')
    - message: string (optional)
    - emitOnConnect: boolean (default true)
    - eventName: string (default 'next')
  - Emits: eventName (default 'next') with { walletConnected: true, account }
  - Uses ConnectWalletButton and accountStore
  - Logs key actions for debugging
--> 