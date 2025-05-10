<script lang="ts">
  import {
    evmWalletStore,
    aztecWalletStore,
    isWalletConnected,
  } from "../stores/walletStore";
  import type { EvmAccount } from "../stores/walletStore";
  import { L2AztecRootBridgeAdapterContractArtifact } from "../artifacts/L2AztecRootBridgeAdapter";
  import { WarpToadCoreContractArtifact } from "../artifacts/WarpToadCore";

  import { AztecAddress, Fr, type Wallet, Contract } from "@aztec/aztec.js";
  import { ethers } from "ethers";
    import { deployedAztecContracts } from "../stores/utils/deployedAztecContracts";

  let evmWallet: EvmAccount | undefined;
  let aztecWallet: Wallet | undefined;

  // Subscribe to the account store
  $: $evmWalletStore, (evmWallet = $evmWalletStore);
  $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);

  async function getAztecContracts(aztecWallet: Wallet) {

    const L2AztecRootBridgeAdapter = await Contract.at(
      AztecAddress.fromString(deployedAztecContracts.L2AztecRootBridgeAdapter),
      L2AztecRootBridgeAdapterContractArtifact,
      aztecWallet,
    );
    const AztecWarpToad = await Contract.at(
      AztecAddress.fromString(deployedAztecContracts.AztecWarpToad),
      WarpToadCoreContractArtifact,
      aztecWallet,
    );
    console.log(await AztecWarpToad.methods.get_decimals().simulate());
    const publicName = new Fr(
      (await AztecWarpToad.methods.public_get_name().simulate()).value,
    ).toString();
    const publicSymbol = new Fr(
      (await AztecWarpToad.methods.public_get_symbol().simulate()).value,
    ).toString();
    console.log(
      "public_get_name:" + ethers.toUtf8String(publicName).replace(/\0/g, ""),
    );
    console.log(
      "public_get_symbol:" +
        ethers.toUtf8String(publicSymbol).replace(/\0/g, ""),
    );

    const publicConfig = (
      await L2AztecRootBridgeAdapter.methods.get_config_public().simulate()
    ).portal.inner;

    console.log("CONFIG:", new Fr(publicConfig).toString());


    const getFreeToken = await AztecWarpToad.methods.mint_for_testing(6*10**18, aztecWallet.getAddress()).send().wait()
    
    const balanceOfMe = await AztecWarpToad.methods.balance_of(aztecWallet.getAddress()).simulate()

    console.log(balanceOfMe)

    //return { L2AztecRootBridgeAdapter, AztecWarpToad };
  }
</script>

<button
  class="btn btn-accent"
  on:click={() => {
    getAztecContracts(aztecWallet!);
  }}>WalletTest</button
>
