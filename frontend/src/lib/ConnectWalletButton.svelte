<script lang="ts">
    import type {Account} from "@nemi-fi/wallet-sdk"
    import { sdk, accountStore } from '../stores/walletStore'; 

    let account: Account | undefined;
    const connectWallet = async () => {
    try {
      // Using the sdk instance to connect the wallet
      account = await sdk.connect("obsidion");
      accountStore.set(account); // Update the store with the connected account
      console.log("WALLET CONNECTED");
      console.log(account);
    } catch (error) {
      console.log(error);
    }
    //TODO MODAL WITH WALLET SELECTION
  };

  const disconnectWallet = async () => {
    try {
      await sdk.disconnect();
      accountStore.set(undefined); // Clear the account from the store
    } catch (error) {
      console.log("Failed to disconnect: ", error);
    }
  };

  // Subscribe to account store reactively
  $: $accountStore, account = $accountStore;

    function formatAddress(address:string) {
        if (!address) return '';
        return address.slice(0, 5) + '...' + address.slice(-3);
    }
  
  </script>
  
  <div class="flex gap-2 items-center">
      {#if account}
        <h4 class="text-info">{formatAddress(account?.address.toString())}</h4>
        <button class="group btn btn-outline btn-warning text-warning px-4 hover:btn-accent hover:text-accent-content text-center rounded-md border-2" onclick={disconnectWallet}>
          Disconnect
        </button>
      {:else}
        <button class="btn btn-outline btn-info text-info px-4 hover:btn-accent hover:text-accent-content text-center rounded-md border-2" onclick={connectWallet}>
          Connect
        </button>
      {/if}
  </div>
  
  