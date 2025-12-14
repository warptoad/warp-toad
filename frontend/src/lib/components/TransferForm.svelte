<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import {
		Loader2,
		CheckCircle2,
		ChevronDown,
		ArrowRight,
	} from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import TokenSelector from "./TokenSelector.svelte";
	import ChainSelector from "./ChainSelector.svelte";
	import {
		TOKEN_COLORS,
		CHAIN_COLORS,
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
</script>

<Card>
	<CardHeader>
		<CardTitle>Private Transfer</CardTitle>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Info Alert -->
		<Alert>
			<AlertDescription class="text-sm">
				Transfer tokens privately on the same chain. The recipient can withdraw using the generated note.
			</AlertDescription>
		</Alert>

		<!-- Chain & Token Selection -->
		<Card class="border-2 hover:border-primary/50 transition-colors">
			<CardContent class="p-4 space-y-3">
				<div class="text-sm text-muted-foreground">You Send</div>

				<!-- Token & Chain Selection -->
				<div class="flex gap-2">
					<!-- Token Selector Button -->
					<button
						onclick={() => (tokenSelectorOpen = true)}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div
							class="size-8 rounded-full {TOKEN_COLORS[selectedToken]} flex items-center justify-center"
						>
							<span class="text-white font-bold text-xs"
								>{selectedToken.slice(0, 3)}</span
							>
						</div>
						<span class="font-semibold">{selectedToken}</span>
						<ChevronDown class="size-4" />
					</button>

					<!-- Chain Selector Button -->
					<button
						onclick={() => (chainSelectorOpen = true)}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div
							class="size-8 rounded-full {CHAIN_COLORS[selectedChain]} flex items-center justify-center"
						>
							<span class="text-white font-bold text-xs"
								>{selectedChain.slice(0, 1)}</span
							>
						</div>
						<span class="font-medium">{selectedChain}</span>
						<ChevronDown class="size-4" />
					</button>
				</div>

				<!-- Amount Input -->
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<Input
							type="number"
							step="0.000001"
							bind:value={amount}
							placeholder="0.0"
							class="text-2xl font-semibold h-12"
						/>
						<Button variant="outline" onclick={setMaxAmount}>
							Max
						</Button>
					</div>
					<div class="text-sm text-muted-foreground flex items-center gap-1">
						{#if isBalanceLoading}
							<Loader2 class="size-3 animate-spin" />
							<span>Fetching balance...</span>
						{:else}
							<span>Balance: {balance} {selectedToken}</span>
						{/if}
					</div>
				</div>
			</CardContent>
		</Card>


		<!-- Validation Messages -->
		{#if !isConnected}
			<Alert>
				<AlertDescription>
					Please connect your {selectedChain} wallet first.
				</AlertDescription>
			</Alert>
		{:else if needsNetworkSwitch}
			<div class="text-sm text-muted-foreground text-center py-2">
				⚠️ Wrong network - open wallet settings to switch to {selectedChain}
			</div>
		{:else if !isChainAvailable(selectedChain)}
			<Alert variant="destructive">
				<AlertDescription>
					{selectedChain} is not available in the current environment.
					{#if selectedChain === "Scroll"}
						Switch to testnet mode to use Scroll.
					{/if}
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Error Message -->
		{#if lastError}
			<Alert variant="destructive">
				<AlertDescription class="flex items-center justify-between">
					<span>{lastError}</span>
					<Button
						size="sm"
						variant="outline"
						onclick={() => {
							lastError = null;
							generationStep = "idle";
						}}
					>
						Dismiss
					</Button>
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Progress -->
		{#if isGenerating || generationStep === "complete"}
			<Alert>
				<AlertDescription class="flex items-center gap-2">
					{#if generationStep === "complete"}
						<CheckCircle2 class="size-4" />
					{:else}
						<Loader2 class="size-4 animate-spin" />
					{/if}
					<div class="flex-1">
						<div>{generationMessage}</div>
						{#if generationStep !== "idle" && generationStep !== "complete"}
							<div class="text-xs text-muted-foreground mt-1">
								Step: {generationStep}
							</div>
						{/if}
					</div>
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Important Note about Withdrawal -->
		{#if !isGenerating && generationStep === "idle"}
			<Alert>
				<AlertDescription class="text-sm">
					<strong>Important:</strong> After the transfer, a bridge sync is required before withdrawal.
					The recipient can withdraw once the local root is updated on the GigaBridge.
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Submit Button -->
		<Button
			class="w-full h-12 text-base"
			disabled={!canSubmit}
			onclick={generateTransfer}
		>
			{#if generationStep === "idle"}
				Transfer
			{:else if generationStep === "preparing"}
				Preparing...
			{:else if generationStep === "approving"}
				Approving...
			{:else if generationStep === "wrapping"}
				Wrapping...
			{:else if generationStep === "burning"}
				Transferring...
			{:else if generationStep === "complete"}
				Done!
			{:else if generationStep === "done"}
				Done!
			{:else}
				Transfer
			{/if}
		</Button>
	</CardContent>
</Card>

<!-- Selectors -->
<TokenSelector
	bind:open={tokenSelectorOpen}
	{selectedToken}
	chain={selectedChain}
	onSelect={handleTokenSelect}
/>

<!-- Custom chain selector that only shows EVM chains -->
<ChainSelector
	bind:open={chainSelectorOpen}
	selectedChain={selectedChain}
	excludeChain="Aztec"
	onSelect={handleChainSelect}
/>
