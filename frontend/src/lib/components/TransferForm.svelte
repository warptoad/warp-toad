<script lang="ts">
	import {
		Loader2,
		CheckCircle2,
	} from "@lucide/svelte";
	import { badgeVariants } from "$lib/components/ui/badge/index.js";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import TokenSelector from "./TokenSelector.svelte";
	import ChainSelector from "./ChainSelector.svelte";
	import {
		TOKEN_STYLES,
		type Chain,
		type Token,
	} from "$lib/types/bridge.js";
	import { bridgeToChain } from "$lib/utils/evm-interactions.js";
	import { bridgeFromScroll } from "$lib/utils/scroll-interactions.js";
	import { getEVMChain } from "$lib/config/chains.js";

	// Only EVM chains for transfer (no Aztec)
	type EVMChain = "Ethereum" | "Scroll";

	let selectedChain = $state<EVMChain>("Ethereum");
	let selectedToken = $state<Token>("USDC");
	let amount = $state<string>("");

	let isGenerating = $state(false);
	let generationStep = $state<
		"idle" | "preparing" | "approving" | "wrapping" | "burning" | "complete" | "done"
	>("idle");
	let generationMessage = $state("");
	let lastError = $state<string | null>(null);

	// Dialog states
	let tokenSelectorOpen = $state(false);
	let chainSelectorOpen = $state(false);

	/**
	 * Get the chain ID for the selected chain
	 */
	function getChainIdForChain(chain: EVMChain): number {
		const chainDef = getEVMChain(chain);
		if (!chainDef) throw new Error(`${chain} is not an EVM chain`);
		if (!chainDef.enabled) throw new Error(`${chain} is not available in current environment`);
		return chainDef.chainId;
	}

	/**
	 * Check if chain is available in current environment
	 */
	function isChainAvailable(chain: EVMChain): boolean {
		const chainDef = getEVMChain(chain);
		return chainDef?.enabled ?? false;
	}

	// Refresh balances when chain or token changes
	$effect(() => {
		// Track dependencies
		selectedChain;
		selectedToken;

		balanceStore.setToken(selectedToken);
		balanceStore.refresh();
	});

	// Derived balance from store based on selected chain
	let balance = $derived(balanceStore.getBalance(selectedChain));
	let isBalanceLoading = $derived(balanceStore.isChainLoading(selectedChain));

	let isConnected = $derived(walletStore.isChainConnected(selectedChain));
	let isOnCorrectNetwork = $derived(walletStore.isOnCorrectNetwork(selectedChain));
	let needsNetworkSwitch = $derived(isConnected && !isOnCorrectNetwork);

	let canSubmit = $derived(
		isConnected &&
			isOnCorrectNetwork &&
			amount !== "" &&
			parseFloat(amount) > 0 &&
			parseFloat(amount) <= parseFloat(balance) &&
			!isGenerating &&
			isChainAvailable(selectedChain)
	);

	function setMaxAmount() {
		amount = balance;
	}

	async function switchNetwork() {
		try {
			await walletStore.switchToChain(selectedChain);
		} catch (error) {
			console.error("Failed to switch network:", error);
		}
	}

	async function generateTransfer() {
		if (!canSubmit) return;

		isGenerating = true;
		lastError = null;

		try {
			// Step 1: Preparing
			generationStep = "preparing";
			generationMessage = "Preparing transfer...";

			const chainId = getChainIdForChain(selectedChain);
			// For same-chain transfer, destination chain ID = source chain ID
			const destinationChainId = BigInt(chainId);

			console.log("Chain ID:", chainId);
			console.log("Destination chain ID (same-chain):", destinationChainId.toString());

			let bridgeResult: {
				note: string;
				commitmentPreImg: any;
				preCommitment: string;
				commitment: string;
				burnTxHash: string;
			};

			if (selectedChain === "Scroll") {
				// ==========================================
				// SCROLL SAME-CHAIN TRANSFER
				// ==========================================
				generationStep = "burning";
				generationMessage = "Burning tokens on Scroll...";

				bridgeResult = await bridgeFromScroll(amount, destinationChainId);
			} else {
				// ==========================================
				// ETHEREUM L1 SAME-CHAIN TRANSFER
				// ==========================================
				// Step 2: Approving tokens
				generationStep = "approving";
				generationMessage = "Approving tokens...";

				// Step 3: Wrapping tokens
				generationStep = "wrapping";
				generationMessage = "Wrapping tokens...";

				// Step 4: Burning and creating commitment
				generationStep = "burning";
				generationMessage = "Burning tokens and creating commitment...";

				bridgeResult = await bridgeToChain(
					selectedToken,
					selectedChain,
					selectedChain, // Same chain for source and target
					amount,
					destinationChainId
				);
			}

			// Step 5: Complete - note generated
			generationStep = "complete";
			generationMessage = "Transfer initiated! Note generated successfully.";

			// Add proof and download
			// sourceChain and targetChain are the same for transfers
			const proof = proofStore.addProof(
				amount,
				selectedToken,
				selectedChain,
				selectedChain, // Same chain
				bridgeResult.note,
				bridgeResult.commitmentPreImg,
				bridgeResult.preCommitment,
				bridgeResult.commitment,
				bridgeResult.burnTxHash
			);
			proofStore.downloadProof(proof);

			// Refresh balances after successful transfer
			await balanceStore.refresh();

			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Reset form
			amount = "";
			isGenerating = false;
			generationStep = "idle";
			generationMessage = "";
		} catch (error) {
			console.error("Transfer error:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			lastError = errorMessage;
			generationMessage = `Error: ${errorMessage}`;
			isGenerating = false;
		}
	}

	function handleTokenSelect(token: Token) {
		selectedToken = token;
	}

	function handleChainSelect(chain: Chain) {
		// Only allow EVM chains
		if (chain === "Ethereum" || chain === "Scroll") {
			selectedChain = chain;
		}
	}

	// Progress steps for UI
	const progressSteps = [
		{ key: "preparing", label: "Prepare" },
		{ key: "approving", label: "Approve" },
		{ key: "wrapping", label: "Wrap" },
		{ key: "burning", label: "Transfer" },
		{ key: "complete", label: "Done" },
	];

	function getStepIndex(step: typeof generationStep): number {
		return progressSteps.findIndex(s => s.key === step);
	}
</script>

<div class="space-y-3">
	<!-- Info Banner -->
	<div class="p-2.5 rounded-lg border border-border bg-background/40 backdrop-blur-sm">
		<p class="text-[0.65rem] text-muted-foreground">
			<span class="text-foreground font-medium">Private transfers</span> on the same chain. The recipient withdraws using the generated note.
		</p>
	</div>

	<!-- Source Section (You Send) -->
	<div class="swamp-card-source">
		<div class="swamp-card-inner">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1.5">
					<div class="w-0.5 h-3 bg-[var(--toad-green)] rounded-full"></div>
					<span class="text-[0.65rem] font-semibold text-[var(--toad-green-muted)] uppercase tracking-widest">You Send</span>
				</div>
				<div class="text-[0.65rem] text-[var(--muted-foreground)] flex items-center gap-1">
					{#if isBalanceLoading}
						<Loader2 class="size-2.5 animate-spin text-[var(--toad-green)]" />
						<span>Loading...</span>
					{:else}
						<span>Balance:</span>
						<span class="font-mono text-[var(--foreground)]">{balance}</span>
						<span>{selectedToken}</span>
					{/if}
				</div>
			</div>

			<!-- Token & Chain Selection -->
			<div class="flex gap-2 flex-wrap">
				<!-- Token Selector -->
				<TokenSelector
					bind:open={tokenSelectorOpen}
					{selectedToken}
					chain={selectedChain}
					variant="green"
					onSelect={handleTokenSelect}
				/>

				<!-- Chain Selector -->
				<ChainSelector
					bind:open={chainSelectorOpen}
					selectedChain={selectedChain}
					excludeChain="Aztec"
					variant="green"
					onSelect={handleChainSelect}
				/>
			</div>

			<!-- Amount Input -->
			<div class="relative">
				<input
					type="number"
					step="0.000001"
					bind:value={amount}
					placeholder="0.0"
					class="input-amount w-full bg-[var(--swamp-deep)] rounded-lg px-3 py-2 pr-16 border border-[rgba(130,226,102,0.15)] focus:border-[var(--toad-green)] focus:ring-2 focus:ring-[var(--toad-green)]/20 transition-all"
				/>
				<button
					onclick={setMaxAmount}
					class="{badgeVariants({ variant: 'default' })} absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer hover:bg-primary/90"
				>
					Max
				</button>
			</div>
		</div>
	</div>

	<!-- Route Indicator -->
	<div class="flex items-center justify-center py-1">
		<div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)]">
			<span class="text-[0.65rem] font-medium text-[var(--toad-green)]">Same Chain Transfer</span>
		</div>
	</div>

	<!-- Validation Messages -->
	{#if !isConnected}
		<div class="flex items-center gap-2 p-3 rounded-lg bg-[rgba(130,226,102,0.1)] border border-[rgba(130,226,102,0.2)]">
			<div class="size-8 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
				<svg class="size-4 text-[var(--toad-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="text-xs">
				<span class="font-medium text-[var(--foreground)]">Wallet Not Connected</span>
				<span class="text-[var(--muted-foreground)]"> -Connect your {selectedChain} wallet</span>
			</div>
		</div>
	{:else if needsNetworkSwitch}
		<div class="flex items-center gap-2 p-3 rounded-lg bg-[rgba(224,226,102,0.1)] border border-[rgba(224,226,102,0.2)]">
			<div class="size-8 rounded-full bg-[rgba(224,226,102,0.2)] flex items-center justify-center flex-shrink-0">
				<svg class="size-4 text-[var(--eye-yellow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
			</div>
			<div class="text-xs">
				<span class="font-medium text-[var(--foreground)]">Wrong Network</span>
				<span class="text-[var(--muted-foreground)]"> -Switch to {selectedChain}</span>
			</div>
		</div>
	{:else if !isChainAvailable(selectedChain)}
		<div class="flex items-center gap-2 p-3 rounded-lg bg-[rgba(255,77,77,0.1)] border border-[rgba(255,77,77,0.2)]">
			<div class="size-8 rounded-full bg-[rgba(255,77,77,0.2)] flex items-center justify-center flex-shrink-0">
				<svg class="size-4 text-[var(--destructive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
			<div class="text-xs">
				<span class="font-medium text-[var(--foreground)]">{selectedChain} Unavailable</span>
				{#if selectedChain === "Scroll"}
					<span class="text-[var(--muted-foreground)]"> -Switch to testnet mode</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if lastError}
		<div class="flex items-center justify-between gap-2 p-3 rounded-lg bg-[rgba(255,77,77,0.1)] border border-[rgba(255,77,77,0.2)]">
			<div class="flex items-center gap-2 min-w-0">
				<div class="size-6 rounded-full bg-[rgba(255,77,77,0.2)] flex items-center justify-center flex-shrink-0">
					<svg class="size-3 text-[var(--destructive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</div>
				<span class="text-xs text-[var(--foreground)] truncate">{lastError}</span>
			</div>
			<button
				onclick={() => { lastError = null; generationStep = "idle"; }}
				class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 cursor-pointer"
			>
				✕
			</button>
		</div>
	{/if}

	<!-- Progress -->
	{#if isGenerating || generationStep === "complete"}
		<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.2)]">
			<div class="flex items-center gap-2">
				{#if generationStep === "complete"}
					<div class="size-7 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
						<CheckCircle2 class="size-4 text-[var(--toad-green)]" />
					</div>
				{:else}
					<div class="size-7 rounded-full bg-[rgba(130,226,102,0.1)] flex items-center justify-center flex-shrink-0">
						<Loader2 class="size-4 text-[var(--toad-green)] animate-spin" />
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="text-xs text-[var(--foreground)]">{generationMessage}</div>
					{#if generationStep !== "idle" && generationStep !== "complete"}
						<div class="text-[0.65rem] text-[var(--muted-foreground)]">
							Step {getStepIndex(generationStep) + 1} of {progressSteps.length}
						</div>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			{#if isGenerating}
				<div class="mt-2 h-1 bg-[var(--swamp-surface)] rounded-full overflow-hidden">
					<div class="h-full bg-gradient-to-r from-[var(--toad-green)] to-[var(--warp-purple)] rounded-full shimmer" style="width: {((getStepIndex(generationStep) + 1) / progressSteps.length) * 100}%"></div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Submit Button -->
	<button
		class="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative overflow-hidden group cursor-pointer
			{canSubmit || needsNetworkSwitch
				? 'btn-warp'
				: 'bg-[var(--swamp-surface)] text-[var(--muted-foreground)] cursor-not-allowed border border-[rgba(130,226,102,0.1)]'
			}"
		disabled={(!canSubmit && !needsNetworkSwitch) || isGenerating}
		onclick={needsNetworkSwitch ? switchNetwork : generateTransfer}
	>
		<span class="relative z-10 flex items-center justify-center gap-1.5">
			{#if generationStep === "preparing"}
				<Loader2 class="size-4 animate-spin" />
				Preparing...
			{:else if generationStep === "approving"}
				<Loader2 class="size-4 animate-spin" />
				Approving...
			{:else if generationStep === "wrapping"}
				<Loader2 class="size-4 animate-spin" />
				Wrapping...
			{:else if generationStep === "burning"}
				<Loader2 class="size-4 animate-spin" />
				Transferring...
			{:else if generationStep === "complete" || generationStep === "done"}
				<CheckCircle2 class="size-4" />
				Complete!
			{:else if needsNetworkSwitch}
				Switch to {selectedChain}
			{:else}
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M17 3l4 4-4 4" /><path d="M3 11h18" /><path d="M7 21l-4-4 4-4" /><path d="M21 13H3" />
				</svg>
				Transfer Privately
			{/if}
		</span>
	</button>
</div>

