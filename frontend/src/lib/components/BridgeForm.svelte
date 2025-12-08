<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import { ArrowDownUp, Loader2, CheckCircle2, ChevronDown } from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import TokenSelector from "./TokenSelector.svelte";
	import ChainSelector from "./ChainSelector.svelte";
	import { TOKEN_COLORS, CHAIN_COLORS, type Chain, type Token } from "$lib/types/bridge.js";

	let sourceChain = $state<Chain>('Ethereum');
	let targetChain = $state<Chain>('Aztec');
	let selectedToken = $state<Token>('ETH');
	let amount = $state<string>('');
	
	let isGenerating = $state(false);
	let generationStep = $state<'idle' | 'preparing' | 'generating' | 'complete'>('idle');
	let generationMessage = $state('');

	// Dialog states
	let sourceTokenOpen = $state(false);
	let sourceChainOpen = $state(false);
	let targetChainOpen = $state(false);

	let balance = $derived(proofStore.getBalance(selectedToken, sourceChain));
	let estimatedReceive = $derived(amount || '0.0');
	
	let isSourceConnected = $derived(walletStore.isChainConnected(sourceChain));
	let isOnCorrectNetwork = $derived(walletStore.isOnCorrectNetwork(sourceChain));
	let needsNetworkSwitch = $derived(
		isSourceConnected && 
		!isOnCorrectNetwork &&
		sourceChain !== 'Aztec'
	);
	
	let canSubmit = $derived(
		isSourceConnected && 
		isOnCorrectNetwork &&
		amount !== '' && 
		parseFloat(amount) > 0 && 
		parseFloat(amount) <= parseFloat(balance) &&
		!isGenerating
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
			console.error('Failed to switch network:', error);
		}
	}

	async function generateProof() {
		if (!canSubmit) return;

		isGenerating = true;
		
		// Step 1: Preparing
		generationStep = 'preparing';
		generationMessage = 'Preparing transaction...';
		await new Promise(resolve => setTimeout(resolve, 500));

		// Step 2: Generating proof
		generationStep = 'generating';
		generationMessage = 'Generating zero-knowledge proof...';
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Step 3: Complete
		generationStep = 'complete';
		generationMessage = 'Proof generated successfully!';
		
		// Add proof and download
		const proof = proofStore.addProof(amount, selectedToken, sourceChain, targetChain);
		proofStore.downloadProof(proof);

		await new Promise(resolve => setTimeout(resolve, 1000));

		// Reset form
		amount = '';
		isGenerating = false;
		generationStep = 'idle';
		generationMessage = '';
	}

	function handleSourceTokenSelect(token: Token) {
		selectedToken = token;
	}

	function handleSourceChainSelect(chain: Chain) {
		sourceChain = chain;
		// Auto-switch target if same
		if (sourceChain === targetChain) {
			targetChain = sourceChain === 'Ethereum' ? 'Aztec' : 'Ethereum';
		}
	}

	function handleTargetChainSelect(chain: Chain) {
		targetChain = chain;
		// Auto-switch source if same
		if (targetChain === sourceChain) {
			sourceChain = targetChain === 'Ethereum' ? 'Aztec' : 'Ethereum';
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
						onclick={() => sourceTokenOpen = true}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div class="size-8 rounded-full {TOKEN_COLORS[selectedToken]} flex items-center justify-center">
							<span class="text-white font-bold text-xs">{selectedToken.slice(0, 2)}</span>
						</div>
						<span class="font-semibold">{selectedToken}</span>
						<ChevronDown class="size-4" />
					</button>

					<!-- Chain Selector Button -->
					<button
						onclick={() => sourceChainOpen = true}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div class="size-8 rounded-full {CHAIN_COLORS[sourceChain]} flex items-center justify-center">
							<span class="text-white font-bold text-xs">{sourceChain.slice(0, 1)}</span>
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
						Balance: {balance} {selectedToken}
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
					<div class="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/50">
						<div class="size-8 rounded-full {TOKEN_COLORS[selectedToken]} flex items-center justify-center">
							<span class="text-white font-bold text-xs">{selectedToken.slice(0, 2)}</span>
						</div>
						<span class="font-semibold">{selectedToken}</span>
					</div>

					<!-- Chain Selector Button -->
					<button
						onclick={() => targetChainOpen = true}
						class="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-accent transition-colors"
					>
						<div class="size-8 rounded-full {CHAIN_COLORS[targetChain]} flex items-center justify-center">
							<span class="text-white font-bold text-xs">{targetChain.slice(0, 1)}</span>
						</div>
						<span class="font-medium">{targetChain}</span>
						<ChevronDown class="size-4" />
					</button>
				</div>

				<!-- Estimated Amount Display -->
				<div class="space-y-2">
					<div class="text-2xl font-semibold text-muted-foreground h-12 flex items-center">
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
						{walletStore.isConnecting ? 'Switching...' : 'Switch Network'}
					</Button>
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Proof Generation Progress -->
		{#if isGenerating}
			<Alert>
				<AlertDescription class="flex items-center gap-2">
					{#if generationStep === 'complete'}
						<CheckCircle2 class="size-4" />
					{:else}
						<Loader2 class="size-4 animate-spin" />
					{/if}
					<span>{generationMessage}</span>
				</AlertDescription>
			</Alert>
		{/if}

		<!-- Submit Button -->
		<Button 
			class="w-full h-12 text-base" 
			disabled={!canSubmit}
			onclick={generateProof}
		>
			{isGenerating ? 'Generating Proof...' : 'Generate Proof & Bridge'}
		</Button>
	</CardContent>
</Card>

<!-- Selectors -->
<TokenSelector 
	bind:open={sourceTokenOpen}
	selectedToken={selectedToken}
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
