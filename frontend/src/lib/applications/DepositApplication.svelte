<script lang="ts">
    import {
        depositApplicationStore,
        type DepositData,
        toggleOrigin,
        swapChains,
    } from "../../stores/depositStore";
    import DepositFrom from "./components/DepositFrom.svelte";
    import DepositTo from "./components/DepositTo.svelte";

    //from
    //TODO DO CHAIN SELECTOR WITH MODAL SIMILAR TO TOKEN SELECTOR
    //do deposit storage:
    /**
     * From-Chain
     * To-Chain
     * Token
     * TokenAmount
     * TokenBalance?
     * fetchTokenPricePerToken
     */
    //switch Network
    //to
    //calc/info
    //go/continue

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);
</script>

<div class="h-full w-full flex flex-col justify-center items-center">
    <div class="w-4/6 flex flex-col gap-2">
        <div class="flex flex-col justify-around items-center gap-2 relative">
            <DepositFrom />
            <button
                disabled={!depositData}
                on:click={swapChains}
                class="group cursor-pointer text-base-content bg-base-300 rounded-md p-2 outline-6 outline-base-200 absolute z-10 top-7/12 left-1/2 -translate-x-1/2 -translate-y-1/2"
                aria-label="switch"
            >
                <svg
                    height="36"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-chevrons-down-icon lucide-chevrons-down transition-transform duration-300 group-hover:-rotate-180"
                    ><path d="m7 6 5 5 5-5" /><path d="m7 13 5 5 5-5" /></svg
                ></button
            >
            <DepositTo />
        </div>
        <div class="bg-base-300 p-2 rounded-md w-full">estimation</div>
        <button class="btn btn-accent w-full">continue</button>
    </div>
</div>
