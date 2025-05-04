<script lang="ts">
    import type { Account } from "@nemi-fi/wallet-sdk";
    import {
        connectObsidionWallet,
        disconnectObsidionWallet,
        isWalletConnected,
        aztecWalletStore,
        truncateAddress,
    } from "../../stores/walletStore";

    let aztecWallet: Account | undefined;
    $: $aztecWalletStore, (aztecWallet = $aztecWalletStore);
</script>

<div class="h-full flex flex-col gap-2">
    <div
        class="flex gap-2"
        class:text-success={isWalletConnected($aztecWalletStore)}
        class:text-error={!isWalletConnected($aztecWalletStore)}
    >
        <p>Aztec Wallets</p>
        {#if isWalletConnected(aztecWallet)}
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
        {#if isWalletConnected(aztecWallet)}
            <div class="text-center">
                <p>Aztec Address</p>
                <p>{truncateAddress(aztecWallet?.getAddress().toString()!)}</p>
            </div>
            <button
                class="btn btn-error w-full flex items-center gap-2 justify-start px-2 py-6"
                on:click={disconnectObsidionWallet}
            >
                <div class="bg-white p-1 rounded-md">
                    <img
                        src="./logos/wallets/obsidion.svg"
                        alt="obsidion wallet logo"
                        class="size-[28px]"
                    />
                </div>
                Disconnect Wallet
            </button>
        {:else}
            <button
                class="btn btn-ghost btn-outline border-[rgba(255,255,255,.25)] w-full flex items-center gap-2 justify-start px-2 py-6"
                on:click={connectObsidionWallet}
            >
                <div class="bg-white p-1 rounded-md">
                    <img
                        src="./logos/wallets/obsidion.svg"
                        alt="obsidion wallet logo"
                        class="size-[28px]"
                    />
                </div>
                Obsidion
            </button>
        {/if}
    </div>
</div>
