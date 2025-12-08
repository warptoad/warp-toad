<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { CHAIN_COLORS, type Chain } from "$lib/types/bridge.js";

	interface Props {
		open?: boolean;
		selectedChain: Chain;
		excludeChain?: Chain | null;
		onSelect: (chain: Chain) => void;
	}

	let {
		open = $bindable(false),
		selectedChain,
		excludeChain = null,
		onSelect,
	}: Props = $props();

	const chains: Chain[] = ["Ethereum", "Scroll", "Aztec"];

	let availableChains = $derived(
		excludeChain ? chains.filter((c) => c !== excludeChain) : chains,
	);

	function handleSelect(chain: Chain) {
		onSelect(chain);
		open = false;
	}

	function getChainDescription(chain: Chain): string {
		if (chain === "Ethereum") return "Mainnet";
		if (chain === "Scroll") return "Layer 2";
		return "Layer 2";
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Select Chain</DialogTitle>
		</DialogHeader>

		<!-- Chain List -->
		<div class="grid gap-2">
			{#each availableChains as chain (chain)}
				<button
					class="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
					class:bg-accent={selectedChain === chain}
					class:border-primary={selectedChain === chain}
					onclick={() => handleSelect(chain)}
				>
					<!-- Chain Icon (Colored Circle) -->
					<div
						class="size-12 rounded-full {CHAIN_COLORS[
							chain
						]} flex items-center justify-center"
					>
						<span class="text-white font-bold"
							>{chain.slice(0, 1)}</span
						>
					</div>

					<!-- Chain Info -->
					<div class="flex-1">
						<div class="font-semibold text-lg">{chain}</div>
						<div class="text-sm text-muted-foreground">
							{getChainDescription(chain)}
						</div>
					</div>
				</button>
			{/each}
		</div>
	</DialogContent>
</Dialog>
