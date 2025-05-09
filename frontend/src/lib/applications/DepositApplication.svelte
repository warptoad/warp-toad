<script lang="ts">
    import {
        depositApplicationStore,
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
    } from "../../stores/depositStore";
    import DepositFrom from "./components/DepositFrom.svelte";
    import DepositTo from "./components/DepositTo.svelte";

    let currentStep = 0;

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);

    $: isDepositDataValid =
        !!depositData &&
        !!depositData.fromChain?.chainId &&
        !!depositData.toChain?.chainId &&
        !!depositData.tokenName &&
        depositData.tokenAmount > 0;

    $: isApproved = depositData?.approved

    async function testing(){
        /*
        const aztecChainId=await getChainIdAztecFromContract();
        if(!aztecChainId){
            console.log("ERROR, COULD NOT FETCH AZTECCHAINID")
            return;
        }
        console.log(aztecChainId);
        const preCommitment = await createPreCommitment(aztecChainId)
        if(!preCommitment){
            console.log("failed to define preCommitment")
            return;
        }
        */
        const preImg = {
            amount: 5,
            destination_chain_id: 14266059373119162146721148758825988891396810944760983798453626204657962433224n,
            nullifier_preimg: 180916128317787095431314509724722126630260260622496260687630801844790019140n,
            secret: 5182287669277471989491523685751199241627595278062447707376026688007588349928n
        }

        await mintOnL2(preImg);
        //await schnorrTest();
        /**
         * Object { amount: 5000000000000000000, destination_chain_id: 14266059373119162146721148758825988891396810944760983798453626204657962433224n, secret: 5182287669277471989491523685751199241627595278062447707376026688007588349928n, nullifier_preimg: 180916128317787095431314509724722126630260260622496260687630801844790019140n }
​
            amount: 5000000000000000000
            ​
            destination_chain_id: 14266059373119162146721148758825988891396810944760983798453626204657962433224n
            ​
            nullifier_preimg: 180916128317787095431314509724722126630260260622496260687630801844790019140n
            ​
            secret: 5182287669277471989491523685751199241627595278062447707376026688007588349928n
            ​
            <prototype>: Object { … }
            depositStore.ts:326:12

        */


        //await burnToken(preCommitment, 5)
    }

    async function handleApprove() {
        await approveToken();
    }

    async function handleWrap(){
        await wrapToken();
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
            <button
                on:click={async () => {
                    await testing();
                }}
                class="btn btn-accent w-full">test</button
            >
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
                        await handleWrap();
                    }}
                    class="btn btn-accent w-full">Prepare Token</button
                >
            {/if}
        {:else if currentStep === 1}
            <p class="text-center">This is me on step 1</p>
            <div class="w-full flex gap-2">
                <button
                    on:click={() => {
                        currentStep--;
                    }}
                    class="btn btn-error w-1/2">back</button
                >
                <button
                    on:click={() => {
                        currentStep++;
                    }}
                    class="btn btn-accent w-1/2">continue</button
                >
            </div>
        {:else if currentStep === 2}
            <p class="text-center">This is me on step 2</p>
            <div class="w-full flex gap-2">
                <button
                    on:click={() => {
                        currentStep--;
                    }}
                    class="btn btn-error w-1/2">back</button
                >
                <button on:click={() => {}} class="btn btn-accent w-1/2"
                    >continue</button
                >
            </div>
        {/if}
    </div>
</div>
