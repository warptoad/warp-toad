<script lang="ts">
  import type { Account } from "@nemi-fi/wallet-sdk";
  import {
    evmWalletStore,
    aztecWalletStore,
    isWalletConnected,
  } from "../stores/walletStore";
  import type { EvmAccount } from "../stores/walletStore";

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined;

  // Subscribe to the account store
  $: $evmWalletStore, (evmWallet = $evmWalletStore);
  $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);
</script>

<div>
  {#if isWalletConnected(aztecWallet) || isWalletConnected(evmWallet)}
    {#if isWalletConnected(aztecWallet)}
      <p>Your aztec address: {aztecWallet?.getAddress()}</p>
    {/if}
    {#if isWalletConnected(evmWallet)}
      <p>Your evm address: {evmWallet?.address}</p>
    {/if}
  {:else}
    <p>No account connected</p>
    <p>EVM: {evmWallet !== undefined}</p>
    <p>AZTEC: {aztecWallet !== undefined}</p>
  {/if}
</div>
