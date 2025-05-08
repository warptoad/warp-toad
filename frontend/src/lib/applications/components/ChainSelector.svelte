<script lang="ts">
    import { EVM_CHAINS } from "../../networks/network";
    import {
        getNetworkLogoFromId,
        getNetworkNameFromId,
    } from "../../../stores/walletStore";
    import {
        depositApplicationStore,
        type DepositData,
        setChain,
    } from "../../../stores/depositStore";

    export let isFromChain: boolean = true;

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);

    //`0x${chainId.toString(16)}`
</script>

<div class="dropdown">
    <button
        disabled={!depositData}
        tabindex="0"
        class="btn bg-accent-content text-neutral hover:bg-base-200 hover:text-accent-content p-1 h-auto rounded-full text-center flex items-center gap-2 cursor-pointer transition-colors duration-300"
        
        >
        <div class="avatar avatar-placeholder">
            <div class="bg-neutral text-neutral-content w-6 rounded-full">
                {#if depositData}
                    <img
                        src={isFromChain
                            ? getNetworkLogoFromId(
                                  depositData.fromChain.chainId,
                              )
                            : getNetworkLogoFromId(
                                  depositData.toChain.chainId,
                              )}
                        alt="current network logo"
                    />{:else}
                    <span class="text-md">{"?"}</span>
                {/if}
            </div>
        </div>
        {depositData
            ? getNetworkNameFromId(
                  isFromChain
                      ? depositData.fromChain.chainId
                      : depositData.toChain.chainId,
              )
            : "-"}
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
    </button>

    <ul
        tabindex="-1"
        class="menu dropdown-content bg-base-100 rounded-box z-1 p-2 shadow-sm w-full gap-2 flex"
    >
        {#if depositData}
            {#each EVM_CHAINS as chain}
                {#if (chain.chainId !== depositData.fromChain.chainId) && (chain.chainId !== depositData.toChain.chainId) }
                    <li class="flex flex-grow justify-center">
                        <button
                            class="outline-2 outline-[#4b484e] hover:bg-accent-content hover:text-neutral p-1 rounded-md flex items-center gap-2 cursor-pointer transition-colors duration-300"
                            on:click={() => {
                                setChain(
                                    { chainId: chain.chainId, type: "evm" },
                                    isFromChain,
                                ); //TODO REWORK WHOLE CHAIN ADAPTER
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
        {/if}
    </ul>
</div>
