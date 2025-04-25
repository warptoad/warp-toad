<script lang="ts">
  import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk"
  import type {Account} from "@nemi-fi/wallet-sdk"
  
  let account: Account | undefined = $state(undefined)

  const NODE_URL = "https://registry.obsidion.xyz/node" // testnet

  const WALLET_URL = "https://app.obsidion.xyz"

  // This should be instantiated outside of any js classes / react components
  const sdk = new AztecWalletSdk({
    aztecNode: NODE_URL,
    connectors: [obsidion({ walletUrl: WALLET_URL })],
  })

  const connectWallet = async () => {
    try {
      account = await sdk.connect("obsidion");
      console.log("WALLET CONNECTED")
      console.log(account)
    } catch (error) {
      console.log(error)
    }
  }

  const disconnectWallet = async () => {
    try {
      await sdk.disconnect();
      account = undefined;
    } catch (error) {
      console.log("failed to disconnect: ", error)
    }
  }

</script>

<div>
  <div class="bg-base-100 p-4 rounded grid gap-2">
    <p>You are currently {!account?"not logged in": "logged in as:"}</p>
    <p> <strong>{account?.address}</strong></p>
    {#if account}
      <button class="btn btn-error" onclick={disconnectWallet}>
        Disconnect
      </button>
    {:else}
      <button class="btn btn-accent" onclick={connectWallet}>
        Connect Obsidion Wallet
      </button>
    {/if}
  </div>
</div>
