<script lang="ts">
    import { onMount } from "svelte";
    import {
        evmWalletStore,
        switchNetwork,
        getNetworkLogoFromName,
        getNetworkLogoFromId,
        isWalletConnected,
    } from "../../stores/walletStore";
    import type { EvmAccount } from "../../stores/walletStore";
    import { CHAINS } from "../networks/network";

    let evmWallet: EvmAccount | undefined;
    $: $evmWalletStore, (evmWallet = $evmWalletStore);

    async function handleSwitch(network: string) {
        try {
            await switchNetwork(network);
            //alert("Switched to" + network + "!");
        } catch (err) {
            console.error("Network switch failed", err);
        }
    }

    onMount(async () => {
        console.log(getNetworkLogoFromName("baseSepolia"));
    });
</script>

{#if isWalletConnected(evmWallet)}
    <div class="dropdown">
        <div tabindex="0" role="button" class="btn btn-soft p-2">
            <img
                src={getNetworkLogoFromId(
                    Number(evmWallet?.currentNetwork.chainId),
                )}
                alt="current network logo"
                class="h-full pr-1"
            />
            {evmWallet?.currentNetwork.name}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-chevron-down-icon lucide-chevron-down"
                ><path d="m6 9 6 6 6-6" /></svg
            >
        </div>
        <ul
            tabindex="-1"
            class="menu dropdown-content bg-base-100 rounded-box z-1 p-2 shadow-sm w-full gap-2"
        >
            {#each CHAINS as chain}
                {#if chain.chainId !== `0x${Number(evmWallet?.currentNetwork.chainId).toString(16)}`}
                    <li>
                        <button
                            class="btn btn-primary btn-ghost btn-soft p-2 flex justify-start"
                            on:click={() => {
                                handleSwitch(chain.id);
                            }}
                        >
                            <img
                                src={chain.svg}
                                alt={chain.id + " logo"}
                                class="h-full pr-1"
                            />
                            {chain.id}
                        </button>
                    </li>
                {/if}
            {/each}
        </ul>
    </div>
{/if}
