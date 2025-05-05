<script lang="ts">
	export let x = 100;
	export let y = 100;
	export let width = 0;
	export let height = 0;
	export let title: string = "";
	export let isVisible: boolean = true;

	let dragWindow: HTMLElement;
	let moving = false;

	$: width = clampRange(width, 20, 75); //clamps min value to 20% and max value to 75%
	$: height = clampRange(height, 20, 75);

	function clampRange(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(value, max));
	}

	function onMouseDown() {
		moving = true;
	}

	function onMouseUp() {
		moving = false;
	}

	function onMouseMove(e: MouseEvent) {
		if (!moving || !dragWindow) return;

		const newLeft = x + e.movementX;
		const newTop = y + e.movementY;

		const maxLeft = window.innerWidth - dragWindow.offsetWidth;
		const maxTop = window.innerHeight - dragWindow.offsetHeight;

		x = Math.max(0, Math.min(newLeft, maxLeft));
		y = Math.max(0, Math.min(newTop, maxTop));
	}

	const handleCloseWindow = () => {
		isVisible = false;
	};
</script>

<section
	bind:this={dragWindow}
	class={`absolute flex flex-col rounded-md bg-base-300 border-2 ${isVisible ? '' : 'invisible'}`}
	style="left: {x}px; top: {y}px; min-width: {width}%; min-height: {height}%; max-width: 75%; max-height: 75%;"
>
	<div
		class="border-b-2 p-2 mb-2 draggable flex justify-between items-center bg-base-100"
    	class:cursor-grabbing={moving}
		class:cursor-grab={!moving}
		on:mousedown={onMouseDown}
		aria-label="Drag window"
		role="button"
		tabindex="0"
	>
		<div>{title}</div>
		<button class="closeButton hover:text-warning transition-colors duration-200" on:click={handleCloseWindow}>X</button>
	</div>
	<!-- This is the slot container where the content needs to be centered -->
	<div class="flex-grow p-2 flex justify-center items-center overflow-auto">
		<slot></slot>
	</div>
</section>

<svelte:window on:mouseup={onMouseUp} on:mousemove={onMouseMove} />

<style>
	.draggable {
		user-select: none;
	}
	.closeButton {
		cursor: pointer;
	}
</style>

