<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Upload, CheckCircle2, Loader2 } from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import ProofTable from "./ProofTable.svelte";
	import type { Proof } from "$lib/types/bridge.js";
	import { getWalletInstance } from "$lib/utils/aztec-wallet.js";
	import {
		mintFromEVM,
		validateCommitmentExists,
		getAztecGigaRoot,
		hashPreCommitment,
		hashCommitment,
		isNoteUsed,
		getAztecMerkleData,
		getMerkleData as getEvmMerkleData,
		getEmptyAztecMerkleData,
		getEmptyEvmMerkleData,
		getMerkleDataForAztecToL1,
	} from "$lib/utils/aztec-interactions.js";
	import {
		getL1GigaRoot,
		getL1LocalRoot,
		claimFromAztec,
		claimAndUnwrapFromAztec,
		claimOnL1,
		claimAndUnwrapOnL1,
		getEvmMerkleDataForL1,
		isValidL1LocalRoot,
		storeL1LocalRootInHistory,
		decodeNote,
	} from "$lib/utils/evm-interactions.js";
	import {
		getScrollGigaRoot,
		getScrollLocalRoot,
		claimOnScroll,
		isValidScrollLocalRoot,
		storeScrollLocalRootInHistory,
		getScrollChainId,
	} from "$lib/utils/scroll-interactions.js";
	import {
		prepareProofInputsForAztecToL1,
		prepareProofInputsForSameChain,
		generateWithdrawProof,
		formatProofForL1,
		type FeeConfig,
	} from "$lib/utils/proof-generation.js";

	import { getChainId as getEvmChainId } from "$lib/utils/evm-wallet.js";
	import {
		getEVMChain,
		getTokenConfig,
		isChainEnabled,
	} from "$lib/config/chains.js";

	import {
		getRelayerInfo,
		submitWithdrawRelay,
		pollRelayStatus,
		isRelayServiceAvailable,
		type RelayerInfo,
		type RelayStatus,
	} from "$lib/utils/relay-client.js";

	import { onMount } from "svelte";
    import { toHex } from "viem";

	let selectedProof = $state<Proof | null>(null);
	let fileInput: HTMLInputElement;
	let uploadError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isWithdrawing = $state(false);
	let isCheckingNullifier = $state(false);
	let withdrawStep = $state<
		| "idle"
		| "validating"
		| "checking-bridge"
		| "building-proofs"
		| "generating-proof"
		| "minting"
		| "unwrapping"
		| "complete"
	>("idle");
	let withdrawMessage = $state("");

	// Auto-unwrap toggle (default ON) - only shown for Aztec -> L1 flow
	let autoUnwrap = $state(true);

	// Relay service state
	let useRelay = $state(false);
	let relayServiceAvailable = $state(false);
	let relayerInfo = $state<RelayerInfo | null>(null);
	let feePercentage = $state(0.25); // Min 0.25%, max 5%
	let relayOperationId = $state<string | null>(null);
	let relayStatusText = $state<string>("idle");

	// Get source chain ID dynamically based on source chain
	function getSourceChainId(): number {
		const ethereumChain = getEVMChain("Ethereum");
		return ethereumChain?.chainId ?? 31337;
	}

	// Map chain IDs to chain names
	function getChainNameFromId(
		chainId: bigint,
	): "Ethereum" | "Scroll" | "Aztec" {
		const id = Number(chainId);
		// Standard EVM chain IDs
		if (id === 1 || id === 31337 || id === 11155111) {
			return "Ethereum"; // Mainnet, Anvil/localhost, or Sepolia
		}
		if (id === 534351 || id === 534352) {
			return "Scroll"; // Scroll Sepolia or Mainnet
		}
		// If it's a large number (Aztec uses poseidon2 hash as chain ID), assume Aztec
		// Aztec chain IDs are typically very large numbers from poseidon2([salt, version])
		if (chainId > 1000000n) {
			return "Aztec";
		}
		// Default to Ethereum for unknown chains
		return "Ethereum";
	}

	let isTargetConnected = $derived(
		selectedProof
			? walletStore.isChainConnected(selectedProof.targetChain)
			: false,
	);

	let isOnCorrectNetwork = $derived(
		selectedProof
			? walletStore.isOnCorrectNetwork(selectedProof.targetChain)
			: false,
	);

	let needsNetworkSwitch = $derived(
		selectedProof !== null &&
			isTargetConnected &&
			!isOnCorrectNetwork,
	);

	let canWithdraw = $derived(
		selectedProof !== null &&
			!selectedProof.used &&
			isTargetConnected &&
			isOnCorrectNetwork &&
			!isWithdrawing,
	);

	function handleProofSelect(proof: Proof) {
		selectedProof = proof;
		uploadError = null;
		successMessage = null;
	}

	async function switchToTargetNetwork() {
		if (!selectedProof) return;
		
		try {
			await walletStore.switchToChain(selectedProof.targetChain);
			// After switching, the button will automatically change to "Withdraw"
			// due to reactive updates
		} catch (error) {
			console.error("Network switch error:", error);
			uploadError = error instanceof Error 
				? `Failed to switch network: ${error.message}` 
				: "Failed to switch network";
		}
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
				const targetChain = getChainNameFromId(
					noteData.destination_chain_id,
				);

				// Use 6 decimals for now (USDC standard)
				// TODO: could fetch from contract based on token
				const decimals = 6;
				const formattedAmount = (
					Number(noteData.amount) /
					10 ** decimals
				).toString();

				// Create a new proof from the decoded note
				proof = proofStore.addProof(
					formattedAmount,
					"USDC", // Default token - could be improved to detect from note
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
					noteData.commitment.toString(),
				);

				console.log(
					`Imported proof: ${sourceChain} -> ${targetChain}, amount: ${formattedAmount}`,
				);
			} catch (decodeError) {
				console.error("Failed to decode note:", decodeError);
				uploadError =
					"Could not decode note. Please ensure you bridged funds first.";
				return;
			}
		}

		// Check if the note has already been used on Aztec (nullifier check)
		// Only check if targeting Aztec and not already marked as used
		if (proof && proof.targetChain === "Aztec" && !proof.used) {
			const nullifierPreimg =
				proof.commitmentData?.nullifier_preimg ||
				noteData?.nullifier_preimg;

			if (nullifierPreimg) {
				isCheckingNullifier = true;
				uploadError = null;
				// Force Svelte to see the state change
				await new Promise((resolve) => setTimeout(resolve, 0));

				const result = await isNoteUsed(nullifierPreimg);

				isCheckingNullifier = false;

				if (!result.success) {
					// Could not connect to Aztec node - show warning but allow user to proceed
					uploadError =
						result.error ||
						"Could not verify note status. Aztec node may be unavailable.";
					// Don't return - let user see the proof and try to withdraw anyway
				} else if (result.isSpent) {
					// Nullifier is spent - mark as used
					proofStore.markProofAsUsed(proof.id);
					proof = { ...proof, used: true };
					successMessage = null;
					uploadError =
						"This note has already been withdrawn on Aztec.";
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

	// Check relay service availability on mount
	onMount(async () => {
		try {
			relayServiceAvailable = await isRelayServiceAvailable();
			if (relayServiceAvailable) {
				relayerInfo = await getRelayerInfo();
				console.log("Relay service available:", relayerInfo);
			} else {
				console.warn(
					"Relay service not available - using self-relay only",
				);
			}
		} catch (error) {
			console.warn("Failed to connect to relay service:", error);
			relayServiceAvailable = false;
		}
	});

	function getTokenDecimals(): number {
		if (!selectedProof) return 1e6;
		const tokenConfig = getTokenConfig(selectedProof.token);
		const decimals = tokenConfig?.decimals ?? 6;
		return 10 ** decimals;
	}

	// Calculate estimated fee amount in tokens
	function calculateEstimatedFee(): string {
		if (!selectedProof?.commitmentData?.amount) return "0";

		const amount = BigInt(selectedProof.commitmentData.amount);
		const feeAmount =
			(amount * BigInt(Math.floor(feePercentage * 100))) / 10000n;

		const decimals = getTokenDecimals();

		const formattedFee = Number(feeAmount) / decimals;
		return formattedFee.toFixed(6);
	}

	// Calculate net amount recipient receives
	function calculateNetAmount(): string {
		if (!selectedProof?.commitmentData?.amount) return "0";

		const amount = BigInt(selectedProof.commitmentData.amount);
		const feeAmount =
			(amount * BigInt(Math.floor(feePercentage * 100))) / 10000n;
		const netAmount = amount - feeAmount;

		const decimals = getTokenDecimals();
		const formatted = Number(netAmount) / decimals;
		return formatted.toFixed(6);
	}

	/**
	 * Add wrapped token to user's wallet (MetaMask)
	 */
	async function addWrappedTokenToWallet() {
		try {
			const eth = (window as any).ethereum;
			if (!eth) {
				alert('MetaMask not found. Please install MetaMask to add tokens.');
				return;
			}

			const chainId = await getEvmChainId();
			if (!chainId) {
				alert('Please connect your wallet first');
				return;
			}

			const chain = getEVMChain('Ethereum') || getEVMChain('Scroll');
			if (!chain) {
				alert('Chain configuration not found');
				return;
			}

			const tokenConfig = getTokenConfig(selectedProof?.token || 'USDC');
			const wrappedTokenAddress = chain.contracts.warpToad;
			const decimals = tokenConfig?.decimals ?? 6;
			const symbol = `wrptd-${selectedProof?.token || 'USDC'}`;

			// Request to add token to MetaMask using EIP-747
			await eth.request({
				method: 'wallet_watchAsset',
				params: {
					type: 'ERC20',
					options: {
						address: wrappedTokenAddress,
						symbol: symbol,
						decimals: decimals,
					},
				} as any,
			});

			console.log('Token import requested');
		} catch (error) {
			console.error('Failed to add token to wallet:', error);
		}
	}

	/**
	 * Main withdraw function - routes to appropriate handler based on flow
	 */
	async function withdraw() {
		if (!selectedProof || !canWithdraw) return;

		isWithdrawing = true;
		uploadError = null;
		successMessage = null;

		try {
			// Route based on source and target chain combination
			const { sourceChain, targetChain } = selectedProof;

			// Check for same-chain transfer first
			if (sourceChain === targetChain) {
				// Same-chain private transfer (L1 -> L1 or Scroll -> Scroll)
				if (sourceChain === "Ethereum") {
					await withdrawSameChainL1();
				} else if (sourceChain === "Scroll") {
					await withdrawSameChainScroll();
				} else {
					throw new Error(
						"Same-chain transfers are only supported on EVM chains (Ethereum, Scroll)",
					);
				}
			} else if (sourceChain === "Aztec") {
				// Aztec -> EVM (L1 or Scroll)
				if (targetChain === "Scroll") {
					await withdrawToScroll();
				} else {
					// Aztec -> Ethereum L1
					await withdrawToL1();
				}
			} else if (sourceChain === "Scroll") {
				// Scroll -> Aztec or L1
				if (targetChain === "Aztec") {
					await withdrawToAztec();
				} else {
					// Scroll -> L1 (requires ZK proof)
					await withdrawFromScrollToL1();
				}
			} else {
				// Ethereum L1 -> Aztec or Scroll
				if (targetChain === "Aztec") {
					await withdrawToAztec();
				} else if (targetChain === "Scroll") {
					await withdrawToScroll();
				}
			}
		} catch (error) {
			console.error("Withdraw error:", error);

			let errorMessage = "Withdraw failed";
			if (error instanceof Error) {
				errorMessage = error.message;

				// Add hints for common errors
				if (errorMessage.includes("connect to Aztec")) {
					errorMessage +=
						"\n\nHint: Make sure the Aztec sandbox is running (aztec start --sandbox).";
				} else if (errorMessage.includes("not found in burn events")) {
					errorMessage +=
						"\n\nHint: The commitment may not have been bridged yet. Wait for the next bridge sync.";
				} else if (errorMessage.includes("proof generation")) {
					errorMessage +=
						"\n\nHint: ZK proof generation can take 30-60 seconds. Please be patient.";
				}
			}

			uploadError = errorMessage;
			isWithdrawing = false;
			withdrawStep = "idle";
			withdrawMessage = "";
		}
	}

	/**
	 * Withdraw from EVM (L1/L2) to Aztec
	 */
	async function withdrawToAztec() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data exists
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		// Calculate commitment hash
		const preCommitment = hashPreCommitment(
			selectedProof.commitmentData.nullifier_preimg,
			selectedProof.commitmentData.secret,
			selectedProof.commitmentData.destination_chain_id,
		);
		const commitment = hashCommitment(
			preCommitment,
			selectedProof.commitmentData.amount,
		);

		console.log("Validating commitment:", commitment.toString());

		// Validate commitment exists on L1
		withdrawMessage = "Checking commitment on L1...";
		const exists = await validateCommitmentExists(
			commitment,
			getSourceChainId(),
		);
		if (!exists) {
			throw new Error(
				"Commitment not found on source chain. " +
					"Please ensure the burn transaction completed successfully.",
			);
		}

		// Step 2: Get Aztec wallet
		const aztecWallet = getWalletInstance();
		if (!aztecWallet) {
			throw new Error(
				"Aztec wallet not connected. Please connect your Azguard wallet.",
			);
		}

		// Step 3: Check if GigaRoot has been synced to Aztec and get its value
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking bridge sync status...";

		const gigaRoot = await getAztecGigaRoot(aztecWallet);
		if (gigaRoot === null) {
			throw new Error(
				"GigaRoot has not been synced to Aztec yet. " +
					"Please wait for the bridge relayer to sync the root, or trigger a bridge sync manually.",
			);
		}
		console.log("GigaRoot from Aztec:", gigaRoot.toString());

		// Get recipient address from connected wallet
		const accounts = await aztecWallet.getAccounts();
		if (!accounts || accounts.length === 0) {
			throw new Error(
				"No Aztec accounts found. Please ensure your wallet is properly connected.",
			);
		}
		const recipientAddress = accounts[0].item.toString();
		console.log("Recipient address:", recipientAddress);

		// Step 4: Build merkle proofs
		withdrawStep = "building-proofs";
		withdrawMessage = "Building merkle proofs (this may take a moment)...";

		// Step 5: Call mint on Aztec
		withdrawStep = "minting";
		withdrawMessage = "Minting tokens on Aztec...";

		const txHash = await mintFromEVM(
			aztecWallet,
			selectedProof.commitmentData,
			getSourceChainId(),
			recipientAddress,
			gigaRoot,
		);

		// Step 6: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdraw complete!";

		proofStore.markProofAsUsed(selectedProof.id);
		successMessage = `Successfully withdrew ${selectedProof.amount} ${selectedProof.token}! Tx: ${txHash.slice(0, 16)}...`;

		// Refresh balances after successful withdraw
		await balanceStore.refresh();

		// Reset after delay
		setTimeout(() => {
			selectedProof = null;
			isWithdrawing = false;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from Aztec to Scroll L2
	 * This generates a ZK proof and calls the L2WarpToad.mint() on Scroll
	 */
	async function withdrawToScroll() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Route based on source chain
		if (selectedProof.sourceChain === "Ethereum") {
			// L1 -> Scroll flow
			await withdrawFromL1ToScroll();
			return;
		} else if (selectedProof.sourceChain !== "Aztec") {
			throw new Error(
				`Unsupported source chain for Scroll withdrawal: ${selectedProof.sourceChain}`,
			);
		}
		
		// Continue with Aztec -> Scroll flow below...

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get Scroll chain state
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking Scroll bridge state...";

		const scrollChain = getEVMChain("Scroll");
		if (!scrollChain || !scrollChain.enabled) {
			throw new Error(
				"Scroll is not available in the current environment",
			);
		}

		const chainId = await getEvmChainId();
		if (!chainId || chainId !== scrollChain.chainId) {
			throw new Error(
				`Please switch to Scroll Sepolia network (chain ID: ${scrollChain.chainId})`,
			);
		}

		const gigaRoot = await getScrollGigaRoot();
		console.log("Scroll GigaRoot:", gigaRoot.toString());

		const localRoot = await getScrollLocalRoot();
		console.log("Scroll LocalRoot:", localRoot.toString());

		// Step 3: Get Aztec merkle data
		withdrawStep = "building-proofs";
		withdrawMessage = "Getting Aztec merkle data...";

		const aztecWallet = getWalletInstance();
		if (!aztecWallet) {
			throw new Error(
				"Aztec wallet not connected. Please connect your Azguard wallet.",
			);
		}

		// Get the Aztec local root from GigaBridge on L1
		// Note: GigaBridge lives on L1, so we query L1 even though destination is Scroll
		const l1Chain = getEVMChain("Ethereum");
		if (!l1Chain) throw new Error("Ethereum chain config not found");
		
		const { aztecLocalRoot, aztecLocalRootBlockNumber, gigaMerkleData } =
			await getMerkleDataForAztecToL1(l1Chain.chainId, gigaRoot);

		const aztecMerkleData = await getAztecMerkleData(
			aztecWallet,
			commitment,
			aztecLocalRootBlockNumber,
		);

		console.log("Aztec merkle data:", aztecMerkleData);
		console.log("Origin local root (Aztec):", aztecLocalRoot.toString());

		// Step 4: Prepare proof inputs
		withdrawMessage = "Preparing proof inputs...";

		const proofInputs = prepareProofInputsForAztecToL1(
			selectedProof.commitmentData,
			aztecMerkleData,
			gigaMerkleData,
			gigaRoot,
			localRoot, // destination local root (Scroll)
			aztecLocalRoot, // origin local root (Aztec)
			BigInt(scrollChain.chainId),
			walletStore.wallets.evm ||
				"0x0000000000000000000000000000000000000000",
		);
		console.log("Proof inputs prepared");

		// Step 5: Generate ZK proof
		withdrawStep = "generating-proof";
		withdrawMessage =
			"Generating ZK proof (this may take 30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => {
				withdrawMessage = msg;
			},
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 6: Claim on Scroll
		withdrawStep = "minting";
		withdrawMessage = "Minting wrapped tokens on Scroll L2...";

		const result = await claimOnScroll(proofInputs, proofHex);
		const mintTxHash = result.txHash;

		// Step 7: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdraw to Scroll complete!";

		proofStore.markProofAsUsed(selectedProof.id);
		successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token} to Scroll! Tx: ${mintTxHash.slice(0, 10)}...`;

		// Refresh balances
		await balanceStore.refresh();

		// Reset after delay
		setTimeout(() => {
			selectedProof = null;
			isWithdrawing = false;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from L1 to Scroll L2
	 * This generates a ZK proof and calls the L2WarpToad.mint() on Scroll
	 */
	async function withdrawFromL1ToScroll() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get Scroll chain state
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking Scroll bridge state...";

		const scrollChain = getEVMChain("Scroll");
		if (!scrollChain || !scrollChain.enabled) {
			throw new Error(
				"Scroll is not available in the current environment",
			);
		}

		const chainId = await getEvmChainId();
		if (!chainId || chainId !== scrollChain.chainId) {
			throw new Error(
				`Please switch to Scroll Sepolia network (chain ID: ${scrollChain.chainId})`,
			);
		}

		const gigaRoot = await getScrollGigaRoot();
		console.log("Scroll GigaRoot:", gigaRoot.toString());

		const localRoot = await getScrollLocalRoot();
		console.log("Scroll LocalRoot:", localRoot.toString());

		// Step 3: Get L1 merkle data (burn proof)
		withdrawStep = "building-proofs";
		withdrawMessage = "Getting L1 burn proof...";

		const l1Chain = getEVMChain("Ethereum");
		if (!l1Chain) throw new Error("Ethereum chain config not found");
		const l1ChainId = l1Chain.chainId;

		const { evmMerkleData: l1EvmMerkleData, aztecWarptoadAddress } = 
			await getEvmMerkleDataForL1(l1ChainId, commitment);

		console.log("L1 EVM merkle data:", l1EvmMerkleData);

		// Step 4: Get GigaBridge data (L1 local root in gigaRoot)
		withdrawMessage = "Getting L1 local root from GigaBridge...";

		// @ts-ignore - Function exists but TypeScript hasn't picked it up yet
		const { getMerkleDataForL1ToScroll } = await import("$lib/utils/evm-interactions.js");
		const { l1LocalRoot, l1LocalRootBlockNumber, gigaMerkleData } = 
			// @ts-ignore
			await getMerkleDataForL1ToScroll(l1ChainId, gigaRoot);

		console.log("L1 local root:", l1LocalRoot.toString());
		console.log("Giga merkle data:", gigaMerkleData);

		// Step 5: Prepare proof inputs
		withdrawMessage = "Preparing proof inputs...";

		// Prepare fee config for relay or self-relay
		const feeConfig: FeeConfig | undefined = useRelay && relayerInfo ? {
			feeFactor: 0n, // Altruistic relayer (no fee)
			relayerAddress: relayerInfo.relayerAddress,
			priorityFee: BigInt(relayerInfo.currentGasPrice),
			maxFee: BigInt(selectedProof.commitmentData.amount) // Allow up to full amount
		} : undefined; // undefined = use self-relay defaults

		// @ts-ignore - Function exists but TypeScript hasn't picked it up yet
		const { prepareProofInputsForL1ToScroll } = await import("$lib/utils/proof-generation.js");
		// @ts-ignore
		const proofInputs = prepareProofInputsForL1ToScroll(
			selectedProof.commitmentData,
			l1EvmMerkleData,
			gigaMerkleData,
			gigaRoot,
			localRoot, // Scroll local root
			l1LocalRoot, // L1 local root
			aztecWarptoadAddress,
			BigInt(scrollChain.chainId),
			walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
			feeConfig
		);
		console.log("Proof inputs prepared");

		// Step 6: Generate ZK proof
		withdrawStep = "generating-proof";
		withdrawMessage = "Generating ZK proof (30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => { withdrawMessage = msg; }
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 7: Claim on Scroll (relay or self-relay)
		let mintTxHash: string;

		if (useRelay && relayerInfo) {
			// GASLESS RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Submitting to relay service...";
			
			try {
				const relayResponse = await submitWithdrawRelay({
					chainId: scrollChain.chainId.toString(),
					contractAddress: scrollChain.contracts.warpToad,
					nullifier: publicInputs[0].toString(),
					amount: publicInputs[2].toString(),
					gigaRoot: publicInputs[3].toString(),
					localRoot: publicInputs[4].toString(),
					feeFactor: publicInputs[6].toString(),
					priorityFee: publicInputs[7].toString(),
					maxFee: publicInputs[8].toString(),
					relayer: relayerInfo.relayerAddress,
					recipient: walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
					proof: proofHex
				});
				
				relayOperationId = relayResponse.operationId || null;
				withdrawMessage = "Waiting for relayer to submit transaction...";
				
				// Poll for status
				const finalStatus = await pollRelayStatus(
					relayResponse.operationId!,
					(status: RelayStatus) => {
						relayStatusText = status.status;
						if (status.status === 'validating') {
							withdrawMessage = 'Relayer validating transaction...';
						} else if (status.status === 'submitting') {
							withdrawMessage = 'Relayer submitting transaction...';
						}
					}
				);
				
				if (finalStatus.status === 'failed') {
					throw new Error(finalStatus.error || 'Relay transaction failed');
				}
				
				mintTxHash = finalStatus.txHash!;
				
			} catch (error) {
				throw new Error(`Relay failed: ${error}`);
			}
		} else {
			// SELF-RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Minting wrapped tokens on Scroll L2...";

			const result = await claimOnScroll(proofInputs, proofHex);
			mintTxHash = result.txHash;
		}

		// Step 8: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdrawal to Scroll complete!";

		proofStore.markProofAsUsed(selectedProof.id);
		successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token} to Scroll! Tx: ${mintTxHash.slice(0, 10)}...`;

		// Refresh balances
		await balanceStore.refresh();

		// Reset after delay
		setTimeout(() => {
			selectedProof = null;
			isWithdrawing = false;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from Scroll to L1
	 * This generates a ZK proof and calls the L1WarpToad.mint()
	 */
	async function withdrawFromScrollToL1() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get L1 chain state
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking L1 bridge state...";

		const chainId = await getEvmChainId();
		const l1Chain = getEVMChain("Ethereum");
		if (!l1Chain) throw new Error("Ethereum chain config not found");
		
		// Ensure user is on L1 network
		if (!chainId || chainId !== l1Chain.chainId) {
			throw new Error(
				`Please switch to Ethereum network (chain ID: ${l1Chain.chainId})`,
			);
		}

		const gigaRoot = await getL1GigaRoot(chainId);
		console.log("L1 GigaRoot:", gigaRoot.toString());

		const localRoot = await getL1LocalRoot(chainId);
		console.log("L1 LocalRoot:", localRoot.toString());

		// Step 3: Get Scroll merkle data (burn proof)
		withdrawStep = "building-proofs";
		withdrawMessage = "Getting Scroll burn proof...";

		// @ts-ignore - Function exists but TypeScript hasn't picked it up yet
		const { getEvmMerkleDataForScroll } = await import("$lib/utils/scroll-interactions.js");
		// @ts-ignore
		const { evmMerkleData: scrollEvmMerkleData, aztecWarptoadAddress, localRootBlockNumber } = 
			await getEvmMerkleDataForScroll(commitment);

		console.log("Scroll EVM merkle data:", scrollEvmMerkleData);

		// Step 4: Get GigaBridge data (Scroll local root in gigaRoot)
		withdrawMessage = "Getting Scroll local root from GigaBridge...";

		// @ts-ignore - Function exists but TypeScript hasn't picked it up yet
		const { getMerkleDataForScrollToL1 } = await import("$lib/utils/evm-interactions.js");
		// @ts-ignore
		const { scrollLocalRoot, scrollLocalRootBlockNumber, gigaMerkleData } = 
			await getMerkleDataForScrollToL1(chainId, gigaRoot);

		console.log("Scroll local root:", scrollLocalRoot.toString());
		console.log("Giga merkle data:", gigaMerkleData);

		// Step 5: Prepare proof inputs
		withdrawMessage = "Preparing proof inputs...";

		// Prepare fee config for relay or self-relay
		const feeConfig: FeeConfig | undefined = useRelay && relayerInfo ? {
			feeFactor: 0n, // Altruistic relayer (no fee)
			relayerAddress: relayerInfo.relayerAddress,
			priorityFee: BigInt(relayerInfo.currentGasPrice),
			maxFee: BigInt(selectedProof.commitmentData.amount) // Allow up to full amount
		} : undefined; // undefined = use self-relay defaults

		// @ts-ignore - Function exists but TypeScript hasn't picked it up yet
		const { prepareProofInputsForScrollToL1 } = await import("$lib/utils/proof-generation.js");
		// @ts-ignore
		const proofInputs = prepareProofInputsForScrollToL1(
			selectedProof.commitmentData,
			scrollEvmMerkleData,
			gigaMerkleData,
			gigaRoot,
			localRoot, // L1 local root
			scrollLocalRoot, // Scroll local root
			aztecWarptoadAddress,
			BigInt(chainId),
			walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
			feeConfig
		);
		console.log("Proof inputs prepared");

		// Step 6: Generate ZK proof
		withdrawStep = "generating-proof";
		withdrawMessage = "Generating ZK proof (30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => { withdrawMessage = msg; }
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 7: Claim on L1 (relay or self-relay)
		let mintTxHash: string;

		if (useRelay && relayerInfo) {
			// GASLESS RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Submitting to relay service...";
			
			try {
				const relayResponse = await submitWithdrawRelay({
					chainId: chainId.toString(),
					contractAddress: l1Chain.contracts.warpToad,
					nullifier: publicInputs[0].toString(),
					amount: publicInputs[2].toString(),
					gigaRoot: publicInputs[3].toString(),
					localRoot: publicInputs[4].toString(),
					feeFactor: publicInputs[6].toString(),
					priorityFee: publicInputs[7].toString(),
					maxFee: publicInputs[8].toString(),
					relayer: relayerInfo.relayerAddress,
					recipient: walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
					proof: proofHex
				});
				
				relayOperationId = relayResponse.operationId || null;
				withdrawMessage = "Waiting for relayer to submit transaction...";
				
				// Poll for status
				const finalStatus = await pollRelayStatus(
					relayResponse.operationId!,
					(status: RelayStatus) => {
						relayStatusText = status.status;
						if (status.status === 'validating') {
							withdrawMessage = 'Relayer validating transaction...';
						} else if (status.status === 'submitting') {
							withdrawMessage = 'Relayer submitting transaction...';
						}
					}
				);
				
				if (finalStatus.status === 'failed') {
					throw new Error(finalStatus.error || 'Relay transaction failed');
				}
				
				mintTxHash = finalStatus.txHash!;
				
			} catch (error) {
				throw new Error(`Relay failed: ${error}`);
			}
		} else {
			// SELF-RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Minting tokens on L1...";

			const result = await claimOnL1(
				proofInputs,
				proofHex,
				chainId,
				"Scroll -> L1"
			);
			mintTxHash = result.txHash;
		}

		// Step 8: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdrawal to L1 complete!";

		proofStore.markProofAsUsed(selectedProof.id);
		successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token} to Ethereum L1! Tx: ${mintTxHash.slice(0, 10)}...`;

		// Refresh balances
		await balanceStore.refresh();

		// Reset after delay
		setTimeout(() => {
			selectedProof = null;
			isWithdrawing = false;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from same-chain transfer on Ethereum L1
	 * Used for L1 -> L1 private transfers
	 *
	 * Flow:
	 * 1. Get local root and gigaRoot from L1WarpToad
	 * 2. Build EVM merkle proof for the commitment
	 * 3. Generate ZK proof with is_from_aztec = false
	 * 4. Call mint() on L1WarpToad
	 * 5. Optionally auto-unwrap
	 */
	async function withdrawSameChainL1() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get L1 chain state
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking L1 bridge state...";

		const chainId = await getEvmChainId();
		if (!chainId) {
			throw new Error(
				"EVM wallet not connected. Please connect your Ethereum wallet.",
			);
		}
		console.log("L1 Chain ID:", chainId);

		const gigaRoot = await getL1GigaRoot(chainId);
		console.log("L1 GigaRoot:", gigaRoot.toString());

		const localRoot = await getL1LocalRoot(chainId);
		console.log("L1 LocalRoot:", localRoot.toString());

		// For same-chain transfers, we need to ensure the localRoot is stored in history
		// This allows immediate withdrawals after burn without full bridge sync
		const isLocalRootValid = await isValidL1LocalRoot(chainId, localRoot);
		if (!isLocalRootValid) {
			withdrawMessage = "Storing local root in history...";
			console.log("Local root not in history, storing it now...");
			await storeL1LocalRootInHistory(chainId);
			console.log("Local root stored successfully");
		}

		// Step 3: Build EVM merkle proof
		withdrawStep = "building-proofs";
		withdrawMessage = "Building EVM merkle proof...";

		const {evmMerkleData, aztecWarptoadAddress} = await getEvmMerkleDataForL1(chainId, commitment);
		console.log("EVM merkle data:", evmMerkleData);

		// Step 4: Prepare proof inputs for same-chain withdrawal
		withdrawMessage = "Preparing proof inputs...";

		// Prepare fee config for relay or self-relay
		// NOTE: Using feeFactor=0 for altruistic testnet relayer (contract formula is broken)
		const feeConfig: FeeConfig | undefined = useRelay && relayerInfo ? {
			feeFactor: 0n, // Altruistic relayer for testnet (no fee)
			relayerAddress: relayerInfo.relayerAddress,
			priorityFee: BigInt(relayerInfo.currentGasPrice),
			maxFee: BigInt(selectedProof.commitmentData.amount) // Allow up to full amount
		} : undefined; // undefined = use self-relay defaults

		// For same-chain transfers:
		// - origin_local_root == destination_local_root (same chain)
		// - Circuit skips giga root verification when roots are equal
		// - We pass actual gigaRoot (contract validates it exists in history)
		// - Empty giga merkle data (no cross-chain proof needed)
		console.log({aztecWarptoadAddress:toHex(aztecWarptoadAddress)})
		const proofInputs = prepareProofInputsForSameChain(
			selectedProof.commitmentData,
			null, // No Aztec merkle data
			{
				leaf_index: evmMerkleData.leaf_index,
				hash_path: evmMerkleData.hash_path,
			},
			aztecWarptoadAddress,
			localRoot,
			gigaRoot, // Pass the actual gigaRoot from the contract
			BigInt(chainId),
			walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
			false, // is_from_aztec = false for EVM
			feeConfig // Fee config for relay
		);
		console.log("Proof inputs prepared");

		// Step 5: Generate ZK proof
		withdrawStep = "generating-proof";
		withdrawMessage =
			"Generating ZK proof (this may take 30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => {
				withdrawMessage = msg;
			},
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 6: Submit transaction (relay or self-relay)
		let mintTxHash: string;
		let unwrapTxHash: string | null = null;

		if (useRelay && relayerInfo) {
			// GASLESS RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Submitting to relay service...";
			
			try {
				// Get L1 WarpToad contract address
				const l1Chain = getEVMChain('Ethereum');
				if (!l1Chain) throw new Error('Ethereum chain config not found');
				
				const relayResponse = await submitWithdrawRelay({
					contractAddress: l1Chain.contracts.warpToad,
					nullifier: publicInputs[0].toString(),
					amount: publicInputs[2].toString(),
					gigaRoot: publicInputs[3].toString(),
					localRoot: publicInputs[4].toString(),
					feeFactor: publicInputs[6].toString(), // Index 6: fee_factor (index 5 is aztec_warptoad_address)
					priorityFee: publicInputs[7].toString(), // Index 7: priority_fee
					maxFee: publicInputs[8].toString(), // Index 8: max_fee
					relayer: relayerInfo.relayerAddress,
					recipient: walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
					proof: proofHex
				});
				
				relayOperationId = relayResponse.operationId || null;
				withdrawMessage = "Waiting for relayer to submit transaction...";
				
				// Poll for status
				const finalStatus = await pollRelayStatus(
					relayResponse.operationId!,
					(status: RelayStatus) => {
						relayStatusText = status.status;
						if (status.status === 'validating') {
							withdrawMessage = 'Relayer validating transaction...';
						} else if (status.status === 'submitting') {
							withdrawMessage = 'Relayer submitting transaction...';
						}
					}
				);
				
				if (finalStatus.status === 'failed') {
					throw new Error(finalStatus.error || 'Relay transaction failed');
				}
				
				mintTxHash = finalStatus.txHash!;
				unwrapTxHash = null; // Relay doesn't support auto-unwrap
				
			} catch (error) {
				throw new Error(`Relay failed: ${error}`);
			}
		} else {
			// EXISTING SELF-RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Minting tokens on L1...";

			if (autoUnwrap) {
				// Mint and unwrap in sequence (use L1 -> L1 logging)
				const result = await claimAndUnwrapOnL1(
					proofInputs,
					proofHex,
					chainId,
					"L1 -> L1 same-chain",
				);
				mintTxHash = result.mintTxHash;
				unwrapTxHash = result.unwrapTxHash || null;

				if (unwrapTxHash) {
					withdrawStep = "unwrapping";
					withdrawMessage = "Unwrapping to native tokens...";
				}
			} else {
				// Just mint wrapped tokens
				const result = await claimOnL1(
					proofInputs,
					proofHex,
					chainId,
					"L1 -> L1 same-chain",
				);
				mintTxHash = result.txHash;
			}
		}

		// Step 7: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdrawal complete!";

		proofStore.markProofAsUsed(selectedProof.id);

		if (autoUnwrap && !unwrapTxHash) {
			successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token}! Mint tx: ${mintTxHash.slice(0, 10)}... (unwrap skipped - contract bug)`;
		} else if (autoUnwrap && unwrapTxHash) {
			successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token}! Unwrap tx: ${unwrapTxHash.slice(0, 10)}...`;
		} else {
			successMessage = `Withdrew ${selectedProof.amount} wrapped ${selectedProof.token}! Tx: ${mintTxHash.slice(0, 10)}...`;
		}

		// Reset button immediately so user can interact with UI
		isWithdrawing = false;

		// Refresh balances in background
		balanceStore.refresh().catch(err => console.error('Failed to refresh balances:', err));

		// Reset form after delay
		setTimeout(() => {
			selectedProof = null;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from Scroll to Scroll (same-chain)
	 * This uses Scroll's L2WarpToad and stays on the same L2
	 *
	 * Flow:
	 * 1. Validate commitment data
	 * 2. Get Scroll chain state (gigaRoot, localRoot)
	 * 3. Ensure localRoot is stored in history (enables immediate withdrawal)
	 * 4. Build EVM merkle proof from Scroll's LazyIMT tree
	 * 5. Generate ZK proof with origin_local_root == destination_local_root
	 * 6. Submit via relay service OR self-relay to L2WarpToad.mint()
	 */
	async function withdrawSameChainScroll() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get Scroll chain state
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking Scroll bridge state...";

		const scrollChainId = getScrollChainId();
		console.log("Scroll Chain ID:", scrollChainId);

		const gigaRoot = await getScrollGigaRoot();
		console.log("Scroll GigaRoot:", gigaRoot.toString());

		const localRoot = await getScrollLocalRoot();
		console.log("Scroll LocalRoot:", localRoot.toString());

		// For same-chain transfers, we need to ensure the localRoot is stored in history
		// This allows immediate withdrawals after burn without full bridge sync
		const isLocalRootValid = await isValidScrollLocalRoot(localRoot);
		if (!isLocalRootValid) {
			withdrawMessage = "Storing local root in history...";
			console.log("Local root not in history, storing it now...");

			// This is a transaction that costs gas but enables same-chain withdrawals
			await storeScrollLocalRootInHistory();

			// Verify it was stored successfully
			const isNowValid = await isValidScrollLocalRoot(localRoot);
			if (!isNowValid) {
				throw new Error(
					"Failed to store local root in history. Please try again.",
				);
			}
		}

		// Step 3: Build EVM merkle proof from Scroll's tree
		withdrawStep = "building-proofs";
		withdrawMessage = "Building merkle proof from Scroll tree...";

		// Import the Scroll merkle data function dynamically
		const { getEvmMerkleDataForScroll } = await import("$lib/utils/scroll-interactions.js");

		const { evmMerkleData, aztecWarptoadAddress, localRootBlockNumber } =
			await getEvmMerkleDataForScroll(commitment);

		console.log("Scroll EVM merkle data:", evmMerkleData);
		console.log("Aztec WarpToad address:", aztecWarptoadAddress.toString());

		// Step 4: Prepare proof inputs for same-chain transfer
		withdrawMessage = "Preparing proof inputs...";

		// Get relayer info if using relay service
		let feeConfig: FeeConfig | undefined;
		if (useRelay && relayerInfo) {
			feeConfig = {
				feeFactor: 0n, // Altruistic relayer for testnet
				relayerAddress: relayerInfo.relayerAddress,
				priorityFee: BigInt(relayerInfo.currentGasPrice),
				maxFee: BigInt(selectedProof.commitmentData.amount), // Allow up to full amount
			};
		}

		// For same-chain: origin_local_root == destination_local_root
		const proofInputs = prepareProofInputsForSameChain(
			selectedProof.commitmentData,
			null, // aztecMerkleData (not from Aztec)
			evmMerkleData, // Scroll's EVM merkle data
			aztecWarptoadAddress,
			localRoot, // Same for both origin and destination
			gigaRoot,
			BigInt(scrollChainId),
			walletStore.wallets.evm ||
				"0x0000000000000000000000000000000000000000",
			false, // isFromAztec = false (this is EVM -> EVM)
			feeConfig,
		);
		console.log("Proof inputs prepared for Scroll same-chain");

		// Step 5: Generate ZK proof in browser
		withdrawStep = "generating-proof";
		withdrawMessage =
			"Generating ZK proof (this may take 30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => {
				withdrawMessage = msg;
			},
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for Scroll submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 6: Submit transaction (relay or self-relay)
		let mintTxHash: string;

		if (useRelay && relayerInfo) {
			// RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Submitting to relay service...";

			try {
				const scrollChain = getEVMChain("Scroll");
				if (!scrollChain || !scrollChain.enabled) {
					throw new Error("Scroll chain not enabled");
				}

				const relayResponse = await submitWithdrawRelay({
					chainId: scrollChainId.toString(),
					contractAddress: scrollChain.contracts.warpToad,
					nullifier: publicInputs[0].toString(),
					amount: publicInputs[2].toString(),
					gigaRoot: publicInputs[3].toString(),
					localRoot: publicInputs[4].toString(),
					feeFactor: publicInputs[6].toString(),
					priorityFee: publicInputs[7].toString(),
					maxFee: publicInputs[8].toString(),
					relayer: relayerInfo.relayerAddress,
					recipient: walletStore.wallets.evm || "0x0000000000000000000000000000000000000000",
					proof: proofHex
				});

				relayOperationId = relayResponse.operationId || null;
				withdrawMessage = "Waiting for relayer to submit transaction...";

				// Poll for status
				const finalStatus = await pollRelayStatus(
					relayResponse.operationId!,
					(status: RelayStatus) => {
						relayStatusText = status.status;
						if (status.status === 'validating') {
							withdrawMessage = 'Relayer validating transaction...';
						} else if (status.status === 'submitting') {
							withdrawMessage = 'Relayer submitting transaction...';
						}
					}
				);

				if (finalStatus.status === 'failed') {
					throw new Error(finalStatus.error || 'Relay transaction failed');
				}

				mintTxHash = finalStatus.txHash!;

			} catch (error) {
				throw new Error(`Relay failed: ${error}`);
			}
		} else {
			// SELF-RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Minting tokens on Scroll...";

			const result = await claimOnScroll(
				proofInputs,
				proofHex,
			);
			mintTxHash = result.txHash;
		}

		// Step 7: Success!
		withdrawStep = "complete";
		withdrawMessage = "Withdrawal complete!";

		// Mark note as consumed/used
		proofStore.markProofAsUsed(selectedProof.id);

		successMessage = `Successfully withdrew ${selectedProof.amount} ${selectedProof.token} on Scroll! Tx: ${mintTxHash.slice(0, 16)}...`;

		console.log("Scroll same-chain withdrawal complete:", {
			mintTxHash,
			commitment: commitment.toString(),
			localRoot: localRoot.toString(),
		});

		// Reset button immediately so user can interact with UI
		isWithdrawing = false;

		// Refresh balances in background
		balanceStore.refreshScrollBalance().catch(err => console.error('Failed to refresh Scroll balance:', err));

		// Reset form after delay
		setTimeout(() => {
			selectedProof = null;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	/**
	 * Withdraw from Aztec to L1 (EVM)
	 * This generates a ZK proof in-browser and calls the L1 mint function
	 */
	async function withdrawToL1() {
		if (!selectedProof?.commitmentData) {
			throw new Error(
				"Proof missing commitment data. Please re-bridge or upload a valid note file.",
			);
		}

		// Step 1: Validate commitment data
		withdrawStep = "validating";
		withdrawMessage = "Validating commitment data...";

		const { nullifier_preimg, secret, destination_chain_id, amount } =
			selectedProof.commitmentData;

		// Calculate commitment hash for lookups
		const preCommitment = hashPreCommitment(
			nullifier_preimg,
			secret,
			destination_chain_id,
		);
		const commitment = hashCommitment(preCommitment, amount);
		console.log("Commitment:", commitment.toString());

		// Step 2: Get L1 chain ID and gigaRoot
		withdrawStep = "checking-bridge";
		withdrawMessage = "Checking L1 bridge state...";

		const chainId = await getEvmChainId();
		if (!chainId) {
			throw new Error(
				"EVM wallet not connected. Please connect your Ethereum wallet.",
			);
		}
		console.log("L1 Chain ID:", chainId);

		const gigaRoot = await getL1GigaRoot(chainId);
		console.log("L1 GigaRoot:", gigaRoot.toString());

		const localRoot = await getL1LocalRoot(chainId);
		console.log("L1 LocalRoot:", localRoot.toString());

		// Step 3: Get Giga merkle data (Aztec local root in gigaRoot)
		withdrawStep = "building-proofs";
		withdrawMessage = "Getting Aztec local root from GigaBridge...";

		// Get the Aztec local root that was bridged into this gigaRoot
		// This also gives us the Aztec block number when the root was bridged
		const { aztecLocalRoot, aztecLocalRootBlockNumber, gigaMerkleData } =
			await getMerkleDataForAztecToL1(chainId, gigaRoot);

		console.log("Aztec local root:", aztecLocalRoot.toString());
		console.log(
			"Aztec local root block number:",
			aztecLocalRootBlockNumber,
		);
		console.log("Giga merkle data:", gigaMerkleData);

		// Step 4: Get Aztec wallet and merkle data
		withdrawMessage = "Fetching Aztec merkle proof...";

		const aztecWallet = getWalletInstance();
		if (!aztecWallet) {
			throw new Error(
				"Aztec wallet not connected. Please connect your Azguard wallet to fetch your note.",
			);
		}

		// Get Aztec merkle data using the block number from when the root was bridged
		// This ensures our commitment exists in the tree at that snapshot
		let aztecMerkleData;
		try {
			aztecMerkleData = await getAztecMerkleData(
				aztecWallet,
				commitment,
				aztecLocalRootBlockNumber,
			);
			console.log("Aztec merkle data:", aztecMerkleData);
		} catch (error) {
			// Check if this is the "unable to find sibling path" error due to old blocks
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg.includes("unable to find sibling path") || 
			    errorMsg.includes("sibling") ||
			    errorMsg.includes("MerkleTree")) {
				throw new Error(
					`The Aztec block (${aztecLocalRootBlockNumber}) is too old (>100 minutes). ` +
					`The Aztec node only keeps recent merkle tree history. ` +
					`Please wait for the next bridge sync (which happens every ~60 min) to get a more recent block number, or bridge your tokens again.`
				);
			}
			// Re-throw other errors as-is
			throw error;
		}

		// The origin local root is the Aztec note hash tree root that was bridged
		const originLocalRoot = aztecLocalRoot;
		console.log(
			"Origin local root (Aztec note tree root):",
			originLocalRoot.toString(),
		);

		// Step 5: Prepare proof inputs
		withdrawMessage = "Preparing proof inputs...";

		// Prepare fee config for relay or self-relay
		// NOTE: Using feeFactor=0 for altruistic testnet relayer (contract formula is broken)
		const feeConfig: FeeConfig | undefined =
			useRelay && relayerInfo
				? {
						feeFactor: 0n, // Altruistic relayer for testnet (no fee)
						relayerAddress: relayerInfo.relayerAddress,
						priorityFee: BigInt(relayerInfo.currentGasPrice),
						maxFee: BigInt(selectedProof.commitmentData.amount), // Allow up to full amount
					}
				: undefined; // undefined = use self-relay defaults

		// Get recipient address from connected EVM wallet
		// (could also get from Aztec wallet if needed)
		const proofInputs = prepareProofInputsForAztecToL1(
			selectedProof.commitmentData,
			aztecMerkleData,
			gigaMerkleData,
			gigaRoot,
			localRoot, // destination local root (L1)
			originLocalRoot, // origin local root (Aztec)
			BigInt(chainId),
			walletStore.wallets.evm ||
				"0x0000000000000000000000000000000000000000",
			feeConfig, // <-- FEE CONFIG FOR RELAY
		);
		console.log("Proof inputs prepared");

		// Step 6: Generate ZK proof in browser
		withdrawStep = "generating-proof";
		withdrawMessage =
			"Generating ZK proof (this may take 30-60 seconds)...";

		const { proof, publicInputs } = await generateWithdrawProof(
			proofInputs,
			(msg) => {
				withdrawMessage = msg;
			},
		);
		console.log("Proof generated, public inputs:", publicInputs.length);

		// Format proof for L1 submission
		const proofHex = formatProofForL1(proof);
		console.log("Proof hex length:", proofHex.length);

		// Step 7: Submit transaction (relay or self-relay)
		let mintTxHash: string;
		let unwrapTxHash: string | null = null;

		if (useRelay && relayerInfo) {
			// GASLESS RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Submitting to relay service...";

			try {
				// Get L1 WarpToad contract address
				const l1Chain = getEVMChain("Ethereum");
				if (!l1Chain)
					throw new Error("Ethereum chain config not found");

				const relayResponse = await submitWithdrawRelay({
					contractAddress: l1Chain.contracts.warpToad,
					nullifier: publicInputs[0].toString(),
					amount: publicInputs[2].toString(),
					gigaRoot: publicInputs[3].toString(),
					localRoot: publicInputs[4].toString(),
					feeFactor: publicInputs[6].toString(), // Index 6: fee_factor (index 5 is aztec_warptoad_address)
					priorityFee: publicInputs[7].toString(), // Index 7: priority_fee
					maxFee: publicInputs[8].toString(), // Index 8: max_fee
					relayer: relayerInfo.relayerAddress,
					recipient:
						walletStore.wallets.evm ||
						"0x0000000000000000000000000000000000000000",
					proof: proofHex,
				});

				relayOperationId = relayResponse.operationId || null;
				withdrawMessage =
					"Waiting for relayer to submit transaction...";

				// Poll for status
				const finalStatus = await pollRelayStatus(
					relayResponse.operationId!,
					(status: RelayStatus) => {
						relayStatusText = status.status;
						if (status.status === "validating") {
							withdrawMessage =
								"Relayer validating transaction...";
						} else if (status.status === "submitting") {
							withdrawMessage =
								"Relayer submitting transaction...";
						}
					},
				);

				if (finalStatus.status === "failed") {
					throw new Error(
						finalStatus.error || "Relay transaction failed",
					);
				}

				mintTxHash = finalStatus.txHash!;
				unwrapTxHash = null; // Relay doesn't support auto-unwrap
			} catch (error) {
				throw new Error(`Relay failed: ${error}`);
			}
		} else {
			// EXISTING SELF-RELAY PATH
			withdrawStep = "minting";
			withdrawMessage = "Minting wrapped tokens on L1...";

			if (autoUnwrap) {
				// Mint and unwrap in sequence
				const result = await claimAndUnwrapFromAztec(
					proofInputs,
					proofHex,
					chainId,
				);
				mintTxHash = result.mintTxHash;
				unwrapTxHash = result.unwrapTxHash || null;

				if (unwrapTxHash) {
					withdrawStep = "unwrapping";
					withdrawMessage = "Unwrapping to native tokens...";
				}
			} else {
				// Just mint wrapped tokens
				const result = await claimFromAztec(
					proofInputs,
					proofHex,
					chainId,
				);
				mintTxHash = result.txHash;
			}
		}

		// Step 8: Complete
		withdrawStep = "complete";
		withdrawMessage = "Withdraw complete!";

		proofStore.markProofAsUsed(selectedProof.id);

		if (autoUnwrap && !unwrapTxHash) {
			successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token}! Mint tx: ${mintTxHash.slice(0, 10)}... (unwrap skipped - contract bug)`;
		} else if (autoUnwrap && unwrapTxHash) {
			successMessage = `Withdrew ${selectedProof.amount} ${selectedProof.token}! Unwrap tx: ${unwrapTxHash.slice(0, 10)}...`;
		} else {
			successMessage = `Withdrew ${selectedProof.amount} wrapped ${selectedProof.token}! Tx: ${mintTxHash.slice(0, 10)}...`;
		}

		// Reset button immediately so user can interact with UI
		isWithdrawing = false;

		// Refresh balances in background
		balanceStore.refresh().catch(err => console.error('Failed to refresh balances:', err));

		// Reset form after delay
		setTimeout(() => {
			selectedProof = null;
			withdrawStep = "idle";
			withdrawMessage = "";
		}, 5000);
	}

	function triggerFileUpload() {
		fileInput?.click();
	}

	function getStepNumber(step: typeof withdrawStep): string {
		switch (step) {
			case "validating":
				return "1/6";
			case "checking-bridge":
				return "2/6";
			case "building-proofs":
				return "3/6";
			case "generating-proof":
				return "4/6";
			case "minting":
				return "5/6";
			case "unwrapping":
				return "6/6";
			case "complete":
				return "6/6";
			default:
				return "";
		}
	}

	// Check if this is an Aztec -> EVM withdrawal (L1 or Scroll)
	function isAztecToEVM(): boolean {
		if (!selectedProof) return false;
		return (
			selectedProof.sourceChain === "Aztec" &&
			(selectedProof.targetChain === "Ethereum" ||
				selectedProof.targetChain === "Scroll")
		);
	}

	// Legacy alias for backwards compatibility
	function isAztecToL1(): boolean {
		return isAztecToEVM() && selectedProof?.targetChain === "Ethereum";
	}

	// Check if this is a same-chain L1 transfer
	function isSameChainL1(): boolean {
		if (!selectedProof) return false;
		return (
			selectedProof.sourceChain === "Ethereum" &&
			selectedProof.targetChain === "Ethereum"
		);
	}

	// Check if this is a same-chain transfer (any EVM chain)
	function isSameChainTransfer(): boolean {
		if (!selectedProof) return false;
		return selectedProof.sourceChain === selectedProof.targetChain;
	}

	// Check if auto-unwrap should be shown (L1 withdrawals with wrap/unwrap support)
	function showAutoUnwrap(): boolean {
		return isAztecToL1() || isSameChainL1();
	}

	// Check if relay should be available for this withdrawal flow
	function isRelaySupported(): boolean {
		if (!selectedProof) return false;
		
		// Relay is supported for all EVM → EVM flows
		// (L1 → L1, L1 → Scroll, Scroll → L1, Aztec → L1, Aztec → Scroll)
		const evmChains = ["Ethereum", "Scroll"];
		const targetIsEVM = evmChains.includes(selectedProof.targetChain);
		
		// Aztec source is always supported (if target is EVM)
		if (selectedProof.sourceChain === "Aztec" && targetIsEVM) {
			return true;
		}
		
		// EVM → EVM flows (L1 ↔ L1, L1 ↔ Scroll, Scroll ↔ Scroll)
		const sourceIsEVM = evmChains.includes(selectedProof.sourceChain);
		if (sourceIsEVM && targetIsEVM) {
			return true;
		}
		
		return false;
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
			<Button
				variant="outline"
				onclick={triggerFileUpload}
				class="w-full"
				disabled={isCheckingNullifier}
			>
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
					<AlertDescription class="whitespace-pre-wrap"
						>{uploadError}</AlertDescription
					>
				</Alert>
			{/if}
		</div>

		<div class="text-center text-sm text-muted-foreground">— or —</div>

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
							<span class="font-semibold"
								>{selectedProof.amount}
								{selectedProof.token}</span
							>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Route:</span>
							<span
								>{selectedProof.sourceChain} → {selectedProof.targetChain}</span
							>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground"
								>Source Chain ID:</span
							>
							<span>{getSourceChainId()}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground"
								>Target Wallet:</span
							>
							<span class="flex items-center gap-1">
								{#if isTargetConnected}
									<CheckCircle2
										class="size-4 text-green-500"
									/>
									<span class="text-green-500">Connected</span
									>
								{:else}
									<span class="text-destructive"
										>Not Connected</span
									>
								{/if}
							</span>
						</div>
						{#if isTargetConnected && needsNetworkSwitch}
							<Alert variant="default" class="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
								<AlertDescription class="text-yellow-800 dark:text-yellow-200">
									Wrong network. Please switch to {selectedProof.targetChain}.
								</AlertDescription>
							</Alert>
						{/if}
						{#if selectedProof.commitmentData}
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground"
									>Has Commitment:</span
								>
								<CheckCircle2 class="size-4 text-green-500" />
							</div>
						{:else}
							<Alert variant="destructive">
								<AlertDescription>
									Missing commitment data. Upload note file to
									restore.
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
						Please connect your {selectedProof.targetChain} wallet to
						withdraw.
						{#if selectedProof.targetChain === "Aztec"}
							<br /><span class="text-xs text-muted-foreground"
								>Use the Azguard wallet extension.</span
							>
						{/if}
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Auto-unwrap toggle (for L1 withdrawals, but NOT when using relay) -->
			{#if showAutoUnwrap() && !useRelay}
				<div
					class="flex items-center justify-between p-3 rounded-lg border"
				>
					<div class="space-y-0.5">
						<Label for="auto-unwrap" class="cursor-pointer"
							>Auto-unwrap to native token</Label
						>
						<p class="text-xs text-muted-foreground">
							Receive native {selectedProof.token} instead of wrapped
							tokens
						</p>
					</div>
					<input
						id="auto-unwrap"
						type="checkbox"
						bind:checked={autoUnwrap}
						class="h-4 w-4 rounded border-gray-300"
					/>
				</div>
			{/if}

			<!-- Relay Service Toggle (for all supported EVM flows) -->
			{#if isRelaySupported() && relayServiceAvailable && relayerInfo}
				<Separator />

				<div class="space-y-4">
					<!-- Toggle between self-relay and gasless -->
					<div
						class="flex items-center justify-between p-3 rounded-lg border"
					>
						<div class="space-y-0.5">
							<Label for="use-relay" class="cursor-pointer">
								Gasless Withdrawal (Testnet - Subsidized)
							</Label>
							<p class="text-xs text-muted-foreground">
								Use relay service to avoid gas fees. Relayer is subsidized for testnet demo.
							</p>
						</div>
						<input
							id="use-relay"
							type="checkbox"
							bind:checked={useRelay}
							class="h-4 w-4 rounded border-gray-300"
						/>
					</div>

					<!-- Fee Info (only shown when relay enabled) -->
					{#if useRelay}
						<div
							class="space-y-3 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20"
						>
							<!-- Fee Breakdown -->
							<div class="space-y-2 text-sm">
								<div class="flex justify-between">
									<span class="text-muted-foreground"
										>Withdrawal Amount:</span
									>
									<span class="font-medium"
										>{selectedProof.amount}
										{selectedProof.token}</span
									>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground"
										>Relayer Fee:</span
									>
									<span class="font-medium text-green-600"
										>FREE (Testnet)</span
									>
								</div>
								<div
									class="flex justify-between pt-2 border-t"
								>
									<span class="text-muted-foreground"
										>You Receive:</span
									>
									<span class="font-medium text-green-600">
										{selectedProof.amount}
										<button 
											onclick={addWrappedTokenToWallet}
											class="underline hover:text-green-700 cursor-pointer"
											title="Click to add wrapped token to MetaMask"
										>
											wrptd-{selectedProof.token}
										</button>
									</span>
								</div>
							</div>
							<div class="space-y-2 p-3 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
								<p class="text-xs text-muted-foreground">
									<strong>Note:</strong> You will receive wrapped tokens (
									<button 
										onclick={addWrappedTokenToWallet}
										class="underline hover:text-blue-700 cursor-pointer font-semibold"
										title="Click to add to MetaMask"
									>
										wrptd-{selectedProof.token}
									</button>
									) when using the relayer. You can manually unwrap them to native {selectedProof.token} afterwards.
								</p>
								<p class="text-xs text-muted-foreground italic">
									Production relayers would charge a small fee (0.25%-5%) from your withdrawal amount.
								</p>
							</div>
						</div>
					{/if}


				</div>
			{/if}

			<!-- Same-chain transfer info -->
			{#if isSameChainTransfer()}
				<Alert>
					<AlertDescription class="text-sm">
						<strong>Same-chain transfer:</strong> This is a private
						transfer on {selectedProof.sourceChain}. A bridge sync
						must have occurred after your burn transaction.
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Withdraw Progress -->
			{#if isWithdrawing}
				<Alert>
					<AlertDescription class="flex items-center gap-2">
						{#if withdrawStep === "complete"}
							<CheckCircle2 class="size-4 text-green-500" />
						{:else}
							<Loader2 class="size-4 animate-spin" />
						{/if}
						<div class="flex-1">
							<div>{withdrawMessage}</div>
							{#if withdrawStep !== "idle" && withdrawStep !== "complete"}
								<div class="text-xs text-muted-foreground mt-1">
									Step {getStepNumber(withdrawStep)}: {withdrawStep.replace(
										"-",
										" ",
									)}
								</div>
							{/if}
						</div>
					</AlertDescription>
				</Alert>
			{/if}

			<!-- Withdraw Button -->
			<Button 
				class="w-full" 
				disabled={(!canWithdraw && !needsNetworkSwitch) || isWithdrawing} 
				onclick={needsNetworkSwitch ? switchToTargetNetwork : withdraw}
			>
				{#if isWithdrawing}
					Processing...
				{:else if needsNetworkSwitch}
					Switch to {selectedProof.targetChain}
				{:else if isAztecToL1() || isSameChainL1()}
					{#if useRelay}
						Gasless Withdraw ({feePercentage}% fee)
					{:else if autoUnwrap}
						Withdraw to Ethereum
					{:else}
						Withdraw (Wrapped)
					{/if}
				{:else}
					Withdraw to {selectedProof.targetChain}
				{/if}
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
