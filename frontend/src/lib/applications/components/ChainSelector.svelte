<script lang="ts">
    import { EVM_CHAINS } from "../../networks/network";
    import {
        type EvmAccount,
        evmWalletStore,
        switchNetwork,
        getNetworkLogoFromId,
        getNetworkNameFromId
    } from "../../../stores/walletStore";

    export let forceChain: boolean = false; 

    let evmWallet: EvmAccount | undefined;
    $: $evmWalletStore, (evmWallet = $evmWalletStore);

    export let currentSelectedChain = "";

    $: if (forceChain === false && evmWallet?.currentNetwork?.chainId) {
    currentSelectedChain = `0x${Number(evmWallet.currentNetwork.chainId).toString(16)}`
}

    //`0x${chainId.toString(16)}`

    async function handleSwitch(network: string) {
        try {
            await switchNetwork(network);
            //alert("Switched to" + network + "!");
        } catch (err) {
            console.error("Network switch failed", err);
        }
    }
</script>
<div class="dropdown">
    <div
        tabindex="0"
        role="button"
        class="bg-accent-content text-neutral hover:bg-base-200 hover:text-accent-content p-1 rounded-full text-center flex items-center gap-2 cursor-pointer transition-colors duration-300"
    >
        <div class="avatar avatar-placeholder">
            <div class="bg-neutral text-neutral-content w-6 rounded-full">
                {#if getNetworkLogoFromId(Number(evmWallet?.currentNetwork.chainId))}
                    <img
                        src={(forceChain === false)?getNetworkLogoFromId(
                            Number(evmWallet?.currentNetwork.chainId),
                        ):getNetworkLogoFromId(currentSelectedChain)}
                        alt="current network logo"
                    />{:else}
                    <span class="text-md">{evmWallet?.currentNetwork.name}</span
                    >
                {/if}
            </div>
        </div>
        {(forceChain===false)?evmWallet?.currentNetwork.name: getNetworkNameFromId(currentSelectedChain)}
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
        class="menu dropdown-content bg-base-100 rounded-box z-1 p-2 shadow-sm w-full gap-2 flex"
    >
        {#each EVM_CHAINS as chain}
            {#if chain.chainId !== `0x${Number(evmWallet?.currentNetwork.chainId).toString(16)}`}
                <li class="flex flex-grow justify-center">
                    <button
                        class="outline hover:bg-accent-content hover:text-neutral p-1 rounded-md flex items-center gap-2 cursor-pointer transition-colors duration-300"
                        on:click={() => {
                            handleSwitch(chain.id);
                        }}
                    >
                        <div class="avatar avatar-placeholder">
                            <div
                                class="bg-neutral text-neutral-content w-6 rounded-full"
                            >
                                {#if chain.svg}
                                    <img
                                        src={chain.svg}
                                        alt={chain.id + " logo"}
                                    />{:else}
                                    <span class="text-md">{chain.id}</span>
                                {/if}
                            </div>
                        </div>
                        {chain.id}
                    </button>
                </li>
            {/if}
        {/each}
    </ul>
</div>
