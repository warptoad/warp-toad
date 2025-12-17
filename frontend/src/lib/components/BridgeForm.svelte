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
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import {
		ArrowDownUp,
		Loader2,
		CheckCircle2,
		ChevronDown,
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
	import { 
		getAztecChainId, 
		burnOnAztec, 
		encodeAztecNote,
		getAztecWarpToadDecimals 
	} from "$lib/utils/aztec-interactions.js";
	import { 
		bridgeFromScroll, 
		getScrollTokenDecimals,
		getScrollChainId 
	} from "$lib/utils/scroll-interactions.js";
	import { getWalletInstance } from "$lib/utils/aztec-wallet.js";
	import { getEVMChain, isChainEnabled } from "$lib/config/chains.js";
	import { 
		triggerBridge, 
		getChainIdForBridgeKeeper, 
		getExpectedDuration,
		savePendingBridgeSync 
	} from "$lib/utils/bridge-keeper.js";

	let sourceChain = $state<Chain>("Ethereum");
	let targetChain = $state<Chain>("Aztec");
	let selectedToken = $state<Token>("USDC");
	let amount = $state<string>("");

	let isGenerating = $state(false);
	let generationStep = $state<
		"idle" | "preparing" | "approving" | "wrapping" | "burning" | "triggering-sync" | "complete" | "done"
	>("idle");
	let generationMessage = $state("");
	let lastError = $state<string | null>(null);
	let showDisclaimer = $state(false);
	
	// Track bridge state for resuming
	let bridgeState = $state<{
		approved?: boolean;
		wrapped?: boolean;
		burned?: boolean;
	}>({});

	/**
	 * Get the EVM chain ID for a chain name
	 */
	function getChainIdForChain(chain: Chain): number {
		const chainDef = getEVMChain(chain);
		if (!chainDef) throw new Error(`${chain} is not an EVM chain`);
		if (!chainDef.enabled) throw new Error(`${chain} is not available in current environment`);
		return chainDef.chainId;
	}

	/**
	 * Get the destination chain ID based on source and target chain
	 * 
	 * When bridging FROM Aztec: returns the EVM target chain ID
	 * When bridging TO Aztec: queries the contract for poseidon2([salt, version])
	 * For EVM-to-EVM: returns the target chain's standard ID
	 */
	async function getDestinationChainId(): Promise<bigint> {
		// Bridging FROM Aztec to EVM
		if (sourceChain === "Aztec") {
			if (targetChain === "Ethereum" || targetChain === "Scroll") {
				return BigInt(getChainIdForChain(targetChain));
			}
			throw new Error(`Unsupported target chain: ${targetChain}`);
		}
		
		// Bridging TO Aztec (from EVM)
		if (targetChain === "Aztec") {
			const aztecWallet = getWalletInstance();
			if (!aztecWallet) {
				throw new Error("Aztec wallet not connected. Please connect Azguard wallet first.");
			}
			// Get the correct Aztec chain ID from the contract
			// This is computed as poseidon2([salt, aztec_version])
			return await getAztecChainId(aztecWallet);
		} else if (targetChain === "Scroll" || targetChain === "Ethereum") {
			// EVM target chain
			return BigInt(getChainIdForChain(targetChain));
		}
		
		throw new Error(`Unsupported target chain: ${targetChain}`);
	}
	
	/**
	 * Get the source chain ID for encoding in the note
	 * Used to track where the burn originated from
	 */
	async function getSourceChainId(): Promise<bigint> {
		if (sourceChain === "Aztec") {
			const aztecWallet = getWalletInstance();
			if (!aztecWallet) {
				throw new Error("Aztec wallet not connected");
			}
			return await getAztecChainId(aztecWallet);
		} else if (sourceChain === "Scroll" || sourceChain === "Ethereum") {
			// EVM source chain
			return BigInt(getChainIdForChain(sourceChain));
		}
		
		throw new Error(`Unsupported source chain: ${sourceChain}`);
	}

	// Dialog states
	let sourceTokenOpen = $state(false);
	let sourceChainOpen = $state(false);
	let targetChainOpen = $state(false);

	// Refresh balances when chain or token changes
	$effect(() => {
		const chain = sourceChain;
		const token = selectedToken;
		
		// Update the store's token selection
		balanceStore.setToken(token);
		
		// Trigger refresh when chain/token changes
		balanceStore.refresh();
	});
	
	// Derived balance from store based on source chain
	let balance = $derived(balanceStore.getBalance(sourceChain));
	let isBalanceLoading = $derived(balanceStore.isChainLoading(sourceChain));
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

	function confirmBridge() {
		showDisclaimer = true;
	}

	async function generateProof() {
		if (!canSubmit) return;
		
		// Close disclaimer dialog
		showDisclaimer = false;

		isGenerating = true;
		lastError = null;

		try {
			// Step 1: Preparing - get chain IDs
			generationStep = "preparing";
			generationMessage = "Fetching chain IDs...";
			
			const destinationChainId = await getDestinationChainId();
			const sourceChainId = await getSourceChainId();
			console.log("Source chain ID:", sourceChainId.toString());
			console.log("Destination chain ID:", destinationChainId.toString());

			// Branch based on source chain type
			if (sourceChain === "Aztec") {
				// ==========================================
				// AZTEC -> EVM FLOW
				// ==========================================
				await bridgeFromAztecUI(sourceChainId, destinationChainId);
			} else if (sourceChain === "Scroll") {
				// ==========================================
				// SCROLL -> AZTEC/L1 FLOW
				// ==========================================
				await bridgeFromScrollUI(destinationChainId);
			} else {
				// ==========================================
				// ETHEREUM L1 -> AZTEC/SCROLL FLOW
				// ==========================================
				await bridgeFromEvm(destinationChainId);
			}

			// Step: Trigger root synchronization
			await triggerRootSync();

			// Step: Complete
			generationStep = "complete";
			const expectedDuration = getExpectedDuration(sourceChain, targetChain);
			generationMessage = `Bridge complete! Note generated successfully.

⏳ Root synchronization initiated.
${targetChain === 'Scroll' || sourceChain === 'Scroll'
	? ' Synchronization will take 2-3 hours for Scroll bridges.'
	: '⏱️ Synchronization will take 30-60 minutes for Aztec bridges.'}

You can close this page. Your note has been downloaded.`;
			
			// Refresh balances after successful bridge
			await balanceStore.refresh();

			await new Promise((resolve) => setTimeout(resolve, 3000));

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
		}
	}

	/**
	 * Trigger root synchronization via BridgeKeeper API
	 * This is called after note generation to automatically sync roots
	 */
	async function triggerRootSync() {
		generationStep = "triggering-sync";
		generationMessage = "Initiating root synchronization...";

		try {
			const fromChainId = getChainIdForBridgeKeeper(sourceChain);
			const toChainId = getChainIdForBridgeKeeper(targetChain);
			
			console.log(`[BridgeKeeper] Triggering sync: ${sourceChain} (${fromChainId}) -> ${targetChain} (${toChainId})`);
			
			const response = await triggerBridge(fromChainId, toChainId, 3);
			
			// Store operation ID for later checking
			savePendingBridgeSync({
				operationId: response.operationId,
				fromChain: sourceChain,
				toChain: targetChain,
				expectedDuration: response.expectedDuration,
				timestamp: Date.now()
			});
			
			console.log('✅ Root synchronization triggered!');
			console.log(`   Operation ID: ${response.operationId}`);
			console.log(`   Expected duration: ${response.expectedDuration}`);
		} catch (error) {
			// Don't fail the whole bridge if BridgeKeeper is unreachable
			// The note is already generated and valid
			console.warn(' Failed to trigger automatic root synchronization:', error);
			console.log('Note: You can manually trigger sync later via BridgeKeeper API');
		}
	}
	
	/**
	 * Bridge from Aztec to EVM (L1 or Scroll)
	 * Burns tokens on Aztec and creates a note for EVM withdrawal
	 */
	async function bridgeFromAztecUI(sourceChainId: bigint, destinationChainId: bigint) {
		const aztecWallet = getWalletInstance();
		if (!aztecWallet) {
			throw new Error("Aztec wallet not connected. Please connect Azguard wallet first.");
		}
		
		// Get decimals from Aztec contract
		generationMessage = "Getting token decimals...";
		const decimals = await getAztecWarpToadDecimals(aztecWallet);
		const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));
		
		// Burn on Aztec
		generationStep = "burning";
		generationMessage = "Burning tokens on Aztec...";
		
		const burnResult = await burnOnAztec(
			aztecWallet,
			amountBigInt,
			destinationChainId
		);
		
		// Create note with Aztec-specific data
		const note = encodeAztecNote(
			burnResult,
			sourceChainId,
			destinationChainId,
			amountBigInt
		);
		
		// Create commitment pre-image for storage
		const commitmentPreImg = {
			amount: amountBigInt,
			destination_chain_id: destinationChainId,
			secret: burnResult.secret,
			nullifier_preimg: burnResult.nullifierPreimage,
		};
		
		// Add proof and download
		const proof = proofStore.addProof(
			amount,
			selectedToken,
			sourceChain,
			targetChain,
			note,
			commitmentPreImg,
			burnResult.preCommitment.toString(),
			burnResult.commitment.toString(),
			burnResult.burnTxHash
		);
		proofStore.downloadProof(proof);
	}
	
	/**
	 * Bridge from Scroll L2 to Aztec/L1
	 * Burns tokens on Scroll and creates a note for withdrawal
	 */
	async function bridgeFromScrollUI(destinationChainId: bigint) {
		// On Scroll, users already have wrapped tokens (from L2WarpToad)
		// No need to approve/wrap - just burn directly
		
		generationStep = "burning";
		generationMessage = "Burning tokens on Scroll L2...";
		
		const bridgeResult = await bridgeFromScroll(amount, destinationChainId);
		
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
	}

	/**
	 * Bridge from EVM (Ethereum L1) to Aztec/Scroll
	 */
	async function bridgeFromEvm(destinationChainId: bigint) {
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

		<!-- Swap Button -->
		<div class="flex justify-center relative z-10">
			<Button
				size="icon"
				variant="outline"
				class="rounded-full size-10 border-2 bg-background hover:bg-accent w-full"
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
			<div class="text-sm text-muted-foreground text-center py-2">
				 Wrong network - open wallet settings to switch to {sourceChain}
			</div>
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
			onclick={confirmBridge}
		>
			{#if generationStep === "idle"}
				Bridge
			{:else if generationStep === "preparing"}
				Preparing...
			{:else if generationStep === "approving"}
				Approving...
			{:else if generationStep === "wrapping"}
				Wrapping...
			{:else if generationStep === "burning"}
				Bridging...
			{:else if generationStep === "triggering-sync"}
				Syncing...
			{:else if generationStep === "complete"}
				Done!
			{:else if generationStep === "done"}
				Done!
			{:else}
				Bridge
			{/if}
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

<!-- Bridge Duration Disclaimer Dialog -->
<Dialog bind:open={showDisclaimer}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle> Bridge Synchronization Time</DialogTitle>
			<DialogDescription class="space-y-3 pt-2">
				<p class="font-semibold">
					Bridge operations require time for root synchronization:
				</p>
				
				{#if targetChain === 'Scroll' || sourceChain === 'Scroll'}
					<div class="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
						<p class="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
							🕐 Scroll bridges take <strong>2-3 hours</strong>
						</p>
						<p class="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
							This is due to Scroll's L2 finalization process and API claim data availability.
						</p>
					</div>
				{:else if targetChain === 'Aztec' || sourceChain === 'Aztec'}
					<div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
						<p class="text-sm font-semibold text-blue-900 dark:text-blue-100">
							🕐 Aztec bridges take <strong>30-60 minutes</strong>
						</p>
						<p class="text-xs text-blue-800 dark:text-blue-200 mt-1">
							This is due to L1 message confirmation requirements.
						</p>
					</div>
				{/if}
				
				<div class="bg-muted rounded-lg p-3 space-y-2">
					<p class="text-sm">
						<strong>What happens next:</strong>
					</p>
					<ol class="text-xs space-y-1 list-decimal list-inside">
						<li>Your tokens will be burned on {sourceChain}</li>
						<li>A withdrawal note will be generated and downloaded</li>
						<li>Root synchronization will be triggered automatically</li>
						<li>You can close this page and come back later</li>
						<li>Use your note to withdraw on {targetChain} once sync completes</li>
					</ol>
				</div>
				
				<p class="text-xs text-muted-foreground">
					 Your note will be downloaded immediately. You can safely close this page 
					after the bridge completes. The synchronization happens in the background.
				</p>
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="flex gap-2 sm:gap-0">
			<Button variant="outline" onclick={() => showDisclaimer = false}>
				Cancel
			</Button>
			<Button onclick={generateProof}>
				I Understand, Continue
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
