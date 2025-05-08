<script lang="ts">
    import { depositApplicationStore, type DepositData } from "../../../stores/depositStore";
    import { getTokenIconBySymbol } from "../../tokens/tokens";
    import ChainSelector from "./ChainSelector.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    let currentSelectedChain = "0x14a34"
    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);
</script>

<div class="bg-base-300 p-4 rounded-md w-full flex flex-col gap-2">
    <div class="flex items-center gap-2 justify-between">
        <p>to</p>
        <ChainSelector isFromChain={false}/>
    </div>
    <div class="divider m-0"></div>
    <div class="flex gap-4"></div>
    <div class="w-full flex items-center gap-2 justify-between">
        <div class="flex gap-2 items-center">
            <p class="text-sm">you will receive</p>
        </div>
        <div class="flex gap-2 items-center justify-between">
            <p class="">{depositData?.tokenAmount?depositData?.tokenAmount:0}</p>
            <div
                class="bg-base-100 p-0 pr-2 rounded-full flex items-center gap-2"
            >
                <img
                    src={depositData?.tokenName?getTokenIconBySymbol(depositData?.tokenName):getTokenIconBySymbol("USDC")}
                    alt="current token logo"
                />
                <p>
                    {depositData?.tokenName?depositData?.tokenName:"USDC"}
                </p>
            </div>
        </div>
    </div>
</div>
