<script lang="ts">
    import ChainSelector from "./ChainSelector.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    import { setDepositTokenAmount } from "../../../stores/depositStore";

    //TODO FETCHING OF TOKEN BALANCE AND USD PRICE PER TOKEN

    let depositChainSelection = "";

    let tokenBalance = 123;
    let tokenDepositInput = "";
    $: setDepositTokenAmount(Number(tokenDepositInput));
    /*$: if (Number(tokenDepositInput) > tokenBalance) {
        tokenDepositInput = tokenBalance.toString();
    }*/
    $: tokenDepositInputToDollar = (Number(tokenDepositInput) * 1.1).toFixed(2);

    function handleTokenSplit(amount: number) {
        tokenDepositInput = ((tokenBalance / 100) * amount).toFixed(2);
    }
</script>

<div class="bg-base-300 p-4 rounded-md w-full flex flex-col gap-2">
    <div class="flex items-center gap-2 justify-between">
        <p>from</p>
        <ChainSelector />
    </div>
    <div class="divider m-0"></div>
    <div class="flex gap-4">
        <TokenSelector />
        <input
            type="text"
            class="input input-lg input-ghost w-full text-2xl text-right px-0"
            placeholder="0.00"
            bind:value={tokenDepositInput}
            on:input={() => {
                const val = Number(tokenDepositInput);
                if (val > tokenBalance)
                    tokenDepositInput = tokenBalance.toString();
            }}
        />
    </div>
    <div class="w-full flex items-center gap-2 justify-between">
        <div class="flex gap-2 items-center">
            <p class="text-sm">balance: {tokenBalance}</p>
            <button
                on:click={() => {
                    handleTokenSplit(100);
                }}
                class="btn btn-xs btn-outline rounded-full">max</button
            >
        </div>
        <p class="text-sm">${tokenDepositInputToDollar}</p>
    </div>
</div>
