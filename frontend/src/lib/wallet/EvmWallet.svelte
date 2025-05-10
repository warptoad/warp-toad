<script lang="ts">
    import {
        type EvmAccount,
        connectMetamaskWallet,
        disconnectMetamaskWallet,
        isWalletConnected,
        evmWalletStore,
        truncateAddress,
        mintTestTokens,
    } from "../../stores/walletStore";

    let evmWallet: EvmAccount | undefined;
    $: $evmWalletStore, (evmWallet = $evmWalletStore);

    
</script>

<div class="h-full flex flex-col gap-2">
    <div
        class="flex gap-2"
        class:text-success={isWalletConnected($evmWalletStore)}
        class:text-error={!isWalletConnected($evmWalletStore)}
    >
        <p>EVM Wallets</p>
        {#if isWalletConnected(evmWallet)}
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
                class="lucide lucide-circle-check-icon lucide-circle-check"
                ><circle cx="12" cy="12" r="10" /><path
                    d="m9 12 2 2 4-4"
                /></svg
            >
        {:else}
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
                class="lucide lucide-circle-x-icon lucide-circle-x"
                ><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path
                    d="m9 9 6 6"
                /></svg
            >
        {/if}
    </div>
    <div class="divider m-0"></div>
    <div class="h-full flex flex-col justify-between">
        {#if isWalletConnected(evmWallet)}
            <div class="text-center">
                <p>Evm Address</p>
                <p>{truncateAddress(evmWallet?.address!)}</p>
            </div>
            <button
                class="btn btn-ghost btn-outline border-[rgba(255,255,255,.25)] w-full flex items-center gap-2 justify-start px-2 py-6"
                on:click={async()=>{await mintTestTokens()}}>getTestnetToken</button
            >
            <button
                class="btn btn-error w-full flex items-center gap-2 justify-start px-2 py-6"
                on:click={disconnectMetamaskWallet}
            >
                <div class="bg-white p-1 rounded-md">
                    <img
                        src="./logos/wallets/metamask.svg"
                        alt="metamask wallet logo"
                        class="size-[28px]"
                    />
                </div>
                Disconnect Wallet
            </button>
        {:else}
            <button
                class="btn btn-ghost btn-outline border-[rgba(255,255,255,.25)] w-full flex items-center gap-2 justify-start px-2 py-6"
                on:click={connectMetamaskWallet}
            >
                <div class="bg-white p-1 rounded-md">
                    <img
                        src="./logos/wallets/metamask.svg"
                        alt="metamask wallet logo"
                        class="size-[28px]"
                    />
                </div>
                Metamask
            </button>
        {/if}
    </div>
</div>
