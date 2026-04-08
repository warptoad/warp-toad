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
	} from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import TokenSelector from "./TokenSelector.svelte";
	import ChainSelector from "./ChainSelector.svelte";
	import {
		TOKEN_STYLES,
		CHAIN_STYLES,
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
				throw new Error("Aztec wallet not connected. Please connect the Aztec wallet first.");
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
			throw new Error("Aztec wallet not connected. Please connect the Aztec wallet first.");
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

<div class="space-y-3">
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
					bind:open={sourceTokenOpen}
					{selectedToken}
					chain={sourceChain}
					variant="green"
					onSelect={handleSourceTokenSelect}
				/>

				<!-- Chain Selector -->
				<ChainSelector
					bind:open={sourceChainOpen}
					selectedChain={sourceChain}
					excludeChain={targetChain}
					variant="green"
					onSelect={handleSourceChainSelect}
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
					class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[0.65rem] font-semibold text-[var(--toad-green)] bg-[rgba(130,226,102,0.08)] hover:bg-[rgba(130,226,102,0.15)] rounded transition-colors uppercase tracking-wider border border-[rgba(130,226,102,0.2)]"
				>
					Max
				</button>
			</div>
		</div>
	</div>

	<!-- Swap Button -->
	<div class="flex justify-center -my-1.5 relative z-10">
		<button
			onclick={switchChains}
			class="group relative p-2 rounded-full bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)] hover:border-[rgba(130,226,102,0.4)] transition-all duration-200"
		>
			<ArrowDownUp class="size-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--toad-green)] group-hover:rotate-180 transition-all duration-300" />
		</button>
	</div>

	<!-- Destination Section (You Receive) -->
	<div class="swamp-card-target">
		<div class="swamp-card-inner">
			<div class="flex items-center gap-1.5">
				<div class="w-0.5 h-3 bg-[var(--warp-purple)] rounded-full"></div>
				<span class="text-[0.65rem] font-semibold text-[var(--warp-purple-muted)] uppercase tracking-widest">You Receive</span>
			</div>

			<!-- Token & Chain Selection -->
			<div class="flex gap-2 flex-wrap">
				<!-- Token Display (Static label - not clickable) -->
				<div class="flex items-center gap-1.5 px-2.5 py-1.5 opacity-60">
					<img
						src={TOKEN_STYLES[selectedToken].logo}
						alt={selectedToken}
						class="w-5 h-5 rounded-full"
					/>
					<span class="text-sm font-medium text-[var(--foreground)]">{selectedToken}</span>
				</div>

				<!-- Chain Selector -->
				<ChainSelector
					bind:open={targetChainOpen}
					selectedChain={targetChain}
					excludeChain={sourceChain}
					variant="purple"
					onSelect={handleTargetChainSelect}
				/>
			</div>

			<!-- Estimated Amount -->
			<div>
				<div class="font-mono text-lg font-semibold text-[var(--foreground)]">
					~{estimatedReceive}
				</div>
				<div class="text-[0.65rem] text-[var(--muted-foreground)]">
					Estimated amount (1:1 rate)
				</div>
			</div>
		</div>
	</div>

	<!-- Validation Messages -->
	{#if !isSourceConnected}
		<div class="flex items-center gap-2 p-3 rounded-lg bg-[rgba(130,226,102,0.1)] border border-[rgba(130,226,102,0.2)]">
			<div class="size-8 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
				<svg class="size-4 text-[var(--toad-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="text-xs">
				<span class="font-medium text-[var(--foreground)]">Wallet Not Connected</span>
				<span class="text-[var(--muted-foreground)]"> -Connect your {sourceChain} wallet</span>
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
				<span class="text-[var(--muted-foreground)]"> -Switch to {sourceChain}</span>
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
				class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
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
						<div class="text-[0.65rem] text-[var(--muted-foreground)] capitalize">
							{generationStep.replace("-", " ")}
						</div>
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			{#if isGenerating}
				<div class="mt-2 h-1 bg-[var(--swamp-surface)] rounded-full overflow-hidden">
					<div class="h-full bg-gradient-to-r from-[var(--toad-green)] to-[var(--warp-purple)] rounded-full shimmer" style="width: {
						generationStep === 'preparing' ? '15%' :
						generationStep === 'approving' ? '30%' :
						generationStep === 'wrapping' ? '50%' :
						generationStep === 'burning' ? '70%' :
						generationStep === 'triggering-sync' ? '90%' :
						'100%'
					}"></div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Submit Button -->
	<button
		class="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative overflow-hidden group
			{canSubmit
				? 'btn-warp cursor-pointer'
				: 'bg-[var(--swamp-surface)] text-[var(--muted-foreground)] cursor-not-allowed border border-[rgba(130,226,102,0.1)]'
			}"
		disabled={!canSubmit}
		onclick={confirmBridge}
	>
		<span class="relative z-10 flex items-center justify-center gap-1.5">
			{#if generationStep === "idle"}
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
				</svg>
				Initiate Bridge
			{:else if generationStep === "preparing"}
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
				Creating Commitment...
			{:else if generationStep === "triggering-sync"}
				<Loader2 class="size-4 animate-spin" />
				Syncing...
			{:else if generationStep === "complete" || generationStep === "done"}
				<CheckCircle2 class="size-4" />
				Complete!
			{:else}
				Initiate Bridge
			{/if}
		</span>
	</button>
</div>

<!-- Bridge Duration Disclaimer Dialog -->
<Dialog bind:open={showDisclaimer}>
	<DialogContent class="sm:max-w-md bg-[var(--swamp-card)] border border-[rgba(130,226,102,0.15)]">
		<DialogHeader>
			<DialogTitle class="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
				<svg class="size-6 text-[var(--toad-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Synchronization Time
			</DialogTitle>
			<DialogDescription class="space-y-4 pt-3">
				{#if targetChain === 'Scroll' || sourceChain === 'Scroll'}
					<div class="p-4 rounded-xl bg-[rgba(224,226,102,0.1)] border border-[rgba(224,226,102,0.2)]">
						<div class="flex items-center gap-2 text-[var(--eye-yellow)] font-semibold">
							<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>2-3 hours for Scroll</span>
						</div>
						<p class="text-xs text-[var(--muted-foreground)] mt-2">
							Scroll L2 finalization and claim data availability requires extended processing time.
						</p>
					</div>
				{:else if targetChain === 'Aztec' || sourceChain === 'Aztec'}
					<div class="p-4 rounded-xl bg-[rgba(144,97,249,0.1)] border border-[rgba(144,97,249,0.2)]">
						<div class="flex items-center gap-2 text-[var(--warp-purple)] font-semibold">
							<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>30-60 minutes for Aztec</span>
						</div>
						<p class="text-xs text-[var(--muted-foreground)] mt-2">
							L1 message confirmation is required for privacy-preserving bridges.
						</p>
					</div>
				{/if}

				<div class="p-4 rounded-xl bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.1)]">
					<p class="text-sm font-medium text-[var(--foreground)] mb-3">What happens next:</p>
					<ol class="space-y-2">
						<li class="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
							<span class="flex-shrink-0 size-5 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center text-[var(--toad-green)] font-bold">1</span>
							<span>Tokens burned on {sourceChain}</span>
						</li>
						<li class="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
							<span class="flex-shrink-0 size-5 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center text-[var(--toad-green)] font-bold">2</span>
							<span>Withdrawal note generated & downloaded</span>
						</li>
						<li class="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
							<span class="flex-shrink-0 size-5 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center text-[var(--toad-green)] font-bold">3</span>
							<span>Root sync triggered automatically</span>
						</li>
						<li class="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
							<span class="flex-shrink-0 size-5 rounded-full bg-[rgba(144,97,249,0.2)] flex items-center justify-center text-[var(--warp-purple)] font-bold">4</span>
							<span>Use note to withdraw on {targetChain}</span>
						</li>
					</ol>
				</div>

				<p class="text-xs text-[var(--muted-foreground)] text-center">
					Your note downloads immediately. You can safely close this page.
				</p>
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="flex gap-3 pt-2">
			<button
				onclick={() => showDisclaimer = false}
				class="flex-1 py-2.5 px-4 rounded-lg border border-[rgba(130,226,102,0.2)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[rgba(130,226,102,0.4)] transition-all text-sm font-medium"
			>
				Cancel
			</button>
			<button
				onclick={generateProof}
				class="flex-1 py-2.5 px-4 rounded-lg btn-warp text-sm font-semibold"
			>
				Continue
			</button>
		</DialogFooter>
	</DialogContent>
</Dialog>
