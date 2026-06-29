<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import type { Chain } from '$lib/types/bridge.js';
	import { getExplorerTxLink } from '$lib/utils/explorer.js';

	interface Props {
		/** Chain the tx was mined on (picks the explorer). */
		chain: Chain;
		txHash?: string | null;
		/** Link text. Defaults to "View on {explorer}". */
		label?: string;
		/** Icon-only, for tight spots like table rows. The label still drives the tooltip. */
		iconOnly?: boolean;
		class?: string;
	}
	let { chain, txHash, label, iconOnly = false, class: className = '' }: Props = $props();

	let link = $derived(getExplorerTxLink(chain, txHash));
	let text = $derived(label ?? (link ? `View on ${link.name}` : ''));
</script>

{#if link}
	<a
		href={link.url}
		target="_blank"
		rel="noopener noreferrer"
		title={text}
		aria-label={text}
		onclick={(e) => e.stopPropagation()}
		class="inline-flex items-center gap-1 text-[color:var(--color-accent)] hover:underline {className}"
	>
		<ExternalLink class="size-3 shrink-0" />
		{#if !iconOnly}<span>{text}</span>{/if}
	</a>
{/if}
