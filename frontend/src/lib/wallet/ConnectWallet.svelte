<script lang="ts">
  import { onMount } from "svelte"; //IMPORT FOR MODAL TEST DEV
  import { ethers } from "ethers";
  import type { Account } from "@nemi-fi/wallet-sdk";
  import {
    evmWalletStore,
    aztecWalletStore,
    isWalletConnected,
    disconnectMetamaskWallet,
    disconnectObsidionWallet,
  } from "../../stores/walletStore";
  import type { EvmAccount } from "../../stores/walletStore";

  import EvmWallet from "./EvmWallet.svelte";
  import AztecWallet from "./AztecWallet.svelte";
    import WalletNetworkSwitch from "./WalletNetworkSwitch.svelte";

  let walletModal: HTMLDialogElement | null = null;

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined;

  // Subscribe to account store reactively
  $: $evmWalletStore, (evmWallet = $evmWalletStore);
  $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);

  /**
   * TODO: Progress visual for how many wallets have been added e.g.: 1evm+1aztec=100% 
   * TODO: figure out why obsidion wallet does not stay connected after refresh
   * */

  function openModal() {
    walletModal?.showModal();
  }

  //TEST: remove onMount on "prod"
  onMount(() => {
    //openModal();
    disconnectAll();
  });

  function closeModal() {
    walletModal?.close();
  }

  async function disconnectAll() {
    await disconnectMetamaskWallet();
    await disconnectObsidionWallet();
    //closeModal()
  }
</script>

<div class="flex gap-2 items-center">
  <WalletNetworkSwitch/>
  <button
    class="btn btn-outline btn-info"
    on:click={openModal}
    class:btn-warning={isWalletConnected(evmWallet || aztecWallet) &&
      !isWalletConnected(evmWallet && aztecWallet)}
    class:btn-success={isWalletConnected(evmWallet && aztecWallet)}
  >
    {#if isWalletConnected(evmWallet || aztecWallet)}
      Wallet Manager
    {:else}
      Connect
    {/if}
  </button>
  <dialog bind:this={walletModal} class="modal">
    <div
      class="modal-box w-8/12 max-w-5xl h-8/12 max-h-5xl rounded-md bg-base-100 border-2 p-0 flex flex-col justify-between"
    >
      <div
        class="border-b-2 p-2 mb-2 draggable flex justify-between items-center bg-base-300"
      >
        <div>Wallet Manager</div>
        <button
          class="closeButton hover:text-warning transition-colors duration-200"
          on:click={closeModal}>X</button
        >
      </div>
      <div class="h-full w-full p-4 flex flex-row gap-4">
        <div class="w-1/2">
          <EvmWallet />
        </div>
        <div class="divider divider-horizontal m-0"></div>
        <div class="w-1/2">
          <AztecWallet />
        </div>
      </div>
    </div>
  </dialog>
</div>
