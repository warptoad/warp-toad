<script lang="ts">
import { createEventDispatcher } from 'svelte';
import ConnectWalletButton from '../ConnectWalletButton.svelte';
import { accountStore } from '../../stores/walletStore';
const dispatch = createEventDispatcher();

// Reactively watch the account store
$: if ($accountStore) {
  console.log('[DepositStepConnectWallet] Wallet connected:', $accountStore);
  dispatch('next', { walletConnected: true });
}
</script>

<div class="flex flex-col items-center justify-center w-full h-full">
  <h2 class="text-xl font-bold mb-4">Connect your wallet</h2>
  <ConnectWalletButton />
</div>
<!-- Uses shared ConnectWalletButton and global wallet store. Emits 'next' when connected. --> 