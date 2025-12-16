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

	// Delete confirmation dialog state
	let deleteDialogOpen = $state(false);
	let proofToDelete = $state<Proof | null>(null);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString();
	}

	function handleSelect(proof: Proof) {
		if (onselect) {
			onselect(proof);
		}
	}

	function handleDownload(proof: Proof) {
		proofStore.downloadProof(proof);
	}

	function handleDeleteClick(proof: Proof) {
		proofToDelete = proof;
		deleteDialogOpen = true;
	}

	function handleDeleteConfirm() {
		if (proofToDelete) {
			proofStore.deleteProof(proofToDelete.id);
			proofToDelete = null;
			deleteDialogOpen = false;
		}
	}

	function handleDeleteCancel() {
		proofToDelete = null;
		deleteDialogOpen = false;
	}
</script>

{#if proofStore.allProofs.length === 0}
	<div class="text-center py-8 text-muted-foreground">
		No proofs found. Bridge some funds first!
	</div>
{:else}
	<div class="rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead class="w-[80px]"></TableHead>
					<TableHead>Proof ID</TableHead>
					<TableHead>Amount</TableHead>
					<TableHead>Token</TableHead>
					<TableHead>Route</TableHead>
					<TableHead>Date</TableHead>
					<TableHead>Status</TableHead>
					<TableHead class="text-right w-[80px]"></TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each proofStore.allProofs as proof (proof.id)}
					<TableRow>
						<TableCell>
							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									class="size-8"
									onclick={() => handleDownload(proof)}
									title="Download note"
								>
									<Download class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="size-8 text-destructive hover:text-destructive"
									onclick={() => handleDeleteClick(proof)}
									title="Delete proof"
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
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
						<TableCell class="text-right">
							{#if !proof.used}
								<Button 
									variant="outline" 
									size="sm"
									onclick={() => handleSelect(proof)}
								>
									Use
								</Button>
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
			<DialogTitle>Delete Proof</DialogTitle>
			<DialogDescription>
				Are you sure you want to delete this proof? This action cannot be undone.
			</DialogDescription>
		</DialogHeader>
		
		{#if proofToDelete}
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
				Delete
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
