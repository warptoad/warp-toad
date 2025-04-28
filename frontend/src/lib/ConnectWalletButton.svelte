<script lang="ts">
    import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk"
    import type {Account} from "@nemi-fi/wallet-sdk"
    import { onDestroy } from 'svelte';
    import { sdk, accountStore } from '../stores/walletStore'; 
    
    let account: Account | undefined;
  
    const NODE_URL = "https://registry.obsidion.xyz/node" // testnet
  
    const WALLET_URL = "https://app.obsidion.xyz"
  
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
        <button class="btn btn-outline btn-warning text-base-content p-4 hover:btn-accent" onclick={disconnectWallet}>
            <svg viewBox="0 0 24 24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M8 6C8 3.79086 9.79086 2 12 2H17.5C19.9853 2 22 4.01472 22 6.5V17.5C22 19.9853 19.9853 22 17.5 22H12C9.79086 22 8 20.2091 8 18V17C8 16.4477 8.44772 16 9 16C9.55228 16 10 16.4477 10 17V18C10 19.1046 10.8954 20 12 20H17.5C18.8807 20 20 18.8807 20 17.5V6.5C20 5.11929 18.8807 4 17.5 4H12C10.8954 4 10 4.89543 10 6V7C10 7.55228 9.55228 8 9 8C8.44772 8 8 7.55228 8 7V6ZM12.2929 8.29289C12.6834 7.90237 13.3166 7.90237 13.7071 8.29289L16.7071 11.2929C17.0976 11.6834 17.0976 12.3166 16.7071 12.7071L13.7071 15.7071C13.3166 16.0976 12.6834 16.0976 12.2929 15.7071C11.9024 15.3166 11.9024 14.6834 12.2929 14.2929L13.5858 13L5 13C4.44772 13 4 12.5523 4 12C4 11.4477 4.44772 11 5 11L13.5858 11L12.2929 9.70711C11.9024 9.31658 11.9024 8.68342 12.2929 8.29289Z" fill="#fef0a8"></path>
                </g>
            </svg>
            Disconnect
        </button>
      {:else}
        <button class="btn btn-outline btn-secondary text-base-content p-4 hover:btn-accent" onclick={connectWallet}>
            <svg viewBox="0 0 24 24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M8 6C8 3.79086 9.79086 2 12 2H17.5C19.9853 2 22 4.01472 22 6.5V17.5C22 19.9853 19.9853 22 17.5 22H12C9.79086 22 8 20.2091 8 18V17C8 16.4477 8.44772 16 9 16C9.55228 16 10 16.4477 10 17V18C10 19.1046 10.8954 20 12 20H17.5C18.8807 20 20 18.8807 20 17.5V6.5C20 5.11929 18.8807 4 17.5 4H12C10.8954 4 10 4.89543 10 6V7C10 7.55228 9.55228 8 9 8C8.44772 8 8 7.55228 8 7V6ZM12.2929 8.29289C12.6834 7.90237 13.3166 7.90237 13.7071 8.29289L16.7071 11.2929C17.0976 11.6834 17.0976 12.3166 16.7071 12.7071L13.7071 15.7071C13.3166 16.0976 12.6834 16.0976 12.2929 15.7071C11.9024 15.3166 11.9024 14.6834 12.2929 14.2929L13.5858 13L5 13C4.44772 13 4 12.5523 4 12C4 11.4477 4.44772 11 5 11L13.5858 11L12.2929 9.70711C11.9024 9.31658 11.9024 8.68342 12.2929 8.29289Z" fill="#fef0a8"></path>
                </g>
            </svg>
            Connect
        </button>
      {/if}
  </div>
  