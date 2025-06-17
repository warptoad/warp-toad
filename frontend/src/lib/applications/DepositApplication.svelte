<script lang="ts">
    import {
        depositApplicationStore,
        commitmentPreImgStore,
        type DepositData,
        toggleOrigin,
        swapChains,
        approveToken,
        wrapToken,
        getChainIdAztecFromContract,
        createPreCommitment,
        burnToken,
        mintOnL2,
        schnorrTest,
        createRandomPreImg,
        warptoadNoteStore,
        type WarptoadNote,
        evmStartBridge,
        clearDepositState,
    } from "../../stores/depositStore";
    import DepositFrom from "./components/DepositFrom.svelte";
    import DepositTo from "./components/DepositTo.svelte";
    import { Confetti } from "svelte-confetti";
    let currentStep = 0;

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);

    let warptoadNoteData: WarptoadNote | undefined;
    $: $warptoadNoteStore, (warptoadNoteData = $warptoadNoteStore);

    $: isDepositDataValid =
        !!depositData &&
        !!depositData.fromChain?.chainId &&
        !!depositData.toChain?.chainId &&
        !!depositData.tokenName &&
        depositData.tokenAmount > 0;

    $: isApproved = depositData?.approved;

    function handleNewDeposit() {
        clearDepositState();
        currentStep = 0;
    }

    function downloadFile(data: WarptoadNote) {
        const timestamp = Date.now();
        const filename = `warptoad${timestamp}.txt`;

        // Convert BigInt to string for JSON
        const jsonString = JSON.stringify(
            data,
            (_, value) =>
                typeof value === "bigint" ? value.toString() : value,
            2,
        );

        const blob = new Blob([jsonString], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    async function handleBridge() {
        currentStep++;

        //user shall not see this window anymore

        const aztecChainID = await getChainIdAztecFromContract();

        if (!aztecChainID) {
            console.log("ERROR GETTING AZTEC CHAIN ID");
            return;
        }
        await createPreCommitment(aztecChainID);

        //creating secrets

        if (!warptoadNoteData) {
            console.log("ERROR PREIMAGE NOT SET");
            return;
        }

        currentStep++;

        await wrapToken();

        currentStep++;

        //wraping

        await burnToken(
            warptoadNoteData.preCommitment,
            warptoadNoteData.preImg.amount,
        );

        currentStep++;

        //bridging is all that is left
        downloadFile(warptoadNoteData);

        //RESET DEPOSIT STATE
        currentStep++;
    }

    async function handleApprove() {
        await approveToken();
    }
</script>

<div class="h-full w-full flex flex-col justify-center items-center">
    <div class="w-4/6 flex flex-col gap-2 py-16">
        {#if currentStep === 0}
            <div
                class="flex flex-col justify-around items-center gap-2 relative"
            >
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
                        ><path d="m7 6 5 5 5-5" /><path
                            d="m7 13 5 5 5-5"
                        /></svg
                    ></button
                >
                <DepositTo />
            </div>
            <div class="bg-base-300 p-2 rounded-md w-full">estimation</div>
            {#if !isApproved}
                <button
                    disabled={!isDepositDataValid}
                    on:click={async () => {
                        await handleApprove();
                    }}
                    class="btn btn-accent w-full">Approve</button
                >
            {:else}
                <button
                    disabled={!isDepositDataValid}
                    on:click={async () => {
                        await handleBridge();
                    }}
                    class="btn btn-accent w-full">Start Bridging</button
                >
            {/if}
        {:else if currentStep === 5}
            <div class="flex flex-col gap-4 justify-center items-center h-full">
                
                <div class="flex">
                    <Confetti x={[-1, -0.25]} y={[0, 0.5]}/>
                    <p class="text-center">You successfully Bridged!</p>
                    <Confetti x={[0.25, 1]} y={[0, 0.5]} />
                </div>
                <div class="flex flex-col gap-4 w-1/2">
                    <button
                        class="btn btn-primary"
                        on:click={() =>
                            warptoadNoteData && downloadFile(warptoadNoteData)}
                        >Redownload Note</button
                    >
                    <button class="btn btn-warning" on:click={handleNewDeposit}
                        >new deposit</button
                    >
                </div>
            </div>
        {:else}
            <p class="text-center">loading</p>
            <progress class="progress w-full" value={currentStep} max="4"
            ></progress>
        {/if}
    </div>
</div>
