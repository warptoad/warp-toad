<script lang="ts">
    import ChainSelector from "./ChainSelector.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    import {
        setDepositTokenAmount,
        depositApplicationStore,
        type DepositData,
        getSelectedTokenBalance,
    } from "../../../stores/depositStore";
    import {
        getTokenAddress,
        getTokenBalance,
    } from "../../../stores/walletStore";

    //TODO FETCHING OF TOKEN BALANCE AND USD PRICE PER TOKEN

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);

    let tokenBalance: number | undefined;

    $: (async () => {
        const currentDeposit = $depositApplicationStore;
        if (!currentDeposit) {
            tokenBalance = undefined;
            return;
        }

        tokenBalance = await getSelectedTokenBalance();
    })();

    let previousTokenName:string|undefined;

    $: if (
        depositData?.tokenName &&
        depositData.tokenName !== previousTokenName
    ) {
        previousTokenName = depositData.tokenName;
        tokenDepositInput = "";
    }
    let tokenDepositInput = "";

    $: setDepositTokenAmount(Number(tokenDepositInput));
    $: tokenDepositInputToDollar = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(tokenDepositInput) * 1);

    function handleTokenSplit(amount: number) {
        tokenDepositInput = (
            ((tokenBalance ? tokenBalance : 0) / 100) *
            amount
        ).toFixed(2);
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
                if (val > (tokenBalance ? tokenBalance : 0))
                    tokenDepositInput = (
                        tokenBalance ? tokenBalance : 0
                    ).toString();
            }}
        />
    </div>
    <div class="w-full flex items-center gap-2 justify-between">
        <div class="flex gap-2 items-center">
            <p class="text-sm">
                balance: {new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(Number(tokenBalance?tokenBalance:0))}
            </p>
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
