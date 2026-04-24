<script lang="ts">
	import { onMount } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte.js";

	let canvas = $state<HTMLCanvasElement | null>(null);

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext("2d")!;
		let animId = 0;
		let isVisible = true;

		function resize() {
			if (!canvas) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		}
		resize();
		window.addEventListener("resize", resize);

		// Pause when tab is hidden, save CPU.
		const onVisibility = () => {
			isVisible = !document.hidden;
			if (isVisible && !animId) animId = requestAnimationFrame(draw);
		};
		document.addEventListener("visibilitychange", onVisibility);

		// Value-noise hash + smoothed FBM with domain warping.
		function hash(x: number, y: number) {
			let h = x * 374761393 + y * 668265263;
			h = (h ^ (h >> 13)) * 1274126177;
			return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
		}
		function smoothNoise(x: number, y: number) {
			const ix = Math.floor(x), iy = Math.floor(y);
			const fx = x - ix, fy = y - iy;
			const sx = fx * fx * (3 - 2 * fx);
			const sy = fy * fy * (3 - 2 * fy);
			const a = hash(ix, iy), b = hash(ix + 1, iy);
			const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
			return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
		}
		function fbm(x: number, y: number) {
			return (
				smoothNoise(x, y) * 0.5 +
				smoothNoise(x * 2, y * 2) * 0.25 +
				smoothNoise(x * 4, y * 4) * 0.125 +
				smoothNoise(x * 8, y * 8) * 0.0625
			);
		}
		function noise(x: number, y: number) {
			const qx = fbm(x + 1.7, y + 9.2);
			const qy = fbm(x + 8.3, y + 2.8);
			return fbm(x + qx * 2.5, y + qy * 2.5);
		}

		const chars = " .,:;+*?%#@";
		const charLen = chars.length;

		function draw(t: number) {
			if (!canvas || !isVisible) {
				animId = 0;
				return;
			}
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);

			const isMobile = width < 768;
			const fontSize = isMobile ? 18 : 24;
			const cellW = fontSize * 0.62;
			const cellH = fontSize * 1.15;
			const cols = Math.ceil(width / cellW);
			const rows = Math.ceil(height / cellH);

			ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
			ctx.textBaseline = "top";

			// Color flips with theme: dark glyphs on light, light glyphs on dark.
			const isDark = themeStore.resolved === "dark";
			const baseRGB = isDark ? "245,243,240" : "15,15,15";

			const time = t * 0.0002;
			const noiseScale = 0.045;

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const nx = col * noiseScale + time;
					const ny = row * noiseScale + time * 0.3;
					const n = noise(nx, ny);

					const charIdx = Math.floor(n * charLen);
					const ch = chars[Math.min(charIdx, charLen - 1)];
					if (ch === " ") continue;

					// Vertical fade + radial vignette - bottom/edges denser, center sparser.
					const verticalFade = row / rows;
					const dx = (col / cols - 0.5) * 2;
					const dy = (row / rows - 0.5) * 2;
					const vignette = Math.min(1, (dx * dx + dy * dy) * 0.8);
					const alpha = (0.18 + n * 0.20) * verticalFade * vignette;

					ctx.fillStyle = `rgba(${baseRGB},${alpha})`;
					ctx.fillText(ch, col * cellW, row * cellH);
				}
			}
			animId = requestAnimationFrame(draw);
		}

		animId = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(animId);
			animId = 0;
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="fixed inset-0 w-full h-full pointer-events-none z-0"
	aria-hidden="true"
></canvas>
