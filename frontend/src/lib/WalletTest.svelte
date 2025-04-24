<script lang="ts">
  import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk"

  let account: any = null; 

  const NODE_URL = "https://registry.obsidion.xyz/node" // testnet

  const WALLET_URL = "https://app.obsidion.xyz"

  // This should be instantiated outside of any js classes / react components
  const sdk = new AztecWalletSdk({
    aztecNode: NODE_URL,
    connectors: [obsidion({ walletUrl: WALLET_URL })],
  })




  const connectWallet = async () => {
    try {
      account = await sdk.connect("obsidion")
      console.log("WALLET CONNECTED")
      console.log(account)
    } catch (error) {
      console.log(error)
    }
  }

  let count: number = $state(0);
  const increment = () => {
    count += 1;
  };
</script>

<button class="btn btn-primary" onclick={connectWallet}>
  WalletTestButton: {account}
</button>
