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
	import { rpcSettings, RPC_OVERRIDE_CHAINS } from "$lib/stores/rpc-settings.svelte";

	// Custom RPC section: per-chain input + probe/save/reset, driven by
	// `rpcSettings`. Probing does an eth_blockNumber against the URL before
	// we accept it so users don't persist a broken endpoint.
	let rpcDrafts = $state<Record<number, string>>(
		Object.fromEntries(RPC_OVERRIDE_CHAINS.map((c) => [c.chainId, rpcSettings.getCustom(c.chainId) ?? ""])),
	);
	let rpcProbeState = $state<Record<number, { status: "idle" | "probing" | "ok" | "err"; message?: string }>>(
		Object.fromEntries(RPC_OVERRIDE_CHAINS.map((c) => [c.chainId, { status: "idle" }])),
	);

	async function handleRpcSave(chainId: number) {
		const url = (rpcDrafts[chainId] ?? "").trim();
		if (!url) {
			rpcSettings.clearCustom(chainId);
			rpcProbeState[chainId] = { status: "idle" };
			return;
		}
		rpcProbeState[chainId] = { status: "probing" };
		try {
			const block = await rpcSettings.probe(url);
			rpcSettings.setCustom(chainId, url);
			rpcProbeState[chainId] = { status: "ok", message: `OK - block ${block}` };
		} catch (e: any) {
			rpcProbeState[chainId] = { status: "err", message: e?.message ?? "Probe failed" };
		}
	}

	function handleRpcReset(chainId: number) {
		rpcDrafts[chainId] = "";
		rpcSettings.clearCustom(chainId);
		rpcProbeState[chainId] = { status: "idle" };
	}

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
	<DialogContent class="sm:max-w-2xl bg-[var(--swamp-card)] border border-[rgba(255,255,255,0.08)] shadow-2xl">
		<DialogHeader>
			<DialogTitle class="text-lg font-semibold text-[var(--foreground)]">
				Wallets
			</DialogTitle>
		</DialogHeader>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
			<!-- EVM Wallet Section -->
			<div class="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 space-y-3">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-md bg-[color:var(--color-accent)]/10">
						<Wallet class="size-4" style="color: var(--color-accent)" />
					</div>
					{#if walletStore.isEVMConnected}
						<div class="flex-1 h-8 flex items-center gap-2 px-3 rounded-full text-xs font-mono bg-background/90 backdrop-blur-md border border-border">
							<div class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--color-accent)"></div>
							<span class="shrink-0">EVM</span>
							<span class="opacity-70 flex-1 text-center">{walletStore.formatAddress(walletStore.wallets.evm)}</span>
						</div>
					{:else}
						<div>
							<h3 class="text-sm font-medium text-foreground">EVM</h3>
							<p class="text-[0.65rem] text-muted-foreground">Ethereum & L2</p>
						</div>
					{/if}
				</div>

					{#if walletStore.isEVMConnected}
				{@const showMint = walletStore.chainName && walletStore.chainName !== 'Aztec' && walletStore.chainName !== 'Scroll'}
				{@const showFaucet = faucetAvailable && isFaucetSupportedChain}
				<div class="space-y-2">
					{#if showMint || showFaucet}
						<div class="flex gap-2">
							{#if showMint}
								<button
									onclick={async () => {
										const currentChain = walletStore.chainName;
										if (currentChain) {
											await mintFreeTokens("USDC", currentChain, 100);
											await balanceStore.refresh();
										}
									}}
									class="cursor-pointer flex-1 h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
								>
									Mint Test USDC
								</button>
							{/if}
							{#if showFaucet}
								{#if currentChainClaimStatus?.claimed}
									<div class="flex-1 min-w-0 h-9 px-3 rounded-full text-xs flex items-center justify-center text-muted-foreground border border-dashed border-border truncate">
										Claimed{#if currentChainClaimStatus.txHash}<span class="font-mono opacity-70 ml-1">({currentChainClaimStatus.txHash.slice(0, 8)}...)</span>{/if}
									</div>
								{:else}
									<button
										onclick={handleClaimFaucet}
										disabled={faucetClaiming || faucetLoading}
										class="cursor-pointer flex-1 h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
									>
										{#if faucetClaiming}
											<Loader2 class="size-3 animate-spin" />
											Sending...
										{:else}
											Claim 0.05 ETH
										{/if}
									</button>
								{/if}
							{/if}
						</div>
						{#if showFaucet && !currentChainClaimStatus?.claimed}
							{#if faucetError}
								<div class="text-[0.65rem] text-red-400 text-center">{faucetError}</div>
							{/if}
							{#if faucetSuccess}
								<div class="text-[0.65rem] text-center" style="color: var(--color-accent)">{faucetSuccess}</div>
							{/if}
						{/if}
					{/if}

					<button
						onclick={handleDisconnectEVM}
						disabled={walletStore.isConnecting}
						class="cursor-pointer w-full h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border text-muted-foreground hover:border-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center"
					>
						Disconnect
					</button>
				</div>
			{:else if !walletStore.isWalletInstalled}
				<div class="text-xs text-center text-muted-foreground py-2">
					<p>No wallet detected.</p>
					<a
						href="https://metamask.io/download/"
						target="_blank"
						rel="noopener noreferrer"
						class="hover:underline"
						style="color: var(--color-accent)"
					>
						Install MetaMask
					</a>
				</div>
			{:else}
				<button
					onclick={handleConnectEVM}
					disabled={walletStore.isConnecting}
					class="cursor-pointer w-full h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
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
			<div class="rounded-xl border border-border bg-card/60 backdrop-blur-md p-4 space-y-3">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-md bg-[color:var(--color-accent)]/10">
						<Shield class="size-4" style="color: var(--color-accent)" />
					</div>
					{#if walletStore.isAztecConnected}
						<div class="flex-1 h-8 flex items-center gap-2 px-3 rounded-full text-xs font-mono bg-background/90 backdrop-blur-md border border-border">
							<div class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--color-accent)"></div>
							<span class="shrink-0">Aztec</span>
							<span class="opacity-70 flex-1 text-center">{walletStore.formatAddress(walletStore.wallets.aztec)}</span>
						</div>
					{:else}
						<div>
							<h3 class="text-sm font-medium text-foreground">Aztec</h3>
							<p class="text-[0.65rem] text-muted-foreground">Private</p>
						</div>
					{/if}
				</div>

				{#if walletStore.isAztecConnected}
					<div class="space-y-2">
						<button
							onclick={handleDisconnectAztec}
							disabled={walletStore.isConnectingAztec}
							class="cursor-pointer w-full h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border text-muted-foreground hover:border-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center"
						>
							Disconnect
						</button>
					</div>
				{:else}
					<div class="space-y-2">
						<!-- Account mode toggle: only meaningful in dev mode (sandbox-test only works against sandbox) -->
						{#if isTestMode}
							<div class="flex gap-2 text-xs">
								<button
									onclick={() => handleSelectAccountMode('sandbox-test')}
									class="cursor-pointer flex-1 h-9 rounded-full font-medium bg-background/90 backdrop-blur-md border transition-colors flex items-center justify-center {walletStore.aztecAccountMode === 'sandbox-test' ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-border text-muted-foreground hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]'}"
								>
									Sandbox test
								</button>
								<button
									onclick={() => handleSelectAccountMode('custom')}
									class="cursor-pointer flex-1 h-9 rounded-full font-medium bg-background/90 backdrop-blur-md border transition-colors flex items-center justify-center {walletStore.aztecAccountMode === 'custom' ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-border text-muted-foreground hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]'}"
								>
									My key
								</button>
							</div>
						{/if}
						{#if walletStore.aztecUpgradeNotice}
							<div class="rounded-lg border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 px-3 py-2 text-[0.65rem] leading-snug text-muted-foreground">
								Your previous Aztec wallet was reset for the v5 upgrade. Reconnect to
								create a fresh one; the old testnet wallet isn't recoverable from this
								build.
								<button
									onclick={() => walletStore.dismissAztecUpgradeNotice()}
									class="cursor-pointer mt-1 block text-[0.65rem] font-medium text-[color:var(--color-accent)] hover:underline"
								>
									Dismiss
								</button>
							</div>
						{/if}
						<button
							onclick={handleConnectAztec}
							disabled={walletStore.isConnectingAztec}
							class="cursor-pointer w-full h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
						>
							{#if walletStore.isConnectingAztec}
								<Loader2 class="size-3 animate-spin" />
								{walletStore.aztecConnectMessage ?? 'Connecting…'}
							{:else}
								Connect
							{/if}
						</button>
						{#if walletStore.isConnectingAztec && walletStore.aztecConnectStage === 'account-deploy'}
							<p class="text-[0.65rem] text-muted-foreground text-center leading-snug mt-1">
								Generating client-side ZK proof to deploy your account. This only
								happens once per key and can take up to a minute.
							</p>
						{/if}
						{#if walletStore.aztecAccountMode === 'custom'}
							<button
								onclick={handleResetCustomAccount}
								disabled={walletStore.isConnectingAztec}
								class="cursor-pointer w-full h-9 rounded-full text-[0.65rem] font-medium bg-background/90 backdrop-blur-md border border-border text-muted-foreground hover:border-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center"
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

				<div class="flex flex-wrap gap-2">
					{#each supportedNetworks as network}
						<button
							onclick={() => handleSwitchNetwork(network)}
							disabled={walletStore.isConnecting || walletStore.chainName === network}
							class="cursor-pointer flex-1 h-9 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border transition-colors disabled:opacity-50 disabled:cursor-default flex items-center justify-center {walletStore.chainName === network
								? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]'
								: 'border-border text-muted-foreground hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]'}"
						>
							{network}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Custom RPC Endpoints -->
		<div class="pt-2 border-t border-[rgba(255,255,255,0.05)]">
			<p class="text-[0.65rem] text-[var(--muted-foreground)] mb-1">Custom RPC endpoints (optional)</p>
			<p class="text-[0.6rem] text-[var(--toad-green)] mb-2">
				Your URL stays in this browser session. warptoad can't see it.
			</p>
			{#each RPC_OVERRIDE_CHAINS as chain}
				{@const probe = rpcProbeState[chain.chainId]}
				<div class="mb-3">
					<div class="flex items-center justify-between mb-1">
						<label for="rpc-{chain.chainId}" class="text-[0.65rem] text-[var(--muted-foreground)]">{chain.label}</label>
						{#if rpcSettings.hasCustom(chain.chainId)}
							<span class="text-[0.6rem] text-[var(--toad-green)]">saved</span>
						{/if}
					</div>
					<div class="flex gap-2">
						<input
							id="rpc-{chain.chainId}"
							type="url"
							placeholder="https://..."
							bind:value={rpcDrafts[chain.chainId]}
							class="flex-1 h-9 rounded-full px-3 text-xs bg-background/90 backdrop-blur-md border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[color:var(--color-accent)]"
						/>
						<button
							type="button"
							onclick={() => handleRpcSave(chain.chainId)}
							disabled={probe.status === "probing"}
							class="cursor-pointer h-9 px-4 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors disabled:opacity-50 flex items-center justify-center"
						>
							{probe.status === "probing" ? "..." : "Save"}
						</button>
						{#if rpcSettings.hasCustom(chain.chainId) || rpcDrafts[chain.chainId]}
							<button
								type="button"
								onclick={() => handleRpcReset(chain.chainId)}
								class="cursor-pointer h-9 px-4 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border text-muted-foreground hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
							>
								Reset
							</button>
						{/if}
					</div>
					{#if probe.status === "ok"}
						<p class="mt-1 text-[0.6rem] text-[var(--toad-green)]">{probe.message}</p>
					{:else if probe.status === "err"}
						<p class="mt-1 text-[0.6rem] text-red-400">Probe failed: {probe.message}</p>
					{/if}
				</div>
			{/each}
			<p class="text-[0.6rem] text-[var(--muted-foreground)] leading-snug">
				Custom endpoints only affect reads. Transactions still go through your wallet.
			</p>
		</div>

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
