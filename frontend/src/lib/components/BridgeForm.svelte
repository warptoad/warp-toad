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
		ArrowDownUp,
		Loader2,
		CheckCircle2,
		ChevronDown,
	} from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import TokenSelector from "./TokenSelector.svelte";
	import ChainSelector from "./ChainSelector.svelte";
	import {
		TOKEN_COLORS,
		CHAIN_COLORS,
		type Chain,
		type Token,
	} from "$lib/types/bridge.js";
	import { bridgeToChain } from "$lib/utils/evm-interactions.js";

	let sourceChain = $state<Chain>("Ethereum");
	let targetChain = $state<Chain>("Aztec");
	let selectedToken = $state<Token>("USDC");
	let amount = $state<string>("");

	let isGenerating = $state(false);
	let generationStep = $state<
		"idle" | "preparing" | "approving" | "wrapping" | "burning" | "complete"
	>("idle");
	let generationMessage = $state("");
	let lastError = $state<string | null>(null);
	
	// Track bridge state for resuming
	let bridgeState = $state<{
		approved?: boolean;
		wrapped?: boolean;
		burned?: boolean;
	}>({});

	// Dialog states
	let sourceTokenOpen = $state(false);
	let sourceChainOpen = $state(false);
	let targetChainOpen = $state(false);

	$effect(() => {
		const token = selectedToken;
		const chain = sourceChain;

		isBalanceLoading = true;
		balanceError = null;

		(async () => {
			try {
				const value = await proofStore.getBalance(token, chain);

				// avoid race conditions when user switches token/chain quickly
				if (token === selectedToken && chain === sourceChain) {
					balance = value ?? "0.00";
				}
			} catch (err) {
				console.error("Failed to fetch balance", err);
				if (token === selectedToken && chain === sourceChain) {
					balanceError = err as Error;
					balance = "0.00";
				}
			} finally {
				if (token === selectedToken && chain === sourceChain) {
					isBalanceLoading = false;
				}
			}
		})();
	});

	let balance = $state("0.00");
	let isBalanceLoading = $state(false);
	let balanceError = $state<Error | null>(null);
	let estimatedReceive = $derived(amount || "0.0");

	let isSourceConnected = $derived(walletStore.isChainConnected(sourceChain));
	let isOnCorrectNetwork = $derived(
		walletStore.isOnCorrectNetwork(sourceChain),
	);
	let needsNetworkSwitch = $derived(
		isSourceConnected && !isOnCorrectNetwork && sourceChain !== "Aztec",
	);

	let canSubmit = $derived(
		isSourceConnected &&
			isOnCorrectNetwork &&
			amount !== "" &&
			parseFloat(amount) > 0 &&
			parseFloat(amount) <= parseFloat(balance) &&
			!isGenerating,
	);

	function switchChains() {
		const temp = sourceChain;
		sourceChain = targetChain;
		targetChain = temp;
	}

	function setMaxAmount() {
		amount = balance;
	}

	async function switchNetwork() {
		try {
			await walletStore.switchToChain(sourceChain);
		} catch (error) {
			console.error("Failed to switch network:", error);
		}
	}

	async function generateProof() {
		if (!canSubmit) return;

		isGenerating = true;
		lastError = null;

		try {
			// Step 1: Preparing
			generationStep = "preparing";
			generationMessage = "Preparing transaction...";
			await new Promise((resolve) => setTimeout(resolve, 300));
			
			// For now, hardcode Aztec chain ID for localhost (31337)
			// TODO: Query this from Aztec node
			const destinationChainId = 31337n;

			// Step 2: Approving tokens
			generationStep = "approving";
			generationMessage = "Approving tokens...";
			
			// Step 3: Wrapping tokens
			generationStep = "wrapping";
			generationMessage = "Wrapping tokens...";
			
			// Step 4: Burning and creating commitment
			generationStep = "burning";
			generationMessage = "Burning tokens and creating commitment...";
			
			const bridgeResult = await bridgeToChain(
				selectedToken,
				sourceChain,
				targetChain,
				amount,
				destinationChainId
			);

			// Step 5: Complete
			generationStep = "complete";
			generationMessage = "Bridge complete! Note generated successfully.";

			// Add proof and download
			const proof = proofStore.addProof(
				amount,
				selectedToken,
				sourceChain,
				targetChain,
				bridgeResult.note,
				bridgeResult.commitmentPreImg,
				bridgeResult.preCommitment,
				bridgeResult.commitment,
				bridgeResult.burnTxHash
			);
			proofStore.downloadProof(proof);

			await new Promise((resolve) => setTimeout(resolve, 1500));

			// Reset form
			amount = "";
			isGenerating = false;
			generationStep = "idle";
			generationMessage = "";
			bridgeState = {};
		} catch (error) {
			console.error("Bridging error:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			lastError = errorMessage;
			generationMessage = `Error: ${errorMessage}`;
			isGenerating = false;
			
			// Don't reset generationStep so user can see where it failed
			// User can try again if they want
		}
	}

	function handleSourceTokenSelect(token: Token) {
		selectedToken = token;
	}

	function handleSourceChainSelect(chain: Chain) {
		sourceChain = chain;
		// Auto-switch target if same
		if (sourceChain === targetChain) {
			targetChain = sourceChain === "Ethereum" ? "Aztec" : "Ethereum";
		}
	}

	function handleTargetChainSelect(chain: Chain) {
		targetChain = chain;
		// Auto-switch source if same
		if (targetChain === sourceChain) {
			sourceChain = targetChain === "Ethereum" ? "Aztec" : "Ethereum";
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Bridge Funds</CardTitle>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Source Card (You Send) -->
		<Card class="border-2 hover:border-primary/50 transition-colors">
			<CardContent class="p-4 space-y-3">
				<div class="text-sm text-muted-foreground">You Send</div>

				<!-- Token & Chain Selection -->
				<div class="flex gap-2">
					<!-- Token Selector Button -->
					<button
						onclick={() => (sourceTokenOpen = true)}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div
							class="size-8 rounded-full {TOKEN_COLORS[
								selectedToken
							]} flex items-center justify-center"
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
						onclick={() => (sourceChainOpen = true)}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div
							class="size-8 rounded-full {CHAIN_COLORS[
								sourceChain
							]} flex items-center justify-center"
						>
							<span class="text-white font-bold text-xs"
								>{sourceChain.slice(0, 1)}</span
							>
						</div>
						<span class="font-medium">{sourceChain}</span>
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
					<div class="text-sm text-muted-foreground">
						Balance: {balance}
						{selectedToken}
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Swap Button -->
		<div class="flex justify-center -my-2 relative z-10">
			<Button
				size="icon"
				variant="outline"
				class="rounded-full size-10 border-2 bg-background hover:bg-accent"
				onclick={switchChains}
			>
				<ArrowDownUp class="size-4" />
			</Button>
		</div>

		<!-- Destination Card (You Receive) -->
		<Card class="border-2 hover:border-primary/50 transition-colors">
			<CardContent class="p-4 space-y-3">
				<div class="text-sm text-muted-foreground">You Receive</div>

				<!-- Chain Selection (Token is same) -->
				<div class="flex gap-2">
					<!-- Token Display (Not clickable) -->
					<div
						class="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/50"
					>
						<div
							class="size-8 rounded-full {TOKEN_COLORS[
								selectedToken
							]} flex items-center justify-center"
						>
							<span class="text-white font-bold text-xs"
								>{selectedToken.slice(0, 2)}</span
							>
						</div>
						<span class="font-semibold">{selectedToken}</span>
					</div>

					<!-- Chain Selector Button -->
					<button
						onclick={() => (targetChainOpen = true)}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div
							class="size-8 rounded-full {CHAIN_COLORS[
								targetChain
							]} flex items-center justify-center"
						>
							<span class="text-white font-bold text-xs"
								>{targetChain.slice(0, 1)}</span
							>
						</div>
						<span class="font-medium">{targetChain}</span>
						<ChevronDown class="size-4" />
					</button>
				</div>

				<!-- Estimated Amount Display -->
				<div class="space-y-2">
					<div
						class="text-2xl font-semibold text-muted-foreground h-12 flex items-center"
					>
						~{estimatedReceive}
					</div>
					<div class="text-sm text-muted-foreground">
						Estimated amount
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Validation Messages -->
		{#if !isSourceConnected}
			<Alert>
				<AlertDescription>
					Please connect your {sourceChain} wallet first.
				</AlertDescription>
			</Alert>
		{:else if needsNetworkSwitch}
			<Alert>
				<AlertDescription class="flex items-center justify-between">
					<span>Please switch to {sourceChain} network</span>
					<Button
						size="sm"
						variant="outline"
						onclick={switchNetwork}
						disabled={walletStore.isConnecting}
					>
						{walletStore.isConnecting
							? "Switching..."
							: "Switch Network"}
					</Button>
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

		<!-- Proof Generation Progress -->
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

		<!-- Submit Button -->
		<Button
			class="w-full h-12 text-base"
			disabled={!canSubmit}
			onclick={generateProof}
		>
			{isGenerating ? "Generating Proof..." : "Generate Proof & Bridge"}
		</Button>
	</CardContent>
</Card>

<!-- Selectors -->
<TokenSelector
	bind:open={sourceTokenOpen}
	{selectedToken}
	chain={sourceChain}
	onSelect={handleSourceTokenSelect}
/>

<ChainSelector
	bind:open={sourceChainOpen}
	selectedChain={sourceChain}
	excludeChain={targetChain}
	onSelect={handleSourceChainSelect}
/>

<ChainSelector
	bind:open={targetChainOpen}
	selectedChain={targetChain}
	excludeChain={sourceChain}
	onSelect={handleTargetChainSelect}
/>
