<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { TOKEN_COLORS, TOKEN_NAMES, type Token, type Chain } from "$lib/types/bridge.js";
	import { Search } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		selectedToken: Token;
		chain: Chain;
		onSelect: (token: Token) => void;
	}

	let { open = $bindable(false), selectedToken, chain, onSelect }: Props = $props();

	const tokens: Token[] = ['ETH', 'USDC', 'DAI', 'WBTC'];
	let searchQuery = $state('');

	let filteredTokens = $derived(
		tokens.filter(token => 
			token.toLowerCase().includes(searchQuery.toLowerCase()) ||
			TOKEN_NAMES[token].toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function handleSelect(token: Token) {
		onSelect(token);
		open = false;
		searchQuery = '';
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Select Token</DialogTitle>
		</DialogHeader>
		
		<!-- Search Input -->
		<div class="relative">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
			<Input
				type="text"
				placeholder="Search tokens..."
				bind:value={searchQuery}
				class="pl-9"
			/>
		</div>

		<!-- Token List -->
		<div class="grid gap-2 max-h-[400px] overflow-y-auto">
			{#each filteredTokens as token (token)}
				<button
					class="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
					class:bg-accent={selectedToken === token}
					class:border-primary={selectedToken === token}
					onclick={() => handleSelect(token)}
				>
					<!-- Token Icon (Colored Circle) -->
					<div class="size-10 rounded-full {TOKEN_COLORS[token]} flex items-center justify-center">
						<span class="text-white font-bold text-sm">{token.slice(0, 2)}</span>
					</div>
					
					<!-- Token Info -->
					<div class="flex-1">
						<div class="font-semibold">{token}</div>
						<div class="text-sm text-muted-foreground">{TOKEN_NAMES[token]}</div>
					</div>

					<!-- Balance -->
					<div class="text-right">
						<div class="text-sm font-medium">
							{proofStore.getBalance(token, chain)}
						</div>
						<div class="text-xs text-muted-foreground">{token}</div>
					</div>
				</button>
			{/each}
		</div>

		{#if filteredTokens.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				No tokens found
			</div>
		{/if}
	</DialogContent>
</Dialog>
