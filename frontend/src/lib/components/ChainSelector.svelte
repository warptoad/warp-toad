<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { CHAIN_COLORS, type Chain } from "$lib/types/bridge.js";
	import { ALL_CHAINS, isChainAvailable, isChainDisabled, isTestMode } from "$lib/config/environment.js";

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

	// Get all chains, filtering out the excluded one
	let availableChains = $derived(
		excludeChain ? ALL_CHAINS.filter((c) => c !== excludeChain) : ALL_CHAINS,
	);

	function handleSelect(chain: Chain) {
		// Don't allow selecting disabled chains
		if (isChainDisabled(chain)) return;
		
		onSelect(chain);
		open = false;
	}

	function getChainDescription(chain: Chain): string {
		if (chain === "Ethereum") {
			return isTestMode ? "Localhost (Anvil)" : "Sepolia Testnet";
		}
		if (chain === "Scroll") {
			if (isChainDisabled(chain)) {
				return "Not available in test mode";
			}
			return "Layer 2 (Scroll Sepolia)";
		}
		if (chain === "Aztec") {
			return isTestMode ? "Sandbox (Local)" : "Devnet";
		}
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
				{@const disabled = isChainDisabled(chain)}
				<button
					class="flex items-center gap-3 p-4 border rounded-lg transition-colors text-left"
					class:hover:bg-accent={!disabled}
					class:bg-accent={selectedChain === chain && !disabled}
					class:border-primary={selectedChain === chain && !disabled}
					class:opacity-50={disabled}
					class:cursor-not-allowed={disabled}
					class:cursor-pointer={!disabled}
					onclick={() => handleSelect(chain)}
					{disabled}
				>
					<!-- Chain Icon (Colored Circle) -->
					<div
						class="size-12 rounded-full {CHAIN_COLORS[chain]} flex items-center justify-center"
						class:grayscale={disabled}
					>
						<span class="text-white font-bold"
							>{chain.slice(0, 1)}</span
						>
					</div>

					<!-- Chain Info -->
					<div class="flex-1">
						<div class="font-semibold text-lg flex items-center gap-2">
							{chain}
							{#if disabled}
								<span class="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
									Disabled
								</span>
							{/if}
						</div>
						<div class="text-sm text-muted-foreground">
							{getChainDescription(chain)}
						</div>
					</div>
				</button>
			{/each}
		</div>
		
		{#if isTestMode}
			<div class="text-xs text-muted-foreground text-center mt-2">
				Running in test mode (VITE_TEST_MODE=true)
			</div>
		{/if}
	</DialogContent>
</Dialog>
