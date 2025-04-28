<script lang="ts">
  import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk"
  import type {Account} from "@nemi-fi/wallet-sdk"
  import { accountStore } from '../stores/walletStore'; 
  
  let account: Account | undefined;

  // Subscribe to the account store
  $: $accountStore, account = $accountStore;

</script>

<div>
  {#if account}
    <p>Your address: {account.address}</p>
  {:else}
    <p>No account connected</p>
  {/if}
</div>
