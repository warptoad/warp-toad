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

	interface Props {
		onselect?: (proof: Proof) => void;
	}

	let { onselect }: Props = $props();

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

{#if proofStore.allProofs.length === 0}
	<div class="text-center py-8 text-muted-foreground">
		No proofs found. Bridge some funds first!
	</div>
{:else}
	<!-- Batch Action Bar -->
	<div class="flex items-center justify-between mb-3 px-1">
		<div class="text-sm text-muted-foreground">
			{#if selectedProofIds.size > 0}
				<span class="font-medium text-[var(--toad-green)]">{selectedProofIds.size}</span> selected
			{:else}
				<span class="text-xs opacity-60">Click Ready rows to use • Select for batch actions</span>
			{/if}
		</div>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={selectedProofIds.size === 0}
				onclick={handleBatchDownload}
				class="h-8 text-xs"
			>
				<Download class="size-3.5 mr-1.5" />
				Download {#if selectedProofIds.size > 0}({selectedProofIds.size}){/if}
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={selectedProofIds.size === 0}
				onclick={handleBatchDeleteClick}
				class="h-8 text-xs"
			>
				<Trash2 class="size-3.5 mr-1.5" />
				Delete {#if selectedProofIds.size > 0}({selectedProofIds.size}){/if}
			</Button>
		</div>
	</div>

	<!-- Proof Table -->
	<div class="rounded-md border overflow-x-auto">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead class="w-[50px]">
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
					<TableRow 
						class={proof.used ? 'proof-row-used' : 'proof-row-ready'}
						onclick={(e) => handleRowClick(proof, e)}
					>
						<TableCell>
							<input 
								type="checkbox" 
								checked={selectedProofIds.has(proof.id)}
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
				{/each}
			</TableBody>
		</Table>
	</div>
{/if}

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
