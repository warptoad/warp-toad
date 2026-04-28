<script lang="ts">
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter,
	} from "$lib/components/ui/dialog/index.js";
	import { Trash2, Download } from "@lucide/svelte";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import type { Proof } from "$lib/types/bridge.js";

	import { tick, type Snippet } from "svelte";
	import { slide } from "svelte/transition";
	import { cubicOut } from "svelte/easing";

	interface Props {
		onselect?: (proof: Proof) => void;
		/** Proof ID currently loaded into the withdraw panel, so we can
		 * highlight the matching row. Undefined = nothing selected. */
		selectedId?: string | null;
		/** Lock non-active rows (click + checkbox + delete) while a withdraw
		 * is in progress, so the in-flight selection can't be swapped out
		 * from under the running flow. */
		disabled?: boolean;
		/** Optional snippet rendered as an expanded accordion row beneath the
		 * selected proof. Keeps the withdraw form inline with its row so users
		 * with long proof lists don't lose the visual link between the panel
		 * and the source row. */
		details?: Snippet<[Proof]>;
	}

	let { onselect, selectedId = null, disabled = false, details }: Props = $props();

	let scrollContainer = $state<HTMLDivElement>();

	// When a proof is opened, smooth-scroll the active row to the top of the
	// table's scrollable view (just under the sticky thead) so the expanded
	// details panel reveals beneath it inside the visible area. Falls back to
	// the page scroll on viewports where the table itself isn't scrollable.
	//
	// Switching from one open proof to another keeps the previous details row
	// in the DOM during its slide-out (220ms). Measuring before that collapse
	// finishes leaves the new row landing above the sticky header once the
	// layout settles, so we defer the scroll past the slide when an outgoing
	// row is present. First-click case has no outgoing row and scrolls
	// immediately so it still happens in parallel with the slide-in.
	$effect(() => {
		if (!selectedId || !details || !scrollContainer) return;
		const container = scrollContainer;
		let cancelled = false;

		void tick().then(() => {
			if (cancelled) return;
			const row = container.querySelector<HTMLElement>('.proof-row-active');
			if (!row) return;

			const newDetails = row.nextElementSibling;
			const allDetails = container.querySelectorAll<HTMLElement>('.proof-row-details');
			const hasOutgoing = Array.from(allDetails).some((el) => el !== newDetails);

			const performScroll = () => {
				if (cancelled) return;
				const tableScrolls = container.scrollHeight > container.clientHeight;
				if (tableScrolls) {
					const thead = container.querySelector<HTMLElement>('thead');
					const headerHeight = thead?.offsetHeight ?? 0;
					const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
					container.scrollTo({
						top: container.scrollTop + offset - headerHeight,
						behavior: 'smooth',
					});
				} else {
					row.scrollIntoView({ block: 'start', behavior: 'smooth' });
				}
			};

			if (hasOutgoing) {
				window.setTimeout(performScroll, 240);
			} else {
				performScroll();
			}
		});

		return () => {
			cancelled = true;
		};
	});

	// Selection state management
	let selectedProofIds = $state<Set<string>>(new Set());

	// Derived state for "select all" checkbox
	let isAllSelected = $derived(
		proofStore.allProofs.length > 0 && 
		selectedProofIds.size === proofStore.allProofs.length
	);

	let isIndeterminate = $derived(
		selectedProofIds.size > 0 && 
		selectedProofIds.size < proofStore.allProofs.length
	);

	// Delete confirmation dialog state
	let deleteDialogOpen = $state(false);
	let proofToDelete = $state<Proof | null>(null);
	let proofsToDelete = $state<Proof[]>([]);
	let isBatchDelete = $state(false);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString();
	}

	function toggleSelectAll() {
		if (isAllSelected) {
			selectedProofIds = new Set();
		} else {
			selectedProofIds = new Set(proofStore.allProofs.map(p => p.id));
		}
	}

	function toggleSelectProof(proofId: string) {
		const newSet = new Set(selectedProofIds);
		if (newSet.has(proofId)) {
			newSet.delete(proofId);
		} else {
			newSet.add(proofId);
		}
		selectedProofIds = newSet;
	}

	function handleRowClick(proof: Proof, event: MouseEvent) {
		// Table is locked during an active withdraw - block selection changes
		// so the in-flight proof can't be swapped out mid-flow.
		if (disabled && proof.id !== selectedId) return;

		// Don't trigger if clicking on checkbox
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.closest('input[type="checkbox"]')) {
			return;
		}

		// Only trigger "use" for Ready (unused) proofs
		if (!proof.used && onselect) {
			// Clear all selections when using a proof
			selectedProofIds = new Set();
			onselect(proof);
		}
	}

	function handleBatchDownload() {
		const selectedProofs = proofStore.allProofs.filter(p => selectedProofIds.has(p.id));
		
		// Download each proof with a small delay to avoid browser blocking
		selectedProofs.forEach((proof, index) => {
			setTimeout(() => {
				proofStore.downloadProof(proof);
			}, index * 150);
		});

		// Show feedback
		console.log(`Downloaded ${selectedProofs.length} proofs`);
	}

	function handleBatchDeleteClick() {
		proofsToDelete = proofStore.allProofs.filter(p => selectedProofIds.has(p.id));
		isBatchDelete = true;
		deleteDialogOpen = true;
	}

	function handleSingleDeleteClick(proof: Proof) {
		proofToDelete = proof;
		isBatchDelete = false;
		deleteDialogOpen = true;
	}

	function handleDeleteConfirm() {
		if (isBatchDelete && proofsToDelete.length > 0) {
			// Batch delete
			proofsToDelete.forEach(proof => {
				proofStore.deleteProof(proof.id);
			});
			selectedProofIds = new Set();
			proofsToDelete = [];
		} else if (proofToDelete) {
			// Single delete
			proofStore.deleteProof(proofToDelete.id);
			proofToDelete = null;
		}
		
		isBatchDelete = false;
		deleteDialogOpen = false;
	}

	function handleDeleteCancel() {
		proofToDelete = null;
		proofsToDelete = [];
		isBatchDelete = false;
		deleteDialogOpen = false;
	}
</script>

<div class="md:h-full md:flex md:flex-col md:min-h-0">
{#if proofStore.allProofs.length === 0}
	<div class="text-center py-8 text-muted-foreground">
		No proofs found. Bridge some funds first!
	</div>
{:else}
	<!-- Batch Action Bar -->
	<div class="flex items-center justify-between mb-3 px-1 md:flex-none">
		<div class="text-sm text-muted-foreground">
			{#if selectedProofIds.size > 0}
				<span class="font-medium text-[var(--toad-green)]">{selectedProofIds.size}</span> selected
			{:else}
				<span class="text-xs opacity-60">Click Ready rows to use • Select for batch actions</span>
			{/if}
		</div>
		<div class="flex gap-2">
			<Button
				size="sm"
				disabled={selectedProofIds.size === 0}
				onclick={handleBatchDownload}
				class="h-8 text-xs border-transparent bg-[var(--warp-purple)] text-white hover:bg-[color-mix(in_oklab,var(--warp-purple)_90%,black)]"
			>
				<Download class="size-3.5" />
				Download {#if selectedProofIds.size > 0}({selectedProofIds.size}){/if}
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={selectedProofIds.size === 0 || disabled}
				onclick={handleBatchDeleteClick}
				class="h-8 text-xs"
			>
				<Trash2 class="size-3.5" />
				Delete {#if selectedProofIds.size > 0}({selectedProofIds.size}){/if}
			</Button>
		</div>
	</div>

	<!-- Proof Table -->
	<!--
		[&>div]:overflow-x-visible defeats the inner <Table> wrapper's
		auto-overflow so sticky thead resolves to THIS scroll container,
		not the inner one. Horizontal overflow still scrolls because the
		outer div has overflow-x-auto.
	-->
	<div bind:this={scrollContainer} class="rounded-sm border overflow-x-auto md:flex-1 md:min-h-0 md:overflow-y-auto [&>div]:overflow-x-visible">
		<Table>
			<TableHeader class="sticky top-0 bg-card z-20">
				<TableRow>
					<TableHead class="w-[36px] proof-select-col">
						<input
							type="checkbox"
							checked={isAllSelected}
							indeterminate={isIndeterminate}
							onchange={toggleSelectAll}
							class="checkbox-swamp"
							aria-label="Select all proofs"
						/>
					</TableHead>
					<TableHead>Proof ID</TableHead>
					<TableHead>Amount</TableHead>
					<TableHead>Token</TableHead>
					<TableHead>Route</TableHead>
					<TableHead>Date</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each proofStore.allProofs as proof (proof.id)}
					{@const isActive = proof.id === selectedId}
					{@const isLocked = disabled && !isActive}
					<TableRow
						class={[
							proof.used ? 'proof-row-used' : 'proof-row-ready',
							isActive ? 'proof-row-active' : '',
							isLocked ? 'proof-row-locked' : '',
						].filter(Boolean).join(' ')}
						onclick={(e) => handleRowClick(proof, e)}
						data-expanded={isActive && details ? 'true' : undefined}
					>
						<TableCell class="proof-select-col">
							<input
								type="checkbox"
								checked={selectedProofIds.has(proof.id)}
								disabled={isLocked}
								onclick={(e) => e.stopPropagation()}
								onchange={() => toggleSelectProof(proof.id)}
								class="checkbox-swamp"
								aria-label="Select proof {proof.id.slice(0, 8)}"
							/>
						</TableCell>
						<TableCell class="font-mono text-xs">
							{proof.id.slice(0, 8)}...
						</TableCell>
						<TableCell>{proof.amount}</TableCell>
						<TableCell>{proof.token}</TableCell>
						<TableCell class="text-xs">
							{proof.sourceChain} -> {proof.targetChain}
						</TableCell>
						<TableCell class="text-sm">
							{formatDate(proof.timestamp)}
						</TableCell>
						<TableCell>
							{#if proof.used}
								<Badge variant="secondary">Used</Badge>
							{:else}
								<Badge variant="default">Ready</Badge>
							{/if}
						</TableCell>
					</TableRow>
					{#if proof.id === selectedId && details}
						<TableRow class="proof-row-details">
							<TableCell colspan={7} class="!p-0 overflow-hidden">
								<div
									transition:slide={{ duration: 220, easing: cubicOut }}
									class="p-4 bg-[var(--swamp-deep)] border-t border-[rgba(130,226,102,0.2)] whitespace-normal space-y-3"
								>
									{@render details(proof)}
								</div>
							</TableCell>
						</TableRow>
					{/if}
				{/each}
			</TableBody>
		</Table>
	</div>
{/if}
</div>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={deleteDialogOpen}>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>
				{isBatchDelete ? `Delete ${proofsToDelete.length} Proofs` : 'Delete Proof'}
			</DialogTitle>
			<DialogDescription>
				Are you sure you want to delete {isBatchDelete ? 'these proofs' : 'this proof'}? This action cannot be undone.
			</DialogDescription>
		</DialogHeader>
		
		{#if isBatchDelete && proofsToDelete.length > 0}
			<div class="py-4 space-y-3 text-sm max-h-[300px] overflow-y-auto">
				{#each proofsToDelete.slice(0, 5) as proof}
					<div class="p-2 rounded bg-accent/30 space-y-1">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Proof ID:</span>
							<span class="font-mono text-xs">{proof.id.slice(0, 8)}...</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Amount:</span>
							<span>{proof.amount} {proof.token}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-muted-foreground">Route:</span>
							<span>{proof.sourceChain} -> {proof.targetChain}</span>
						</div>
					</div>
				{/each}
				{#if proofsToDelete.length > 5}
					<div class="text-center text-muted-foreground text-xs">
						and {proofsToDelete.length - 5} more...
					</div>
				{/if}
			</div>
		{:else if proofToDelete}
			<div class="py-4 space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">Proof ID:</span>
					<span class="font-mono">{proofToDelete.id.slice(0, 8)}...</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Amount:</span>
					<span>{proofToDelete.amount} {proofToDelete.token}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Route:</span>
					<span>{proofToDelete.sourceChain} -> {proofToDelete.targetChain}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">Status:</span>
					<span>{proofToDelete.used ? 'Used' : 'Ready'}</span>
				</div>
			</div>
		{/if}

		<DialogFooter>
			<Button variant="outline" onclick={handleDeleteCancel}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={handleDeleteConfirm}>
				Delete {isBatchDelete ? `(${proofsToDelete.length})` : ''}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	/* Clickable row styles for Ready proofs */
	:global(.proof-row-ready) {
		cursor: pointer;
		transition: background-color 0.2s ease, box-shadow 0.2s ease;
	}

	:global(.proof-row-ready:hover) {
		background-color: rgba(130, 226, 102, 0.08);
		box-shadow: inset 0 0 0 1px rgba(130, 226, 102, 0.2);
	}

	:global(.proof-row-ready:active) {
		background-color: rgba(130, 226, 102, 0.12);
	}

	/* Used rows - dimmed, not clickable */
	:global(.proof-row-used) {
		opacity: 0.65;
		cursor: default;
	}

	/* Locked rows - table is disabled (e.g. during an in-flight withdraw).
	 * Heavier dim than .proof-row-used and blocks hover affordances so users
	 * understand the row can't be selected right now. */
	:global(.proof-row-locked) {
		opacity: 0.35;
		cursor: not-allowed !important;
	}

	:global(.proof-row-locked:hover) {
		background-color: transparent !important;
		box-shadow: none !important;
	}

	/* Active row: the one currently loaded into the withdraw panel. Persists
	 * after click so the user can see at a glance which proof they're about to
	 * withdraw. Left-border accent + slightly stronger background than :hover. */
	:global(.proof-row-active) {
		background-color: rgba(130, 226, 102, 0.12) !important;
		box-shadow: inset 3px 0 0 var(--toad-green) !important;
	}

	:global(.proof-row-active:hover) {
		background-color: rgba(130, 226, 102, 0.16) !important;
	}

	/* Visually isolate the batch-select column from the row data, so users
	 * read the checkbox as a multi-select control rather than the
	 * "click-to-withdraw" affordance (which is the whole row). Tight gutter
	 * with symmetric spacing around the divider: ~8px between checkbox and
	 * divider, matches the next cell's px-2 on the other side. Checkbox is
	 * centered both axes within the gutter via display: table-cell's
	 * vertical-align + text-align on its inline content. */
	:global(.proof-select-col) {
		background-color: rgba(255, 255, 255, 0.02);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		padding-left: 0.5rem !important;
		padding-right: 0.5rem !important;
		text-align: center;
		vertical-align: middle;
	}

	/* The checkbox defaults to inline with baseline alignment, which leaves
	 * it riding low in cells with taller text. Force block + margin:auto so
	 * it centers regardless of sibling line-height. */
	:global(.proof-select-col .checkbox-swamp) {
		display: block;
		margin-left: auto;
		margin-right: auto;
	}

	/* Keep the active-row left accent, but make sure the gutter's tint
	 * doesn't fight the row's green highlight. */
	:global(.proof-row-active .proof-select-col) {
		background-color: rgba(130, 226, 102, 0.18);
	}

	/* Accordion detail row: rendered directly under the selected proof.
	 * Disable the row hover/cursor treatment inherited from proof-row-ready
	 * and let the inner padded container own the look. */
	:global(.proof-row-details) {
		cursor: default;
	}

	:global(.proof-row-details:hover) {
		background-color: transparent;
		box-shadow: none;
	}

	/* Touch-friendly checkbox styling */
	:global(.checkbox-swamp) {
		width: 20px;
		height: 20px;
		min-width: 20px;
		cursor: pointer;
		accent-color: var(--toad-green);
		transition: transform 0.1s ease;
	}

	/* Larger touch target on mobile */
	@media (max-width: 768px) {
		:global(.checkbox-swamp) {
			width: 24px;
			height: 24px;
			min-width: 24px;
		}
	}

	:global(.checkbox-swamp:hover) {
		transform: scale(1.1);
	}

	:global(.checkbox-swamp:focus) {
		outline: 2px solid var(--toad-green);
		outline-offset: 2px;
	}

	/* Indeterminate checkbox state */
	:global(.checkbox-swamp:indeterminate) {
		accent-color: var(--warp-purple);
	}
</style>
