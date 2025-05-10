<script lang="ts">
    import {
        depositApplicationStore,
        type DepositData,
        pickToken,
    } from "../../../stores/depositStore";
    import {
        getTokenIconBySymbol,
        getTokensFromChainId,
        type Token,
    } from "../../tokens/tokens";

    let depositData: DepositData | undefined;
    $: $depositApplicationStore, (depositData = $depositApplicationStore);

    let currentTokenSelection: Token[];

    $: if(depositData){
        currentTokenSelection = getTokensFromChainId(depositData.fromChain.type==="aztec", depositData.fromChain.chainId);
    } 

    let tokenSelectModal: HTMLDialogElement | null = null;

    function openModal() {
        tokenSelectModal?.showModal();
    }

    function closeModal() {
        tokenSelectModal?.close();
    }

    function selectToken(token: string) {
        pickToken(token);
        closeModal();
    }
</script>

<!-- You can open the modal using ID.showModal() method -->
<dialog bind:this={tokenSelectModal} class="modal">
    <div
        class="modal-box w-1/3 max-w-5xl h-8/12 max-h-5xl rounded-md bg-base-100 border-2 p-0 flex flex-col justify-between"
    >
        <div
            class="border-b-2 p-4 flex justify-between items-center bg-base-300 gap-2"
        >
            <label class="input w-full">
                <svg
                    class="h-[1em] opacity-50"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                >
                    <g
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        stroke-width="2.5"
                        fill="none"
                        stroke="currentColor"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.3-4.3"></path>
                    </g>
                </svg>
                <input
                    type="search"
                    class="grow"
                    placeholder="search by name"
                />
            </label>
            <button
                class="bg-neutral p-4 py-2 rounded-md outline-1 outline-[#4b484e] hover:text-warning transition-colors duration-200"
                on:click={closeModal}>X</button
            >
        </div>
        <div class="h-full w-full p-4 flex flex-col gap-4">
            {#each currentTokenSelection as token}
                <button
                    on:click={() => {
                        selectToken(token.tokenName);
                    }}
                    class="bg-base-100 hover:bg-base-200 hover:cursor-pointer w-full flex gap-4 outline-1 outline-[#4b484e] rounded-md p-2 justify-between transition-colors duration-200"
                >
                    <div class="flex gap-2">
                        <div class="avatar avatar-placeholder">
                            <div
                                class="text-neutral-content h-full w-full rounded-full"
                            >
                                {#if getTokenIconBySymbol(token.tokenName)}
                                    <img
                                        src={getTokenIconBySymbol(
                                            token.tokenName,
                                        )}
                                        alt="current token logo"
                                    />{:else}
                                    <span class="text-md"
                                        >{token.tokenName}</span
                                    >
                                {/if}
                            </div>
                        </div>
                        <div>
                            <legend class="fieldset-legend text-sm"
                                >{token.tokenName}</legend
                            >
                            <p class="label text-xs">{token.tokenSymbol}</p>
                        </div>
                    </div>
                    {#if token.tokenName === depositData?.tokenName}
                        <div
                            class="bg-info text-info-content aspect-square h-full rounded-md p-2 flex items-center justify-center"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-check-icon lucide-check"
                                ><path d="M20 6 9 17l-5-5" /></svg
                            >
                        </div>
                    {/if}
                </button>
            {/each}
        </div>
    </div>
</dialog>

<button
    on:click={openModal}
    disabled={!depositData}
    class="btn btn-primary p-1 rounded-full text-center flex items-center gap-2"
>
    {#if depositData}
    <img
        src={getTokenIconBySymbol(depositData.tokenName)}
        alt="current token logo"
    />
    <p>
        {depositData.tokenName}
    </p>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-chevron-down-icon lucide-chevron-down"
        ><path d="m6 9 6 6 6-6" /></svg
    >
        
    {:else}
    <p class="text-warning pl-2">
        not connected
    </p>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-chevron-down-icon lucide-chevron-down"
        ><path d="m6 9 6 6 6-6" /></svg
    >
    
    {/if}
</button>
