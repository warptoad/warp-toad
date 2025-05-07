<script lang="ts">
    import { getTokenIconBySymbol } from "../../tokens/tokens";
    import ChainSelector from "./ChainSelector.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    export let currentTokenSelected = "";
    let currentSelectedChain = "0x14a34"
    export let tokenDepositInput = "";
</script>

<div class="bg-base-300 p-4 rounded-md w-full flex flex-col gap-2">
    <div class="flex items-center gap-2 justify-between">
        <p>to</p>
        <ChainSelector currentSelectedChain={"0x14a34"} forceChain={true}/>
    </div>
    <div class="divider m-0"></div>
    <div class="flex gap-4"></div>
    <div class="w-full flex items-center gap-2 justify-between">
        <div class="flex gap-2 items-center">
            <p class="text-sm">you will receive</p>
        </div>
        <div class="flex gap-2 items-center justify-between">
            <p class="">{tokenDepositInput?tokenDepositInput:0}</p>
            <div
                class="bg-base-100 p-0 pr-2 rounded-full flex items-center gap-2"
            >
                <img
                    src={getTokenIconBySymbol(currentTokenSelected)}
                    alt="current token logo"
                />
                <p>
                    {currentTokenSelected}
                </p>
            </div>
        </div>
    </div>
</div>
