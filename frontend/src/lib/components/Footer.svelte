<script lang="ts">
	import { Github, ExternalLink, Copy, Check, Mail, Megaphone } from "@lucide/svelte";

	interface Props {
		variant?: "donate-card" | "drawer";
	}

	let { variant = "donate-card" }: Props = $props();

	const DONATE_ENS = "donate.warptoad.eth";

	let copied = $state(false);

	async function copyDonate() {
		try {
			await navigator.clipboard.writeText(DONATE_ENS);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Older browsers / non-secure contexts: silently no-op. Users can
			// still read the ENS off the pill.
		}
	}

	const pillClass =
		"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors";
</script>

{#if variant === "donate-card"}
	<aside class="hidden md:block w-full max-w-2xl mx-auto mt-4">
		<!--
			Grid layout. On mobile the three children flow in DOM order
			(text → button → subtext). On desktop the button moves into a
			right-hand column spanning both rows, leaving text + subtext
			stacked on the left.
		-->
		<div
			class="rounded-xl border border-border bg-transparent backdrop-blur-[2px] px-4 py-3 grid gap-y-2 md:grid-cols-[1fr_auto] md:gap-x-4 md:gap-y-0.5 md:items-center"
		>
			<p
				class="text-xs text-foreground/80 leading-snug md:col-start-1 md:row-start-1"
			>
				warptoad is open-source and community funded. If you believe in
				private, cross-chain infrastructure, consider supporting the
				research.
			</p>
			<button
				type="button"
				onclick={copyDonate}
				class="cursor-pointer justify-self-start md:justify-self-end md:col-start-2 md:row-span-2 md:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-mono bg-background/90 backdrop-blur-md border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors"
				title="Copy {DONATE_ENS}"
			>
				<span>{DONATE_ENS}</span>
				{#if copied}
					<Check class="size-3" />
				{:else}
					<Copy class="size-3" />
				{/if}
			</button>
			<p
				class="text-[10px] text-muted-foreground md:col-start-1 md:row-start-2"
			>
				Works on Ethereum Mainnet, Optimism, and Arbitrum.
			</p>
		</div>
	</aside>
{:else}
	<section class="space-y-3">
		<h3 class="text-xs font-medium text-muted-foreground uppercase tracking-widest">
			Links
		</h3>
		<div class="flex flex-wrap gap-2">
			<a
				href="https://warptoad.org"
				target="_blank"
				rel="noopener noreferrer"
				class={pillClass + " h-9"}
				title="More information about warptoad"
			>
				<span>Learn more</span>
				<ExternalLink class="size-3" />
			</a>
			<a
				href="https://github.com/warptoad/warp-toad"
				target="_blank"
				rel="noopener noreferrer"
				class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
				title="GitHub"
				aria-label="GitHub"
			>
				<Github class="size-4" />
			</a>
			<a
				href="https://x.com/warptoad_xyz"
				target="_blank"
				rel="noopener noreferrer"
				class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
				title="X (formerly Twitter)"
				aria-label="X"
			>
				<svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
				</svg>
			</a>
			<a
				href="https://blog.warptoad.org"
				target="_blank"
				rel="noopener noreferrer"
				class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
				title="Read our blog"
				aria-label="Blog"
			>
				<Megaphone class="size-4" />
			</a>
			<a
				href="mailto:contact@warptoad.org"
				class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
				title="Email contact@warptoad.org"
				aria-label="Email"
			>
				<Mail class="size-4" />
			</a>
		</div>
	</section>

	<section class="space-y-3">
		<h3 class="text-xs font-medium text-muted-foreground uppercase tracking-widest">
			Donate
		</h3>
		<p class="text-xs text-foreground/80 leading-snug">
			warptoad is open-source and community funded. If you believe in
			private, cross-chain infrastructure, consider supporting the
			research.
		</p>
		<button
			type="button"
			onclick={copyDonate}
			class="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-mono bg-background/90 backdrop-blur-md border border-[color:var(--color-accent)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors"
			title="Copy {DONATE_ENS}"
		>
			<span>{DONATE_ENS}</span>
			{#if copied}
				<Check class="size-3" />
			{:else}
				<Copy class="size-3" />
			{/if}
		</button>
		<p class="text-[10px] text-muted-foreground">
			Works on Ethereum Mainnet, Optimism, and Arbitrum.
		</p>
	</section>
{/if}
