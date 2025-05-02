<script lang="ts">
  import type {Account} from "@nemi-fi/wallet-sdk"
  import { walletStore, isEvmAccount } from '../stores/walletStore'; 
  import type {WalletStore} from "../stores/walletStore";
  
  let wallet: WalletStore | undefined;

  // Subscribe to the account store
  $: $walletStore, wallet = $walletStore;

</script>

<div>
  {#if wallet !==undefined}
    {#if wallet.walletType==="aztec"}
      <p>Your address: {wallet.content.address.toString()}</p>
    {/if}
    {#if wallet.walletType==="evm" && isEvmAccount(wallet.content)}
      <p>Your address: {wallet.content.address}</p>
    {/if}
  {:else}
    <p>No account connected</p>
  {/if}
</div>
