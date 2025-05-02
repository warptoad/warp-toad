<script lang="ts">
  import { ethers } from "ethers";
  import type { Account } from "@nemi-fi/wallet-sdk";
  import { sdk, accountStore } from "../stores/walletStore";

  let walletModal: HTMLDialogElement | null = null;

  let account: Account | undefined;
  const connectObsidionWallet = async () => {
    try {
      // Using the sdk instance to connect the wallet
      account = await sdk.connect("obsidion");
      accountStore.set(account); // Update the store with the connected account
      closeModal();
    } catch (error) {
      console.log(error);
    }
    //TODO MODAL WITH WALLET SELECTION
  };

  const disconnectObsidionWallet = async () => {
    try {
      await sdk.disconnect();
      accountStore.set(undefined); // Clear the account from the store
    } catch (error) {
      console.log("Failed to disconnect: ", error);
    }
  };

  // Subscribe to account store reactively
  $: $accountStore, (account = $accountStore);

  function formatAddress(address: string) {
    if (!address) return "";
    return address.slice(0, 5) + "..." + address.slice(-3);
  }

  /**
   * TODO: OPEN MODAL SELECTION
   * Let User Chose evm or Aztec Wallet
   * Let user Chose Chain Sepolia, whatever?
   * */

  async function connectMetamaskWallet() {
    if (!window.ethereum) throw new Error("No crypto wallet found");

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);

    closeModal();
    return {
      address,
      balance: ethers.formatEther(balance),
    };
  }

  async function disconnectMetamaskWallet() {
  if (!window.ethereum) throw new Error("No crypto wallet found");

  try {
    // Clear local connection state (you must manage this manually)
    // For example: accountStore.set(undefined);
    console.log("Wallet disconnected on app side.");

    // You can optionally prompt MetaMask to switch to an empty account by re-requesting accounts
    // But there's no real disconnect API
    await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });

    closeModal(); // If you have a modal to close
  } catch (error) {
    console.error("Error disconnecting wallet:", error);
  }
}


  function openModal() {
    walletModal?.showModal();
  }

  function closeModal() {
    walletModal?.close();
  }
</script>

<div class="flex gap-2 items-center">
  <button class="btn" on:click={openModal}>open modal</button>
  <dialog bind:this={walletModal} class="modal">
    <div class="modal-box w-4/12 max-w-5xl rounded-md bg-base-100 border-2 p-0">
      <div
        class="border-b-2 p-2 mb-2 draggable flex justify-between items-center bg-base-300"
      >
        <div>Connect a Wallet</div>
        <button
          class="closeButton hover:text-warning transition-colors duration-200"
          on:click={closeModal}>X</button
        >
      </div>
      <div class="h-full w-full p-4 flex flex-col gap-4">
        <div class="grid gap-2">
          <p>Aztec Wallets</p>
          <button
            class="btn btn-ghost btn-outline w-full flex items-center gap-2 justify-start px-2 py-6"
            on:click={connectObsidionWallet}
          >
            <img
              src="./logos/wallets/obsidion.svg"
              alt="obsidion wallet logo"
              class="size-[28px]"
            />
            Obsidion
          </button>
        </div>
        <div class="grid gap-2">
          <p>EVM Wallets</p>
          <button
            class="btn btn-ghost btn-outline w-full flex items-center gap-2 justify-start px-2 py-6"
            on:click={connectMetamaskWallet}
          >
            <img
              src="./logos/wallets/metamask.svg"
              alt="metamask wallet logo"
              class="size-[28px]"
            />
            Metamask
          </button>
          <button on:click={disconnectObsidionWallet}>Disconnect</button>
        </div>
      </div>
    </div>
  </dialog>

  <!--
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
  -->
</div>
