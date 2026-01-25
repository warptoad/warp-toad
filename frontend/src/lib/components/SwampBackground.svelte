<script lang="ts">
	import { onMount } from 'svelte';

	// Sparse firefly positions - fewer, smaller, more subtle
	const fireflies = Array.from({ length: 12 }, (_, i) => ({
		id: i,
		left: Math.random() * 100,
		top: Math.random() * 100,
		delay: Math.random() * 8,
		duration: 6 + Math.random() * 6,
		size: 1.5 + Math.random() * 1.5,
	}));

	let mounted = $state(false);
	let spores = $state<Array<{id: number, x: number, y: number, size: number, isPurple: boolean}>>([]);
	let sporeId = 0;
	let lastSporeTime = 0;

	function handleMouseMove(e: MouseEvent) {
		const now = Date.now();
		// Throttle: spawn spore every 80ms while moving
		if (now - lastSporeTime < 80) return;
		lastSporeTime = now;

		// Random offset from cursor
		const offsetX = (Math.random() - 0.5) * 40;
		const offsetY = (Math.random() - 0.5) * 40;

		const newSpore = {
			id: sporeId++,
			x: e.clientX + offsetX,
			y: e.clientY + offsetY,
			size: 1.5 + Math.random() * 2,
			isPurple: Math.random() > 0.7,
		};

		spores = [...spores, newSpore];

		// Remove spore after animation completes
		setTimeout(() => {
			spores = spores.filter(s => s.id !== newSpore.id);
		}, 1200);
	}

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="swamp-background" aria-hidden="true">
	<!-- Simple gradient background -->
	<div class="gradient-base"></div>

	<!-- Noise texture overlay -->
	<div class="noise-overlay"></div>

	<!-- Minimal firefly particles -->
	{#if mounted}
		<div class="fireflies">
			{#each fireflies as fly (fly.id)}
				<div
					class="firefly"
					class:purple={fly.id % 4 === 0}
					style="
						left: {fly.left}%;
						top: {fly.top}%;
						animation-delay: {fly.delay}s;
						animation-duration: {fly.duration}s;
						width: {fly.size}px;
						height: {fly.size}px;
					"
				></div>
			{/each}
		</div>

		<!-- Mouse spores -->
		<div class="spores">
			{#each spores as spore (spore.id)}
				<div
					class="spore"
					class:purple={spore.isPurple}
					style="
						left: {spore.x}px;
						top: {spore.y}px;
						width: {spore.size}px;
						height: {spore.size}px;
					"
				></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.swamp-background {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	/* Simple gradient - mostly solid with subtle vignette */
	.gradient-base {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 120% 80% at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%),
			linear-gradient(180deg, #050708 0%, #080b0e 50%, #0a0e11 100%);
	}

	/* Noise texture for organic feel */
	.noise-overlay {
		position: absolute;
		inset: 0;
		opacity: 0.4;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
		mix-blend-mode: overlay;
	}

	/* Firefly particles - minimal, no glow */
	.fireflies {
		position: absolute;
		inset: 0;
	}

	.firefly {
		position: absolute;
		border-radius: 50%;
		background: var(--toad-green);
		opacity: 0;
		animation: firefly-blink ease-in-out infinite;
		will-change: opacity;
	}

	.firefly.purple {
		background: var(--warp-purple);
	}

	@keyframes firefly-blink {
		0%, 100% {
			opacity: 0;
		}
		15%, 25% {
			opacity: 0.6;
		}
		50% {
			opacity: 0.15;
		}
		75%, 85% {
			opacity: 0.5;
		}
	}

	/* Mouse spores - ephemeral particles */
	.spores {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.spore {
		position: absolute;
		border-radius: 50%;
		background: var(--toad-green);
		transform: translate(-50%, -50%);
		animation: spore-fade 1.2s ease-out forwards;
	}

	.spore.purple {
		background: var(--warp-purple);
	}

	@keyframes spore-fade {
		0% {
			opacity: 0.8;
			transform: translate(-50%, -50%) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.3) translateY(-20px);
		}
	}

	/* Reduce motion for accessibility */
	@media (prefers-reduced-motion: reduce) {
		.firefly,
		.spore {
			animation: none;
		}
		.firefly {
			opacity: 0.2;
		}
		.spore {
			display: none;
		}
	}
</style>
