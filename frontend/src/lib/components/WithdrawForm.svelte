<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Upload, CheckCircle2, Loader2 } from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import ProofTable from "./ProofTable.svelte";
	import type { Proof } from "$lib/types/bridge.js";
	import { getWalletInstance } from "$lib/utils/aztec-wallet.js";
	import { 
		mintFromEVM, 
		validateCommitmentExists, 
		getAztecGigaRoot,
		hashPreCommitment,
		hashCommitment,
		isNoteUsed
	} from "$lib/utils/aztec-interactions.js";
	import { decodeNote } from "$lib/utils/evm-interactions.js";

	let selectedProof = $state<Proof | null>(null);
	let fileInput: HTMLInputElement;
	let uploadError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isWithdrawing = $state(false);
	let isCheckingNullifier = $state(false);
	let withdrawStep = $state<'idle' | 'validating' | 'checking-bridge' | 'building-proofs' | 'minting' | 'complete'>('idle');
	let withdrawMessage = $state('');

	// Source chain ID - defaults to localhost (anvil)
	// In production, this should be detected from the proof/note
	const SOURCE_CHAIN_ID = import.meta.env.VITE_SOURCE_CHAIN_ID 
		? parseInt(import.meta.env.VITE_SOURCE_CHAIN_ID) 
		: 31337;

	// Map chain IDs to chain names
	function getChainNameFromId(chainId: bigint): 'Ethereum' | 'Scroll' | 'Aztec' {
		const id = Number(chainId);
		// Standard EVM chain IDs
		if (id === 1 || id === 31337 || id === 11155111) {
			return 'Ethereum'; // Mainnet, Anvil/localhost, or Sepolia
		}
		if (id === 534351 || id === 534352) {
			return 'Scroll'; // Scroll Sepolia or Mainnet
		}
		// If it's a large number (Aztec uses poseidon2 hash as chain ID), assume Aztec
		// Aztec chain IDs are typically very large numbers from poseidon2([salt, version])
		if (chainId > 1000000n) {
			return 'Aztec';
		}
		// Default to Ethereum for unknown chains
		return 'Ethereum';
	}

	let isTargetConnected = $derived(
		selectedProof 
			? walletStore.isChainConnected(selectedProof.targetChain)
			: false
	);

	let canWithdraw = $derived(
		selectedProof !== null && 
		!selectedProof.used && 
		isTargetConnected &&
		!isWithdrawing
	);

	function handleProofSelect(proof: Proof) {
		selectedProof = proof;
		uploadError = null;
		successMessage = null;
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (!file) return;

		// Read file content
		const content = await file.text();
		const parsed = proofStore.parseProofFile(content);
		
		if (!parsed) {
			uploadError = "Invalid proof file format";
			return;
		}

		// First check if proof exists in local storage
		let proof = proofStore.findProofByNote(parsed.note);
		let noteData: ReturnType<typeof decodeNote> | null = null;
		
		if (!proof) {
			// Try to decode the note and create a new proof entry
			try {
				noteData = decodeNote(parsed.note);
				
				// Infer source and target chains from the note data
				const sourceChain = getChainNameFromId(noteData.sourceChainId);
				const targetChain = getChainNameFromId(noteData.destination_chain_id);
				
				// Use 6 decimals for now (USDC standard)
				// TODO: could fetch from contract based on token
				const decimals = 6;
				const formattedAmount = (Number(noteData.amount) / 10 ** decimals).toString();
				
				// Create a new proof from the decoded note
				proof = proofStore.addProof(
					formattedAmount,
					'USDC', // Default token - could be improved to detect from note
					sourceChain,
					targetChain,
					parsed.note,
					{
						amount: noteData.amount,
						destination_chain_id: noteData.destination_chain_id,
						secret: noteData.secret,
						nullifier_preimg: noteData.nullifier_preimg,
					},
					noteData.preCommitment.toString(),
					noteData.commitment.toString()
				);
				
				console.log(`Imported proof: ${sourceChain} -> ${targetChain}, amount: ${formattedAmount}`);
			} catch (decodeError) {
				console.error('Failed to decode note:', decodeError);
				uploadError = "Could not decode note. Please ensure you bridged funds first.";
				return;
			}
		}

		// Check if the note has already been used on Aztec (nullifier check)
		// Only check if targeting Aztec and not already marked as used
		if (proof && proof.targetChain === 'Aztec' && !proof.used) {
			const nullifierPreimg = proof.commitmentData?.nullifier_preimg || noteData?.nullifier_preimg;
			
			if (nullifierPreimg) {
				isCheckingNullifier = true;
				uploadError = null;
				// Force Svelte to see the state change
				await new Promise(resolve => setTimeout(resolve, 0));
				
				const result = await isNoteUsed(nullifierPreimg);
				
				isCheckingNullifier = false;
				
				if (!result.success) {
					// Could not connect to Aztec node - show warning but allow user to proceed
					uploadError = result.error || 'Could not verify note status. Aztec node may be unavailable.';
					// Don't return - let user see the proof and try to withdraw anyway
				} else if (result.isSpent) {
					// Nullifier is spent - mark as used
					proofStore.markProofAsUsed(proof.id);
					proof = { ...proof, used: true };
					successMessage = null;
					uploadError = "This note has already been withdrawn on Aztec.";
				}
			}
		}

		selectedProof = proof;
		if (!uploadError) {
			uploadError = null;
		}
		if (!proof?.used) {
			successMessage = null;
		}
	}

	async function withdraw() {
		if (!selectedProof || !canWithdraw) return;

		isWithdrawing = true;
		uploadError = null;
		successMessage = null;

		try {
			// Step 1: Validate commitment data exists
			withdrawStep = 'validating';
			withdrawMessage = 'Validating commitment data...';
			
			if (!selectedProof.commitmentData) {
				throw new Error('Proof missing commitment data. Please re-bridge or upload a valid note file.');
			}

			// Calculate commitment hash
			const preCommitment = hashPreCommitment(
				selectedProof.commitmentData.nullifier_preimg,
				selectedProof.commitmentData.secret,
				selectedProof.commitmentData.destination_chain_id
			);
			const commitment = hashCommitment(preCommitment, selectedProof.commitmentData.amount);
			
			console.log('Validating commitment:', commitment.toString());
			
			// Validate commitment exists on L1
			withdrawMessage = 'Checking commitment on L1...';
			const exists = await validateCommitmentExists(commitment, SOURCE_CHAIN_ID);
			if (!exists) {
				throw new Error(
					'Commitment not found on source chain. ' +
					'Please ensure the burn transaction completed successfully.'
				);
			}

			// Step 2: Get Aztec wallet
			const aztecWallet = getWalletInstance();
			if (!aztecWallet) {
				throw new Error('Aztec wallet not connected. Please connect your Azguard wallet.');
			}

			// Step 3: Check if GigaRoot has been synced to Aztec and get its value
			withdrawStep = 'checking-bridge';
			withdrawMessage = 'Checking bridge sync status...';
			
			const gigaRoot = await getAztecGigaRoot(aztecWallet);
			if (gigaRoot === null) {
				throw new Error(
					'GigaRoot has not been synced to Aztec yet. ' +
					'Please wait for the bridge relayer to sync the root, or trigger a bridge sync manually.'
				);
			}
			console.log('GigaRoot from Aztec:', gigaRoot.toString());

			// Get recipient address from connected wallet
			const accounts = await aztecWallet.getAccounts();
			if (!accounts || accounts.length === 0) {
				throw new Error('No Aztec accounts found. Please ensure your wallet is properly connected.');
			}
			const recipientAddress = accounts[0].item.toString();
			console.log('Recipient address:', recipientAddress);

			// Step 4: Build merkle proofs
			withdrawStep = 'building-proofs';
			withdrawMessage = 'Building merkle proofs (this may take a moment)...';

			// Step 5: Call mint on Aztec
			withdrawStep = 'minting';
			withdrawMessage = 'Minting tokens on Aztec...';
			
			const txHash = await mintFromEVM(
				aztecWallet,
				selectedProof.commitmentData,
				SOURCE_CHAIN_ID,
				recipientAddress,
				gigaRoot
			);

			// Step 6: Complete
			withdrawStep = 'complete';
			withdrawMessage = 'Withdraw complete!';
			
			proofStore.markProofAsUsed(selectedProof.id);
			successMessage = `Successfully withdrew ${selectedProof.amount} ${selectedProof.token}! Tx: ${txHash.slice(0, 16)}...`;
			
			// Reset after delay
			setTimeout(() => {
				selectedProof = null;
				isWithdrawing = false;
				withdrawStep = 'idle';
				withdrawMessage = '';
			}, 5000);

		} catch (error) {
			console.error('Withdraw error:', error);
			
			// Provide more helpful error messages
			let errorMessage = 'Withdraw failed';
			if (error instanceof Error) {
				errorMessage = error.message;
				
				// Add hints for common errors
				if (errorMessage.includes('VITE_AZTEC_WARPTOAD_ADDRESS')) {
					errorMessage += '\n\nHint: Set VITE_AZTEC_WARPTOAD_ADDRESS in your .env file.';
				} else if (errorMessage.includes('connect to Aztec')) {
					errorMessage += '\n\nHint: Make sure the Aztec sandbox is running (aztec start --sandbox).';
				} else if (errorMessage.includes('not found in burn events')) {
					errorMessage += '\n\nHint: The commitment may not have been bridged yet. Wait for the next bridge sync.';
				}
			}
			
			uploadError = errorMessage;
			isWithdrawing = false;
			withdrawStep = 'idle';
			withdrawMessage = '';
		}
	}

	function triggerFileUpload() {
		fileInput?.click();
	}

	function getStepNumber(step: typeof withdrawStep): string {
		switch (step) {
			case 'validating': return '1/5';
			case 'checking-bridge': return '2/5';
			case 'building-proofs': return '3/5';
			case 'minting': return '4/5';
			case 'complete': return '5/5';
			default: return '';
		}
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
		<Button variant="outline" onclick={triggerFileUpload} class="w-full" disabled={isCheckingNullifier}>
			{#if isCheckingNullifier}
				<Loader2 class="size-4 mr-2 animate-spin" />
				Checking note status...
			{:else}
				<Upload class="size-4 mr-2" />
				Upload Proof (.txt)
			{/if}
		</Button>
		{#if uploadError}
			<Alert variant="destructive">
				<AlertDescription class="whitespace-pre-wrap">{uploadError}</AlertDescription>
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
							<span class="text-muted-foreground">Source Chain ID:</span>
							<span>{SOURCE_CHAIN_ID}</span>
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
						{#if selectedProof.commitmentData}
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Has Commitment:</span>
								<CheckCircle2 class="size-4 text-green-500" />
							</div>
						{:else}
							<Alert variant="destructive">
								<AlertDescription>
									Missing commitment data. Upload note file to restore.
								</AlertDescription>
							</Alert>
						{/if}
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
						{#if selectedProof.targetChain === 'Aztec'}
							<br /><span class="text-xs text-muted-foreground">Use the Azguard wallet extension.</span>
						{/if}
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Withdraw Progress -->
			{#if isWithdrawing}
				<Alert>
					<AlertDescription class="flex items-center gap-2">
						{#if withdrawStep === 'complete'}
							<CheckCircle2 class="size-4 text-green-500" />
						{:else}
							<Loader2 class="size-4 animate-spin" />
						{/if}
						<div class="flex-1">
							<div>{withdrawMessage}</div>
							{#if withdrawStep !== 'idle' && withdrawStep !== 'complete'}
								<div class="text-xs text-muted-foreground mt-1">
									Step {getStepNumber(withdrawStep)}: {withdrawStep.replace('-', ' ')}
								</div>
							{/if}
						</div>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Withdraw Button -->
			<Button 
				class="w-full" 
				disabled={!canWithdraw}
				onclick={withdraw}
			>
				{isWithdrawing ? 'Processing...' : 'Withdraw to Aztec'}
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
