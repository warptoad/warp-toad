<script lang="ts">
  import { ethers } from "ethers";
  import type { Account } from "@nemi-fi/wallet-sdk";
  import { evmWalletStore, aztecWalletStore, isEvmConnected, isAztecConnected, connectMetamaskWallet, connectObsidionWallet, disconnectMetamaskWallet, disconnectObsidionWallet } from "../stores/walletStore";
  import type {EvmAccount} from "../stores/walletStore";

  let walletModal: HTMLDialogElement | null = null;

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined

  // Subscribe to account store reactively
  $: $evmWalletStore, evmWallet = $evmWalletStore;
  $: $aztecWalletStore, aztecWallet = $aztecWalletStore;

  function formatAddress(address: string) {
    if (!address) return "";
    return address.slice(0, 5) + "..." + address.slice(-3);
  }

  /**
   * TODO: OPEN MODAL SELECTION
   * Let User Chose evm or Aztec Wallet
   * Let user Chose Chain Sepolia, whatever?
   * */

  function openModal() {
    walletModal?.showModal();
  }

  function closeModal() {
    walletModal?.close();
  }

  async function disconnectAll() {
    await disconnectMetamaskWallet();
    await disconnectObsidionWallet();
    closeModal()
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
          <button on:click={disconnectAll}>Disconnect</button>
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
