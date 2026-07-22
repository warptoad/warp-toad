<script lang="ts">
	import { Popover } from "bits-ui";
	import { CHAIN_STYLES, type Chain } from "$lib/types/bridge.js";
	import { ALL_CHAINS, isChainDisabled, isTestMode } from "$lib/config/environment.js";
	import { ChevronDown } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		selectedChain: Chain;
		excludeChain?: Chain | null;
		variant?: 'green' | 'purple';
		onSelect: (chain: Chain) => void;
	}

	let {
		open = $bindable(false),
		selectedChain,
		excludeChain = null,
		variant = 'green',
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
		if (chain === "ZKsync") {
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

	function getNetworkBadge(chain: Chain): string | null {
		if (isTestMode) {
			if (chain === "Ethereum") return "Local";
			if (chain === "Aztec") return "Sandbox";
			return null;
		}
		return "Testnet";
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="swamp-selector-btn {variant === 'purple' ? 'purple' : ''}"
	>
		<img
			src={CHAIN_STYLES[selectedChain].logo}
			alt={selectedChain}
			class="swamp-selector-icon-img"
			style="--icon-glow: {CHAIN_STYLES[selectedChain].glow};"
		/>
		<span class="text-sm font-medium text-[var(--foreground)]">{selectedChain}</span>
		<ChevronDown class="size-3.5 text-[var(--muted-foreground)] transition-transform {open ? 'rotate-180' : ''}" />
	</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			class="swamp-popover {variant === 'purple' ? 'swamp-popover-purple' : 'swamp-popover-green'}"
			sideOffset={8}
			align="start"
			style="z-index: 9999;"
		>
			{#each availableChains as chain (chain)}
				{@const disabled = isChainDisabled(chain)}
				{@const badge = getNetworkBadge(chain)}
				<button
					class="swamp-selector-item w-full {variant === 'purple' ? 'purple' : ''} {selectedChain === chain && !disabled ? 'selected' : ''} {disabled ? 'disabled' : ''}"
					onclick={() => handleSelect(chain)}
					{disabled}
				>
					<img
						src={CHAIN_STYLES[chain].logo}
						alt={chain}
						class="swamp-selector-item-icon-img"
						class:grayscale={disabled}
					/>

					<div class="flex-1 text-left">
						<div class="flex items-center gap-1.5">
							<span class="text-sm font-semibold text-[var(--foreground)]">{chain}</span>
							{#if disabled}
								<span class="text-[0.6rem] font-normal text-[var(--muted-foreground)] bg-[var(--swamp-surface)] px-1 py-0.5 rounded">
									Disabled
								</span>
							{:else if badge}
								<span class="text-[0.6rem] font-medium {variant === 'purple' ? 'text-[var(--warp-purple)] bg-[rgba(144,97,249,0.15)]' : 'text-[var(--toad-green)] bg-[rgba(130,226,102,0.15)]'} px-1 py-0.5 rounded">
									{badge}
								</span>
							{/if}
						</div>
						<div class="text-[0.65rem] text-[var(--muted-foreground)]">
							{getChainDescription(chain)}
						</div>
					</div>
				</button>
			{/each}

			{#if isTestMode}
				<div class="text-[0.55rem] text-[var(--muted-foreground)] text-center py-1.5 border-t border-[rgba(255,255,255,0.05)]">
					Test mode
				</div>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
