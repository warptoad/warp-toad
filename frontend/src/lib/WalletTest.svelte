<script lang="ts">
  import type { Account } from "@nemi-fi/wallet-sdk";
  import {Contract} from "@nemi-fi/wallet-sdk/eip1193"
  import {
    evmWalletStore,
    aztecWalletStore,
    //sdk,
    isWalletConnected,
  } from "../stores/walletStore";
  import type { EvmAccount } from "../stores/walletStore";
  import { L2AztecRootBridgeAdapterContractArtifact } from "../artifacts/L2AztecRootBridgeAdapter";
  import { WarpToadCoreContract } from "../artifacts/WarpToadCore";

  import { AztecAddress } from "@aztec/aztec.js";

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined;

  // Subscribe to the account store
  $: $evmWalletStore, (evmWallet = $evmWalletStore);
  $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);

  async function getAztecContracts(aztecWallet: Account) {
    const contracts = {
      AztecWarpToad:
        "0x28c36de9c6655d56f0e7a6b1df527057f66c242ddde985348007603a8989ada5",
      L2AztecRootBridgeAdapter:
        "0x1ebf9241b758a4b7611f1d0fa15ce50c25a0a50f6a4a0fc8eb098193b5fdec44",
    };

    const L2AztecRootBridgeAdapter = await Contract.at(AztecAddress.fromString(contracts.L2AztecRootBridgeAdapter), L2AztecRootBridgeAdapterContractArtifact, aztecWallet)
    const AztecWarpToad = await WarpToadCoreContract.at(
      AztecAddress.fromString(contracts.AztecWarpToad),
      aztecWallet.getAddress(),
    );
    return { L2AztecRootBridgeAdapter, AztecWarpToad };
  }
</script>

<!--
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
-->
