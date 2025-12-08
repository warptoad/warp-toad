<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Upload, CheckCircle2 } from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import ProofTable from "./ProofTable.svelte";
	import type { Proof } from "$lib/types/bridge.js";

	let selectedProof = $state<Proof | null>(null);
	let fileInput: HTMLInputElement;
	let uploadError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	let isTargetConnected = $derived(
		selectedProof 
			? walletStore.isChainConnected(selectedProof.targetChain)
			: false
	);

	let canWithdraw = $derived(
		selectedProof !== null && 
		!selectedProof.used && 
		isTargetConnected
	);

	function handleProofSelect(proof: Proof) {
		selectedProof = proof;
		uploadError = null;
		successMessage = null;
	}

	function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			const parsed = proofStore.parseProofFile(content);
			
			if (!parsed) {
				uploadError = "Invalid proof file format";
				return;
			}

			const proof = proofStore.findProofByNote(parsed.note);
			if (!proof) {
				uploadError = "Proof not found in storage. Please ensure you bridged funds first.";
				return;
			}

			selectedProof = proof;
			uploadError = null;
			successMessage = null;
		};

		reader.readAsText(file);
	}

	function withdraw() {
		if (!selectedProof || !canWithdraw) return;

		proofStore.markProofAsUsed(selectedProof.id);
		successMessage = `Successfully withdrew ${selectedProof.amount} ${selectedProof.token}!`;
		selectedProof = null;
	}

	function triggerFileUpload() {
		fileInput?.click();
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Withdraw Funds</CardTitle>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- File Upload -->
		<div class="space-y-2">
			<Label>Upload Proof File</Label>
			<input
				bind:this={fileInput}
				type="file"
				accept=".txt"
				onchange={handleFileUpload}
				class="hidden"
			/>
			<Button variant="outline" onclick={triggerFileUpload} class="w-full">
				<Upload class="size-4 mr-2" />
				Upload Proof (.txt)
			</Button>
			{#if uploadError}
				<Alert variant="destructive">
					<AlertDescription>{uploadError}</AlertDescription>
				</Alert>
			{/if}
		</div>

		<div class="text-center text-sm text-muted-foreground">
			— or —
		</div>

		<!-- Proof Table -->
		<div class="space-y-2">
			<Label>Select from Saved Proofs</Label>
			<ProofTable onselect={handleProofSelect} />
		</div>

		{#if selectedProof}
			<Separator />

			<!-- Selected Proof Details -->
			<div class="space-y-4">
				<Label>Selected Proof</Label>
				<Card>
					<CardContent class="pt-6 space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Amount:</span>
							<span class="font-semibold">{selectedProof.amount} {selectedProof.token}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Route:</span>
							<span>{selectedProof.sourceChain} → {selectedProof.targetChain}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Target Wallet:</span>
							<span class="flex items-center gap-1">
								{#if isTargetConnected}
									<CheckCircle2 class="size-4 text-green-500" />
									<span class="text-green-500">Connected</span>
								{:else}
									<span class="text-destructive">Not Connected</span>
								{/if}
							</span>
						</div>
						{#if selectedProof.used}
							<Alert>
								<AlertDescription>
									This proof has already been used
								</AlertDescription>
							</Alert>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Validation Messages -->
			{#if !isTargetConnected}
				<Alert>
					<AlertDescription>
						Please connect your {selectedProof.targetChain} wallet to withdraw.
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Withdraw Button -->
			<Button 
				class="w-full" 
				disabled={!canWithdraw}
				onclick={withdraw}
			>
				Withdraw Funds
			</Button>
		{/if}

		<!-- Success Message -->
		{#if successMessage}
			<Alert>
				<AlertDescription class="flex items-center gap-2">
					<CheckCircle2 class="size-4 text-green-500" />
					<span>{successMessage}</span>
				</AlertDescription>
			</Alert>
		{/if}
	</CardContent>
</Card>
