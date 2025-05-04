<script lang="ts">
    import { onMount } from "svelte";
    import {
        evmWalletStore,
        switchNetwork,
        getCurrentNetwork,
        getNetworkLogo,
        isWalletConnected,
    } from "../../stores/walletStore";
    import type { EvmAccount } from "../../stores/walletStore";

    let evmWallet: EvmAccount | undefined;
    $: $evmWalletStore, (evmWallet = $evmWalletStore);

    //let logo: string | undefined = $state(undefined);
    let logo: string | undefined = undefined;

    async function handleSwitch() {
        try {
            await switchNetwork("sepolia");
            alert("Switched to sepolia!");
        } catch (err) {
            console.error("Network switch failed", err);
        }
    }

    async function getCurrent() {
        try {
            const current = await getCurrentNetwork();
            logo = getNetworkLogo(Number(current.chainId));
        } catch (error) {}
    }
    onMount(async () => {
        console.log(Number(evmWallet?.currentNetwork.chainId).toString(16));
    });
</script>

{#if isWalletConnected(evmWallet)}
    <button class="btn btn-outline" on:click={handleSwitch}>
        <img
            src={getNetworkLogo(Number(evmWallet?.currentNetwork.chainId))}
            alt="current network logo"
            class="h-full p-1"
        />
        Switch
    </button>
{/if}
