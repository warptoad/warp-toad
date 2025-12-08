<script lang="ts">
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import type { Proof } from "$lib/types/bridge.js";

	interface Props {
		onselect?: (proof: Proof) => void;
	}

	let { onselect }: Props = $props();

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString();
	}

	function handleSelect(proof: Proof) {
		if (onselect) {
			onselect(proof);
		}
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
					<TableHead>Proof ID</TableHead>
					<TableHead>Amount</TableHead>
					<TableHead>Token</TableHead>
					<TableHead>Route</TableHead>
					<TableHead>Date</TableHead>
					<TableHead>Status</TableHead>
					<TableHead class="text-right">Action</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each proofStore.allProofs as proof (proof.id)}
					<TableRow>
						<TableCell class="font-mono text-xs">
							{proof.id.slice(0, 8)}...
						</TableCell>
						<TableCell>{proof.amount}</TableCell>
						<TableCell>{proof.token}</TableCell>
						<TableCell class="text-xs">
							{proof.sourceChain} → {proof.targetChain}
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
							{:else}
								<span class="text-muted-foreground text-sm">—</span>
							{/if}
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>
{/if}
