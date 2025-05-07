<script lang="ts">
  import type { Account } from "@nemi-fi/wallet-sdk";
  import { Contract } from "@nemi-fi/wallet-sdk/eip1193";
  import {
    evmWalletStore,
    aztecWalletStore,
    sdk,
    isWalletConnected,
  } from "../stores/walletStore";
  import type { EvmAccount } from "../stores/walletStore";
  import { L2AztecRootBridgeAdapterContractArtifact } from "../artifacts/L2AztecRootBridgeAdapter";
  import {
    WarpToadCoreContract,
    WarpToadCoreContractArtifact,
  } from "../artifacts/WarpToadCore";

  import { AztecAddress, Fr } from "@aztec/aztec.js";
    import { ethers } from "ethers";

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Account | undefined;

  // Subscribe to the account store
  $: $evmWalletStore, (evmWallet = $evmWalletStore);
  $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);
  

  async function getAztecContracts(aztecWallet: Account) {
    const contracts = {
      AztecWarpToad:
        "0x25307e2f565eada87ba684657fb42cae5d96b118d8b61f4df21b0c4b2a3f4b54",
      L2AztecRootBridgeAdapter:
        "0x1df67ccc38b072b4bcb853de7f1036632a2ef7ee7a3bbd6fd11773e17e39664f",
    };
      
    const L2AztecRootBridgeAdapter = await Contract.at(
      AztecAddress.fromString(contracts.L2AztecRootBridgeAdapter),
      L2AztecRootBridgeAdapterContractArtifact,
      aztecWallet,
    );
    const AztecWarpToad = await Contract.at(
      AztecAddress.fromString(contracts.AztecWarpToad),
      WarpToadCoreContractArtifact,
      aztecWallet,
    );
    console.log(await AztecWarpToad.methods.get_decimals().simulate());
    const publicName = new Fr((await AztecWarpToad.methods.public_get_name().simulate()).value).toString()
    const publicSymbol = new Fr((await AztecWarpToad.methods.public_get_symbol().simulate()).value).toString()
    console.log("public_get_name:"+ethers.toUtf8String(publicName).replace(/\0/g, ''));
    console.log("public_get_symbol:"+ethers.toUtf8String(publicSymbol).replace(/\0/g, ''));

    //return { L2AztecRootBridgeAdapter, AztecWarpToad };
  }
</script>

<button
  class="btn btn-accent"
  on:click={() => {
    getAztecContracts(aztecWallet!);
  }}>WalletTest</button
>
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
