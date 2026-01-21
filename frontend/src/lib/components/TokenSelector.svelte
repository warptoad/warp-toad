<script lang="ts">
	import { Popover } from "bits-ui";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import {
		TOKEN_STYLES,
		TOKEN_NAMES,
		type Token,
		type Chain,
	} from "$lib/types/bridge.js";
	import { ChevronDown } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		selectedToken: Token;
		chain: Chain;
		variant?: 'green' | 'purple';
		onSelect: (token: Token) => void;
	}

	let {
		open = $bindable(false),
		selectedToken,
		chain,
		variant = 'green',
		onSelect,
	}: Props = $props();

	const tokens: Token[] = ["USDC", "DAI", "WBTC"];

	function handleSelect(token: Token) {
		onSelect(token);
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="swamp-selector-btn {variant === 'purple' ? 'purple' : ''}"
	>
		<img
			src={TOKEN_STYLES[selectedToken].logo}
			alt={selectedToken}
			class="swamp-selector-icon-img"
			style="--icon-glow: {TOKEN_STYLES[selectedToken].glow};"
		/>
		<span class="text-sm font-semibold text-[var(--foreground)]">{selectedToken}</span>
		<ChevronDown class="size-3.5 text-[var(--muted-foreground)] transition-transform {open ? 'rotate-180' : ''}" />
	</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			class="swamp-popover {variant === 'purple' ? 'swamp-popover-purple' : 'swamp-popover-green'}"
			sideOffset={8}
			align="start"
			style="z-index: 9999;"
		>
			{#each tokens as token (token)}
				<button
					class="swamp-selector-item w-full {variant === 'purple' ? 'purple' : ''} {selectedToken === token ? 'selected' : ''}"
					onclick={() => handleSelect(token)}
				>
					<img
						src={TOKEN_STYLES[token].logo}
						alt={token}
						class="swamp-selector-item-icon-img"
					/>

					<div class="flex-1 text-left">
						<div class="text-sm font-semibold text-[var(--foreground)]">{token}</div>
						<div class="text-[0.65rem] text-[var(--muted-foreground)]">
							{TOKEN_NAMES[token]}
						</div>
					</div>

					<div class="text-right">
						<div class="text-[0.6rem] text-[var(--muted-foreground)]">Balance</div>
						<div class="text-xs font-medium font-mono text-[var(--foreground)]">
							{#await proofStore.getBalance(token, chain)}
								...
							{:then balance}
								{balance}
							{:catch}
								-
							{/await}
						</div>
					</div>
				</button>
			{/each}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
