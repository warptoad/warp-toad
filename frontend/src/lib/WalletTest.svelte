<script lang="ts">
  import type {Account} from "@nemi-fi/wallet-sdk"
  import { evmWalletStore, aztecWalletStore, isEvmConnected, isAztecConnected } from '../stores/walletStore'; 
  import type {EvmAccount} from '../stores/walletStore';
  
  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined;

  // Subscribe to the account store
  $: $evmWalletStore, evmWallet = $evmWalletStore;
  $: $aztecWalletStore, aztecWallet = $aztecWalletStore;

</script>

<div>
  {#if (isEvmConnected() || isAztecConnected())}
    {#if isAztecConnected()}
      <p>Your aztec address: {aztecWallet?.getAddress()}</p>
    {/if}
    {#if isEvmConnected()}
    <p>Your evm address: {evmWallet?.address}</p>
    {/if}
  {:else}
    <p>No account connected</p>
  {/if}
</div>
