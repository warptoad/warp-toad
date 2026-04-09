<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Wallet,
		Shield,
		Loader2,
		AlertCircle,
		CheckCircle2,
		Zap,
	} from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import {
		mintFreeTokens,
		triggerBridgeSync,
	} from "$lib/utils/evm-interactions";
	import { getChainId, NETWORKS } from "$lib/utils/evm-wallet";
	import { getAztecWarpToadBalance } from "$lib/utils/aztec-interactions";
	import { getWalletInstance } from "$lib/utils/aztec-wallet";
	import {
		getFaucetInfo,
		claimFaucet,
		isFaucetServiceAvailable,
		type FaucetChainStatus,
	} from "$lib/utils/faucet-client";
	import type { Chain } from "$lib/types/bridge";
	import { isTestMode } from "$lib/config/chains.js";
	import type { AztecAccountMode } from "$lib/utils/aztec-wallet";
	import { onMount } from "svelte";
	import { Droplet } from "@lucide/svelte";

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	let isSyncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncSuccess = $state<string | null>(null);

	// Faucet state
	const FAUCET_SUPPORTED_CHAINS = new Set([11155111, 534351]);
	let faucetAvailable = $state(false);
	let faucetStatus = $state<Record<string, FaucetChainStatus> | null>(null);
	let faucetLoading = $state(false);
	let faucetClaiming = $state(false);
	let faucetError = $state<string | null>(null);
	let faucetSuccess = $state<string | null>(null);

	let isFaucetSupportedChain = $derived(
		walletStore.chainId !== null && FAUCET_SUPPORTED_CHAINS.has(walletStore.chainId),
	);
	let currentChainClaimStatus = $derived.by<FaucetChainStatus | null>(() => {
		if (!faucetStatus || walletStore.chainId === null) return null;
		return faucetStatus[walletStore.chainId.toString()] ?? null;
	});

	async function refreshFaucetStatus() {
		if (!walletStore.wallets.evm || !faucetAvailable) {
			faucetStatus = null;
			return;
		}
		faucetLoading = true;
		try {
			const info = await getFaucetInfo(walletStore.wallets.evm);
			faucetStatus = info?.chains ?? null;
		} finally {
			faucetLoading = false;
		}
	}

	async function handleClaimFaucet() {
		if (!walletStore.wallets.evm || walletStore.chainId === null) return;
		faucetClaiming = true;
		faucetError = null;
		faucetSuccess = null;
		try {
			const result = await claimFaucet(walletStore.wallets.evm, walletStore.chainId);
			faucetSuccess = `Sent! tx ${result.txHash.slice(0, 10)}...`;
			await refreshFaucetStatus();
			// Refresh balances so the new ETH shows up if the UI displays it.
			await balanceStore.refresh();
		} catch (err) {
			faucetError = err instanceof Error ? err.message : "Faucet claim failed";
		} finally {
			faucetClaiming = false;
		}
	}

	onMount(async () => {
		faucetAvailable = await isFaucetServiceAvailable();
		if (faucetAvailable) await refreshFaucetStatus();
	});

	// Re-fetch claim status whenever the connected EVM address changes.
	$effect(() => {
		// touch reactive deps so the effect re-runs on change
		void walletStore.wallets.evm;
		void walletStore.chainId;
		if (faucetAvailable) refreshFaucetStatus();
	});

	// Compute if user is on an unsupported network
	let isOnUnsupportedNetwork = $derived.by(() => {
		if (!walletStore.isEVMConnected || walletStore.chainName === null) return false;
		// If chainName is null but we're connected, we're on an unsupported network
		return walletStore.wallets.evm !== null && walletStore.chainName === null;
	});

	// Get list of supported networks for quick switching
	let supportedNetworks = $derived.by(() => {
		const networks: Chain[] = [];
		if (NETWORKS['Ethereum']) networks.push('Ethereum');
		if (NETWORKS['Scroll']) networks.push('Scroll');
		return networks;
	});

	async function handleTriggerBridgeSync() {
		isSyncing = true;
		syncError = null;
		syncSuccess = null;

		try {
			const chainId = await getChainId();
			if (!chainId) throw new Error("Could not determine chain ID");

			const result = await triggerBridgeSync(chainId);
			syncSuccess = `Bridge synced! GigaRoot updated: ${result.updateGigaRootTxHash.slice(0, 10)}...`;
		} catch (error) {
			console.error("Bridge sync error:", error);
			syncError =
				error instanceof Error
					? error.message
					: "Failed to sync bridge";
		} finally {
			isSyncing = false;
		}
	}

	async function handleConnectEVM() {
		try {
			await walletStore.connectEVM();
		} catch (error) {
			// Error is already stored in walletStore.error
			console.error("Connection error:", error);
		}
	}

	function handleDisconnectEVM() {
		walletStore.disconnectEVM();
	}

	async function handleConnectAztec() {
		try {
			await walletStore.connectAztec();
		} catch (error) {
			// Error is already stored in walletStore.aztecError
			console.error("Aztec connection error:", error);
		}
	}

	async function handleSelectAccountMode(mode: AztecAccountMode) {
		await walletStore.setAztecAccountMode(mode);
	}

	async function handleResetCustomAccount() {
		await walletStore.resetCustomAztecAccount();
	}

	async function handleDisconnectAztec() {
		await walletStore.disconnectAztec();
	}

	async function handleCheckAztecBalance() {
		const wallet = getWalletInstance();
		if (!wallet) {
			console.error("Aztec wallet not connected");
			return;
		}

		try {
			const balance = await getAztecWarpToadBalance(wallet);
			console.log("Aztec WarpToad Balance:", balance.toString());
		} catch (error) {
			console.error("Failed to get Aztec balance:", error);
		}
	}

	async function handleSwitchNetwork(chain: Chain) {
		try {
			await walletStore.switchToChain(chain);
		} catch (error) {
			console.error("Failed to switch network:", error);
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[580px] bg-[var(--swamp-card)] border border-[rgba(255,255,255,0.08)] shadow-2xl">
		<DialogHeader>
			<DialogTitle class="text-lg font-semibold text-[var(--foreground)]">
				Wallets
			</DialogTitle>
		</DialogHeader>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
			<!-- EVM Wallet Section -->
			<div class="rounded-lg border border-[rgba(130,226,102,0.15)] bg-[var(--swamp-deep)] p-4 space-y-3">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-md bg-[rgba(130,226,102,0.1)]">
						<Wallet class="size-4 text-[var(--toad-green)]" />
					</div>
					<div>
						<h3 class="text-sm font-medium text-[var(--foreground)]">EVM</h3>
						<p class="text-[0.65rem] text-[var(--muted-foreground)]">Ethereum & L2</p>
					</div>
				</div>

					{#if walletStore.isEVMConnected}
				<div class="space-y-2">
					<div class="font-mono text-xs text-[var(--toad-green)]">
						{walletStore.formatAddress(walletStore.wallets.evm)}
					</div>

					{#if walletStore.chainName}
						<div class="text-[0.65rem] text-[var(--muted-foreground)]">
							on <span class="text-[var(--foreground)]">{walletStore.chainName}</span>
						</div>
					{/if}

					{#if walletStore.chainName && walletStore.chainName !== 'Aztec' && walletStore.chainName !== 'Scroll'}
						<button
							onclick={async () => {
								const currentChain = walletStore.chainName;
								if (currentChain) {
									await mintFreeTokens("USDC", currentChain, 100);
									await balanceStore.refresh();
								}
							}}
							class="cursor-pointer w-full py-1.5 px-3 rounded text-xs font-medium text-[var(--toad-green)] hover:bg-[rgba(130,226,102,0.1)] transition-colors flex items-center justify-center gap-1.5"
						>
							<Zap class="size-3" />
							Mint Test USDC
						</button>
					{/if}

					<!-- Faucet: claim 0.05 testnet ETH on the current chain -->
					{#if faucetAvailable && isFaucetSupportedChain}
						{#if currentChainClaimStatus?.claimed}
							<div class="w-full py-1.5 px-3 rounded text-xs text-center text-[var(--muted-foreground)] border border-dashed border-[rgba(130,226,102,0.15)]">
								Faucet already claimed
								{#if currentChainClaimStatus.txHash}
									<span class="font-mono opacity-70">({currentChainClaimStatus.txHash.slice(0, 8)}...)</span>
								{/if}
							</div>
						{:else}
							<button
								onclick={handleClaimFaucet}
								disabled={faucetClaiming || faucetLoading}
								class="cursor-pointer w-full py-1.5 px-3 rounded text-xs font-medium text-[var(--toad-green)] hover:bg-[rgba(130,226,102,0.1)] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
							>
								{#if faucetClaiming}
									<Loader2 class="size-3 animate-spin" />
									Sending...
								{:else}
									<Droplet class="size-3" />
									Claim 0.05 testnet ETH
								{/if}
							</button>
							{#if faucetError}
								<div class="text-[0.65rem] text-red-400 text-center">{faucetError}</div>
							{/if}
							{#if faucetSuccess}
								<div class="text-[0.65rem] text-[var(--toad-green)] text-center">{faucetSuccess}</div>
							{/if}
						{/if}
					{/if}

					<button
						onclick={handleDisconnectEVM}
						disabled={walletStore.isConnecting}
						class="cursor-pointer w-full py-1.5 px-3 rounded text-xs text-[var(--muted-foreground)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.05)] transition-colors disabled:opacity-50"
					>
						Disconnect
					</button>
				</div>
			{:else if !walletStore.isWalletInstalled}
				<div class="text-xs text-center text-[var(--muted-foreground)] py-2">
					<p>No wallet detected.</p>
					<a
						href="https://metamask.io/download/"
						target="_blank"
						rel="noopener noreferrer"
						class="text-[var(--toad-green)] hover:underline"
					>
						Install MetaMask
					</a>
				</div>
			{:else}
				<button
					onclick={handleConnectEVM}
					disabled={walletStore.isConnecting}
					class="cursor-pointer w-full py-2 rounded text-xs font-medium border border-[rgba(130,226,102,0.3)] text-[var(--toad-green)] hover:bg-[rgba(130,226,102,0.1)] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
				>
					{#if walletStore.isConnecting}
						<Loader2 class="size-3 animate-spin" />
						Connecting...
					{:else}
						Connect
					{/if}
				</button>
			{/if}
			</div>

			<!-- Aztec Wallet Section -->
			<div class="rounded-lg border border-[rgba(144,97,249,0.15)] bg-[var(--swamp-deep)] p-4 space-y-3">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-md bg-[rgba(144,97,249,0.1)]">
						<Shield class="size-4 text-[var(--warp-purple)]" />
					</div>
					<div>
						<h3 class="text-sm font-medium text-[var(--foreground)]">Aztec</h3>
						<p class="text-[0.65rem] text-[var(--muted-foreground)]">Private</p>
					</div>
				</div>

				{#if walletStore.isAztecConnected}
					<div class="space-y-2">
						<div class="font-mono text-xs text-[var(--warp-purple)]">
							{walletStore.formatAddress(walletStore.wallets.aztec)}
						</div>

						<div class="text-[0.6rem] text-[var(--muted-foreground)]">
							{walletStore.aztecAccountMode === 'sandbox-test' ? 'Sandbox test account' : 'Custom account'}
						</div>

						<button
							onclick={handleDisconnectAztec}
							disabled={walletStore.isConnectingAztec}
							class="cursor-pointer w-full py-1.5 px-3 rounded text-xs text-[var(--muted-foreground)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.05)] transition-colors disabled:opacity-50"
						>
							Disconnect
						</button>
					</div>
				{:else}
					<div class="space-y-2">
						<!-- Account mode toggle: only meaningful in dev mode (sandbox-test only works against sandbox) -->
						{#if isTestMode}
							<div class="flex gap-1 text-[0.6rem]">
								<button
									onclick={() => handleSelectAccountMode('sandbox-test')}
									class="cursor-pointer flex-1 py-1 px-2 rounded transition-colors {walletStore.aztecAccountMode === 'sandbox-test' ? 'bg-[rgba(144,97,249,0.2)] text-[var(--warp-purple)]' : 'text-[var(--muted-foreground)] hover:bg-[rgba(255,255,255,0.03)]'}"
								>
									Sandbox test
								</button>
								<button
									onclick={() => handleSelectAccountMode('custom')}
									class="cursor-pointer flex-1 py-1 px-2 rounded transition-colors {walletStore.aztecAccountMode === 'custom' ? 'bg-[rgba(144,97,249,0.2)] text-[var(--warp-purple)]' : 'text-[var(--muted-foreground)] hover:bg-[rgba(255,255,255,0.03)]'}"
								>
									My key
								</button>
							</div>
						{/if}
						<button
							onclick={handleConnectAztec}
							disabled={walletStore.isConnectingAztec}
							class="cursor-pointer w-full py-2 rounded text-xs font-medium border border-[rgba(144,97,249,0.3)] text-[var(--warp-purple)] hover:bg-[rgba(144,97,249,0.1)] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
						>
							{#if walletStore.isConnectingAztec}
								<Loader2 class="size-3 animate-spin" />
								Connecting...
							{:else}
								Connect
							{/if}
						</button>
						{#if walletStore.aztecAccountMode === 'custom'}
							<button
								onclick={handleResetCustomAccount}
								disabled={walletStore.isConnectingAztec}
								class="cursor-pointer w-full py-1 px-2 rounded text-[0.6rem] text-[var(--muted-foreground)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.05)] transition-colors disabled:opacity-50"
							>
								Reset custom key
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Error Messages -->
		{#if walletStore.error}
			<div class="flex items-center gap-2 p-2 rounded text-xs text-red-400 bg-[rgba(239,68,68,0.05)]">
				<AlertCircle class="size-3 flex-shrink-0" />
				<p>{walletStore.error}</p>
			</div>
		{/if}

		{#if walletStore.aztecError}
			<div class="flex items-center gap-2 p-2 rounded text-xs text-red-400 bg-[rgba(239,68,68,0.05)]">
				<AlertCircle class="size-3 flex-shrink-0" />
				<p>{walletStore.aztecError}</p>
			</div>
		{/if}

		{#if syncError}
			<div class="flex items-center gap-2 p-2 rounded text-xs text-red-400 bg-[rgba(239,68,68,0.05)]">
				<AlertCircle class="size-3 flex-shrink-0" />
				<p>{syncError}</p>
			</div>
		{/if}

		{#if syncSuccess}
			<div class="flex items-center gap-2 p-2 rounded text-xs text-[var(--toad-green)] bg-[rgba(130,226,102,0.05)]">
				<CheckCircle2 class="size-3 flex-shrink-0" />
				<p>{syncSuccess}</p>
			</div>
		{/if}

		<!-- Network Management Section -->
		{#if walletStore.isEVMConnected}
			<div class="pt-2 border-t border-[rgba(255,255,255,0.05)]">
				<p class="text-[0.65rem] text-[var(--muted-foreground)] mb-2">Switch Network</p>

				{#if isOnUnsupportedNetwork}
					<p class="text-xs text-red-400 mb-2">Unsupported network. Switch to continue.</p>
				{/if}

				<div class="flex gap-2">
					{#each supportedNetworks as network}
						<button
							onclick={() => handleSwitchNetwork(network)}
							disabled={walletStore.isConnecting || walletStore.chainName === network}
							class="cursor-pointer flex-1 py-1.5 px-3 rounded text-xs transition-all disabled:opacity-50 {walletStore.chainName === network
								? 'bg-[rgba(130,226,102,0.15)] text-[var(--toad-green)]'
								: 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.03)]'}"
						>
							{network}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Footer -->
		{#if walletStore.isBothConnected}
			<div class="pt-2 border-t border-[rgba(255,255,255,0.05)]">
				<p class="text-[0.65rem] text-[var(--toad-green)] text-center">
					✓ Ready to bridge
				</p>
			</div>
		{/if}
	</DialogContent>
</Dialog>
