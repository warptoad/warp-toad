<script lang="ts">
	import { Upload, CheckCircle2, Loader2, AlertCircle, Download, Shield, X } from "@lucide/svelte";
	import { badgeVariants } from "$lib/components/ui/badge";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { proofStore } from "$lib/stores/proofs.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import ProofTable from "./ProofTable.svelte";
	import type { Proof, Chain } from "$lib/types/bridge.js";
	import ExplorerLink from "./ExplorerLink.svelte";
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
		getMerkleDataForL1ToL2,
		getMerkleDataForL2ToL1,
		isNoteUsedEvm,
	} from "$lib/utils/evm-interactions.js";
	import {
		getScrollGigaRoot,
		getScrollLocalRoot,
		claimOnScroll,
		isValidScrollLocalRoot,
		storeScrollLocalRootInHistory,
		getScrollChainId,
		getEvmMerkleDataForZkStack,
	} from "$lib/utils/zkstack-interactions.js";
	import {
		prepareProofInputsForAztecToL1,
		prepareProofInputsForSameChain,
		prepareProofInputsForL1ToScroll,
		prepareProofInputsForScrollToL1,
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
	import {
		BridgeSyncStaleError,
		triggerBridge,
		isBridgeKeeperEnabled,
		pollOperation,
	} from "$lib/utils/bridge-keeper.js";

	import { onMount } from "svelte";
	import { toHex } from "viem";
	import { rpcSettings } from "$lib/stores/rpc-settings.svelte";

	let selectedProof = $state<Proof | null>(null);
	let fileInput: HTMLInputElement;
	let uploadError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	// Set on a successful withdraw so the success banner can deep-link to the mint
	// tx on its explorer (the persistent copy lives in the ProofTable history row).
	let successTxHash = $state<string | null>(null);
	let successTxChain = $state<Chain | null>(null);

	/** Mark the active proof used, record the dest-chain mint tx hash on it (so the
	 * history row links to the withdraw tx), and stash it for the success banner. */
	function completeWithdraw(mintTxHash: string) {
		if (!selectedProof) return;
		proofStore.markProofAsUsed(selectedProof.id, mintTxHash);
		successTxHash = mintTxHash;
		successTxChain = selectedProof.targetChain;
	}

	/** Destination-aware "already withdrawn" check. Aztec hits the nullifier tree;
	 * EVM destinations read the WarpToad `nullifierExists` view (one eth_call, no
	 * log scan). `success: false` means the check itself couldn't run, so callers
	 * should fall through rather than block a legitimate withdraw. */
	async function checkProofSpent(
		proof: Proof,
	): Promise<{ isSpent: boolean; success: boolean; error?: string }> {
		const nullifierPreimg = proof.commitmentData?.nullifier_preimg;
		if (nullifierPreimg === undefined) {
			return { isSpent: false, success: false, error: "Note is missing nullifier data" };
		}
		return proof.targetChain === "Aztec"
			? await isNoteUsed(nullifierPreimg)
			: await isNoteUsedEvm(proof.targetChain, nullifierPreimg);
	}
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

	// Inline hint when the user flips the RPC toggle to "custom" without one
	// configured. Reset whenever the user navigates away from the toggle.
	let rpcHintVisible = $state(false);

	// Source chain for the current withdraw flow. Only EVM chains have an RPC
	// override applied (Aztec source uses a different stack).
	let rpcOverrideChainId = $derived.by<number | null>(() => {
		if (!selectedProof) return null;
		if (selectedProof.sourceChain !== "Ethereum" && selectedProof.sourceChain !== "ZKsync") return null;
		const def = getEVMChain(selectedProof.sourceChain);
		return def?.chainId ?? null;
	});

	let rpcOverrideHasCustom = $derived.by<boolean>(() =>
		rpcOverrideChainId !== null && rpcSettings.hasCustom(rpcOverrideChainId),
	);

	let rpcOverrideEnabled = $derived.by<boolean>(() =>
		rpcOverrideChainId !== null && rpcSettings.isUsingCustom(rpcOverrideChainId),
	);

	function toggleRpcOverride() {
		if (rpcOverrideChainId === null) return;
		if (!rpcOverrideHasCustom) {
			rpcHintVisible = true;
			return;
		}
		rpcHintVisible = false;
		rpcSettings.setUseCustom(rpcOverrideChainId, !rpcSettings.isUsingCustom(rpcOverrideChainId));
	}

	// Get source chain ID dynamically based on source chain
	function getSourceChainId(): number {
		if (!selectedProof) {
			const ethereumChain = getEVMChain("Ethereum");
			return ethereumChain?.chainId ?? 31337;
		}
		
		// Get the actual source chain from the proof
		const sourceChainDef = getEVMChain(selectedProof.sourceChain);
		if (sourceChainDef) {
			return sourceChainDef.chainId;
		}
		
		// Fallback to Ethereum
		const ethereumChain = getEVMChain("Ethereum");
		return ethereumChain?.chainId ?? 31337;
	}

	// Map chain IDs to chain names
	function getChainNameFromId(
		chainId: bigint,
	): "Ethereum" | "ZKsync" | "Aztec" {
		const id = Number(chainId);
		// Standard EVM chain IDs
		if (id === 1 || id === 31337 || id === 11155111) {
			return "Ethereum"; // Mainnet, Anvil/localhost, or Sepolia
		}
		if (id === 534351 || id === 534352) {
			return "ZKsync"; // Scroll Sepolia or Mainnet
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
		// Re-clicking the currently selected row closes the panel. Matches the
		// "Close" button's behaviour so users have two equivalent gestures. The
		// in-flight guard keeps this from interrupting an active withdraw.
		if (selectedProof?.id === proof.id) {
			if (isWithdrawing) return;
			selectedProof = null;
			return;
		}
		// Switching to a different proof mid-withdraw would hijack the flow:
		// the running path calls proofStore.markProofAsUsed(selectedProof.id)
		// at the end, so it would mark the new proof as used while leaving
		// the real one as Ready. Block the swap entirely.
		if (isWithdrawing) return;
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

				// Create a new proof from the decoded note. `noteNonce` is
				// optional - present on Aztec-source notes issued after the
				// portable-note feature, absent on legacy notes (which fall
				// back to PXE lookup at withdraw time).
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
						...(noteData.noteNonce !== undefined ? { noteNonce: noteData.noteNonce } : {}),
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

		// Check whether the note was already withdrawn on its destination chain
		// before treating it as a Ready proof. Cheap on every destination: Aztec
		// hits the nullifier tree, EVM reads `nullifierExists` (one eth_call).
		// Skipped if it's already marked used locally.
		if (proof && !proof.used) {
			isCheckingNullifier = true;
			uploadError = null;
			// Force Svelte to see the state change
			await new Promise((resolve) => setTimeout(resolve, 0));

			const result = await checkProofSpent(proof);

			isCheckingNullifier = false;

			if (!result.success) {
				// Couldn't verify (RPC/node down) - warn but let the user proceed.
				uploadError =
					result.error ||
					"Could not verify note status. The destination RPC may be unavailable.";
			} else if (result.isSpent) {
				proofStore.markProofAsUsed(proof.id);
				proof = { ...proof, used: true };
				successMessage = null;
				uploadError = `This note has already been withdrawn on ${proof.targetChain}.`;
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

	/**
	 * Bridge-sync poll loop. When a Proof has a `bridgeSync` record (set at burn
	 * time by BridgeForm, or in the BridgeSyncStaleError catch below on a first
	 * failed withdraw attempt), this effect polls /status/:opId every 30s and
	 * updates the proof's lastStatus. The progress panel below the upload area
	 * renders from those fields, so a user who closes the tab and returns hours
	 * later sees real progress instead of a fresh stale-root error.
	 *
	 * Effect dependencies: only `selectedProof?.id` and
	 * `selectedProof?.bridgeSync?.operationId`. Status updates use Object.assign
	 * (in-place) in updateBridgeSyncStatus so the bridgeSync reference stays
	 * stable and the effect does not re-run on every poll.
	 */
	$effect(() => {
		const proofId = selectedProof?.id;
		const opId = selectedProof?.bridgeSync?.operationId;
		if (!proofId || !opId) return;

		const controller = new AbortController();
		const POLL_INTERVAL_MS = 30_000;
		const TERMINAL: ReadonlySet<string> = new Set([
			'completed', 'noop', 'failed', 'timeout',
		]);

		(async () => {
			while (!controller.signal.aborted) {
				// Re-check from the store each iteration; the user may have
				// withdrawn or deleted the proof since we started.
				const proof = proofStore.proofs.find(p => p.id === proofId);
				if (!proof || !proof.bridgeSync || proof.used) return;
				const currentStatus = proof.bridgeSync.lastStatus;
				if (currentStatus && TERMINAL.has(currentStatus)) return;

				const { response, expired, error } = await pollOperation(opId, controller.signal);
				if (controller.signal.aborted) return;

				if (expired) {
					console.log(`[WithdrawForm] bridge-sync op ${opId} expired server-side; clearing local record`);
					proofStore.clearBridgeSync(proofId);
					return;
				}
				if (response) {
					proofStore.updateBridgeSyncStatus(proofId, {
						lastStatus: response.status,
						lastPolledAtMs: Date.now(),
						txHashes: response.txHashes,
						lastError: response.error,
					});
					if (TERMINAL.has(response.status)) return;
				} else if (error) {
					// Transient network error: record but keep polling.
					proofStore.updateBridgeSyncStatus(proofId, {
						lastPolledAtMs: Date.now(),
						lastError: error,
					});
				}

				await new Promise<void>((resolve) => {
					const t = setTimeout(resolve, POLL_INTERVAL_MS);
					controller.signal.addEventListener('abort', () => {
						clearTimeout(t);
						resolve();
					}, { once: true });
				});
			}
		})().catch((e) => console.error('[WithdrawForm] poll loop error:', e));

		return () => controller.abort();
	});

	/**
	 * Parse a duration string (e.g. "2-4 hours (multi-hop via L1)") into an
	 * upper-bound ms estimate, used to compute a soft ETA in the progress
	 * panel. Returns null if no number can be extracted.
	 */
	function parseDurationUpperBoundMs(duration: string): number | null {
		const m = duration.match(/(\d+)(?:\s*-\s*(\d+))?\s*(minute|hour)/i);
		if (!m) return null;
		const upper = Number(m[2] ?? m[1]);
		const unit = m[3].toLowerCase();
		const multiplier = unit.startsWith('hour') ? 3_600_000 : 60_000;
		return upper * multiplier;
	}

	function formatRelativeTime(ms: number): string {
		const minutes = Math.floor(ms / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		const remMin = minutes % 60;
		if (remMin === 0) return `${hours}h ago`;
		return `${hours}h ${remMin}m ago`;
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

			const chain = getEVMChain('Ethereum') || getEVMChain('ZKsync');
			if (!chain) {
				alert('Chain configuration not found');
				return;
			}

			const wrappedTokenAddress = chain.contracts.warpToad;

			// Read the actual symbol + decimals from the deployed contract.
			// Constructing them client-side is fragile: the L1WarpToad contracts
			// are deployed with the wrapped name/symbol derived from the source
			// token at deploy time, so the on-chain values are the source of
			// truth. MetaMask validates `wallet_watchAsset` against contract.symbol()
			// and rejects mismatches.
			const { createPublicClient, http, getContract, parseAbi } = await import('viem');
			const publicClient = createPublicClient({ transport: http(chain.rpcUrl) });
			const erc20Abi = parseAbi([
				'function symbol() view returns (string)',
				'function decimals() view returns (uint8)',
			]);
			const tokenContract: any = getContract({
				address: wrappedTokenAddress as `0x${string}`,
				abi: erc20Abi,
				client: publicClient,
			});
			const [symbol, decimals] = await Promise.all([
				tokenContract.read.symbol(),
				tokenContract.read.decimals(),
			]);

			await eth.request({
				method: 'wallet_watchAsset',
				params: {
					type: 'ERC20',
					options: {
						address: wrappedTokenAddress,
						symbol,
						decimals,
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

			// Fast-fail if the note was already withdrawn, before the RPC-heavy
			// merkle scan (which can 429 a rate-limited endpoint). One eth_call /
			// nullifier-tree lookup; if the check can't run we fall through and
			// let the normal flow proceed.
			const spent = await checkProofSpent(selectedProof);
			if (spent.success && spent.isSpent) {
				proofStore.markProofAsUsed(selectedProof.id);
				selectedProof = { ...selectedProof, used: true };
				throw new Error(`This note has already been withdrawn on ${targetChain}.`);
			}

			// Check for same-chain transfer first
			if (sourceChain === targetChain) {
				// Same-chain private transfer (L1 -> L1 or Scroll -> Scroll)
				if (sourceChain === "Ethereum") {
					await withdrawSameChainL1();
				} else if (sourceChain === "ZKsync") {
					await withdrawSameChainScroll();
				} else {
					throw new Error(
						"Same-chain transfers are only supported on EVM chains (Ethereum, Scroll)",
					);
				}
			} else if (sourceChain === "Aztec") {
				// Aztec -> EVM (L1 or Scroll)
				if (targetChain === "ZKsync") {
					await withdrawToScroll();
				} else {
					// Aztec -> Ethereum L1
					await withdrawToL1();
				}
			} else if (sourceChain === "ZKsync") {
				// Scroll -> Aztec or L1
				if (targetChain === "Aztec") {
					await withdrawToAztec();
				} else {
					// Scroll -> L1 (requires ZK proof)
					await withdrawFromL2ToL1();
				}
			} else {
				// Ethereum L1 -> Aztec or Scroll
				if (targetChain === "Aztec") {
					await withdrawToAztec();
				} else if (targetChain === "ZKsync") {
					await withdrawToScroll();
				}
			}
		} catch (error) {
			console.error("Withdraw error:", error);

			let errorMessage = "Withdraw failed";

			if (error instanceof BridgeSyncStaleError) {
				// The withdraw can't proceed because the keeper hasn't pushed the
				// source chain's local root to L1 yet (or hasn't dispatched the
				// gigaRoot to the destination). Fire-and-forget a sync request so
				// the keeper queues the work, then surface a clear retry message.
				// Also attach the resulting opId to the proof so the progress
				// panel + poll loop pick up where this catch left off; a returning
				// user sees real progress instead of repeating this catch.
				let triggerNote = "";
				if (isBridgeKeeperEnabled) {
					try {
						const response = await triggerBridge(error.fromChainId, error.toChainId, 3);
						console.log("[WithdrawForm] BridgeSync trigger queued:", response.operationId);
						if (selectedProof) {
							proofStore.attachBridgeSync(selectedProof.id, {
								operationId: response.operationId,
								fromChainId: error.fromChainId,
								toChainId: error.toChainId,
								startedAtMs: Date.now(),
								expectedDuration: response.expectedDuration,
								lastStatus: 'pending',
							});
						}
						triggerNote =
							"\n\nWe've asked the bridge keeper to sync your commitment. " +
							"Scroll to L1 takes 30 minutes to 3 hours due to Scroll outbox finalization. " +
							"You can leave this page; the progress panel above will update automatically.";
					} catch (triggerErr) {
						console.warn("[WithdrawForm] BridgeSync trigger failed:", triggerErr);
						triggerNote =
							"\n\nWe tried to ask the bridge keeper to sync but the request failed: " +
							(triggerErr instanceof Error ? triggerErr.message : String(triggerErr)) +
							"\nPlease try again in a few minutes.";
					}
				} else {
					triggerNote =
						"\n\nBridge keeper is disabled in this build. Run `pnpm l:sync` manually, then retry.";
				}
				errorMessage = error.message + triggerNote;
			} else if (error instanceof Error) {
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
				"Aztec wallet not connected. Please connect the Aztec wallet.",
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

		completeWithdraw(txHash);
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

		const scrollChain = getEVMChain("ZKsync");
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
				"Aztec wallet not connected. Please connect the Aztec wallet.",
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
			selectedProof.commitmentData.noteNonce,
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

		completeWithdraw(mintTxHash);
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

		const scrollChain = getEVMChain("ZKsync");
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

		const { l1LocalRoot, l1LocalRootBlockNumber, gigaMerkleData } =
			await getMerkleDataForL1ToL2(l1ChainId, gigaRoot);

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

		completeWithdraw(mintTxHash);
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
	 * Withdraw from an L2 to L1.
	 * This generates a ZK proof and calls the L1WarpToad.mint()
	 */
	async function withdrawFromL2ToL1() {
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

		// Which L2 the note came from decides which adapter-slot leaf to read out of
		// the giga tree. With several L2s registered there is no single "the L2".
		const sourceL2Chain = getEVMChain(selectedProof.sourceChain);
		if (!sourceL2Chain || sourceL2Chain.role !== "L2") {
			throw new Error(
				`Note's source chain ${selectedProof.sourceChain} is not a configured L2`,
			);
		}
		const sourceL2ChainId = sourceL2Chain.chainId;

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

		// Step 3: Get GigaBridge data first - we need the L2 block recorded with
		// Scroll's local root so the burn proof can be anchored at the same
		// state. If we instead built the burn tree at the live Scroll head, any
		// burn that landed between the keeper's last push and now would advance
		// the live local root past the giga-recorded one, the merkle path
		// would hash to a different root, and the circuit would fail with
		// "Cannot satisfy constraint" mid-proof-generation.
		withdrawStep = "building-proofs";
		withdrawMessage = "Getting L2 local root from GigaBridge...";

		// chainId here is the L1 hub (where GigaBridge lives); the third arg says
		// WHICH L2's adapter-slot leaf to read out of the giga tree.
		const { l2LocalRoot, l2LocalRootBlockNumber, gigaMerkleData } =
			await getMerkleDataForL2ToL1(chainId, gigaRoot, sourceL2ChainId);

		console.log("L2 local root:", l2LocalRoot.toString());
		console.log("L2 local root block number:", l2LocalRootBlockNumber);
		console.log("Giga merkle data:", gigaMerkleData);

		// Step 4: Build the Scroll burn proof anchored at the giga-recorded
		// block. The reconstructed tree's root must equal l2LocalRoot
		// (verified inside getEvmMerkleDataForZkStack) for the circuit to be
		// satisfiable.
		withdrawMessage = "Getting Scroll burn proof...";

		const { evmMerkleData: scrollEvmMerkleData, aztecWarptoadAddress } =
			await getEvmMerkleDataForZkStack(commitment, l2LocalRootBlockNumber);

		console.log("Scroll EVM merkle data:", scrollEvmMerkleData);

		// Step 5: Prepare proof inputs
		withdrawMessage = "Preparing proof inputs...";

		// Prepare fee config for relay or self-relay
		const feeConfig: FeeConfig | undefined = useRelay && relayerInfo ? {
			feeFactor: 0n, // Altruistic relayer (no fee)
			relayerAddress: relayerInfo.relayerAddress,
			priorityFee: BigInt(relayerInfo.currentGasPrice),
			maxFee: BigInt(selectedProof.commitmentData.amount) // Allow up to full amount
		} : undefined; // undefined = use self-relay defaults

		const proofInputs = prepareProofInputsForScrollToL1(
			selectedProof.commitmentData,
			scrollEvmMerkleData,
			gigaMerkleData,
			gigaRoot,
			localRoot, // L1 local root
			l2LocalRoot, // Scroll local root
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

		completeWithdraw(mintTxHash);
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
					chainId: l1Chain.chainId.toString(),
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

		completeWithdraw(mintTxHash);

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
		const { getEvmMerkleDataForZkStack } = await import("$lib/utils/zkstack-interactions.js");

		const { evmMerkleData, aztecWarptoadAddress, localRootBlockNumber } =
			await getEvmMerkleDataForZkStack(commitment);

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
				const scrollChain = getEVMChain("ZKsync");
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
		completeWithdraw(mintTxHash);

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
				"Aztec wallet not connected. Please connect the Aztec wallet to fetch your note.",
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
				selectedProof.commitmentData?.noteNonce,
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
					chainId: l1Chain.chainId.toString(),
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

		completeWithdraw(mintTxHash);

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
				selectedProof.targetChain === "ZKsync")
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

		// Relay is supported for all EVM -> EVM flows
		// (L1 -> L1, L1 -> Scroll, Scroll -> L1, Aztec -> L1, Aztec -> Scroll)
		const evmChains = ["Ethereum", "ZKsync"];
		const targetIsEVM = evmChains.includes(selectedProof.targetChain);

		// Aztec source is always supported (if target is EVM)
		if (selectedProof.sourceChain === "Aztec" && targetIsEVM) {
			return true;
		}

		// EVM -> EVM flows (L1 <-> L1, L1 <-> Scroll, Scroll <-> Scroll)
		const sourceIsEVM = evmChains.includes(selectedProof.sourceChain);
		if (sourceIsEVM && targetIsEVM) {
			return true;
		}

		return false;
	}
</script>

<div class="space-y-3 md:h-full md:flex md:flex-col md:gap-3 md:space-y-0">
	<!-- File Upload Section -->
	<div class="space-y-2 md:flex-none">
		<div class="flex items-center gap-1.5 mb-1">
			<div class="w-0.5 h-3 bg-[var(--warp-purple)] rounded-full"></div>
			<span class="text-[0.65rem] font-semibold text-[var(--warp-purple-muted)] uppercase tracking-widest">Upload Proof</span>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept=".txt"
			onchange={handleFileUpload}
			class="hidden"
		/>
		<button
			onclick={triggerFileUpload}
			disabled={isCheckingNullifier || isWithdrawing}
			class="w-full p-3 rounded-lg border border-dashed border-[rgba(144,97,249,0.3)] bg-[var(--swamp-deep)] hover:bg-[rgba(144,97,249,0.05)] hover:border-[rgba(144,97,249,0.5)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
		>
			{#if isCheckingNullifier}
				<Loader2 class="size-4 animate-spin text-[var(--warp-purple)]" />
				<span class="text-xs text-[var(--muted-foreground)]">Checking note status...</span>
			{:else}
				<Upload class="size-4 text-[var(--warp-purple)]" />
				<span class="text-xs text-[var(--foreground)]">Upload Proof (.txt)</span>
			{/if}
		</button>

		{#if uploadError}
			<div class="flex items-center gap-2 p-2 rounded-lg bg-[rgba(255,77,77,0.1)] border border-[rgba(255,77,77,0.2)]">
				<div class="size-5 rounded-full bg-[rgba(255,77,77,0.2)] flex items-center justify-center flex-shrink-0">
					<svg class="size-2.5 text-[var(--destructive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</div>
				<p class="flex-1 min-w-0 text-xs text-[var(--foreground)] whitespace-pre-wrap max-h-32 overflow-y-auto">{uploadError}</p>
				<button
					onclick={() => (uploadError = null)}
					aria-label="Dismiss"
					title="Dismiss"
					class="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
				>
					<X class="size-3.5" />
				</button>
			</div>
		{/if}

		<!-- Bridge-sync in-progress panel. Renders whenever the selected proof
		     has an outstanding bridgeSync record that has not reached a terminal
		     state. The poll loop in $effect keeps the fields fresh; on
		     completed/noop the panel hides itself. Replaces the per-attempt
		     "wait 30min-3hrs" error message UX with a continuous progress view. -->
		{#if selectedProof?.bridgeSync && !selectedProof.used && (() => {
			const status = selectedProof.bridgeSync.lastStatus;
			return status !== 'completed' && status !== 'noop';
		})()}
			{@const sync = selectedProof.bridgeSync}
			{@const elapsedMs = Date.now() - sync.startedAtMs}
			{@const upperBoundMs = parseDurationUpperBoundMs(sync.expectedDuration)}
			{@const etaMs = upperBoundMs ? Math.max(0, sync.startedAtMs + upperBoundMs - Date.now()) : null}
			<div class="flex flex-col gap-2 p-3 rounded-lg bg-[rgba(144,97,249,0.08)] border border-[rgba(144,97,249,0.25)]">
				<div class="flex items-center gap-2">
					<div class="size-7 rounded-full bg-[rgba(144,97,249,0.2)] flex items-center justify-center flex-shrink-0">
						<Loader2 class="size-3.5 text-[var(--warp-purple)] animate-spin" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-xs font-medium text-[var(--foreground)]">
							Bridge sync in progress
						</div>
						<div class="text-[0.65rem] text-[var(--muted-foreground)]">
							{sync.fromChainId} to {sync.toChainId} - started {formatRelativeTime(elapsedMs)}
						</div>
					</div>
				</div>
				<div class="flex items-center justify-between text-[0.65rem] text-[var(--muted-foreground)]">
					<span>Expected: {sync.expectedDuration}</span>
					{#if etaMs !== null}
						<span class="font-mono">
							{#if etaMs > 0}
								~{Math.ceil(etaMs / 60_000)}m remaining
							{:else}
								Should be ready - try withdrawing
							{/if}
						</span>
					{/if}
				</div>
				{#if sync.lastStatus === 'failed' || sync.lastStatus === 'timeout'}
					<div class="text-[0.65rem] text-[var(--destructive)] whitespace-pre-wrap">
						Sync {sync.lastStatus}{sync.lastError ? ': ' + sync.lastError : ''}. Click Withdraw to retry; a new sync will be queued.
					</div>
				{:else if sync.lastError}
					<div class="text-[0.65rem] text-[var(--muted-foreground)]">
						Polling note: {sync.lastError}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Divider -->
	<div class="flex items-center gap-3 py-1 md:flex-none">
		<div class="h-px flex-1 bg-[rgba(144,97,249,0.15)]"></div>
		<span class="text-[0.65rem] text-[var(--muted-foreground)]">or select from saved</span>
		<div class="h-px flex-1 bg-[rgba(144,97,249,0.15)]"></div>
	</div>

	<!-- Proof Table -->
	<div class="space-y-2 md:flex-1 md:min-h-0 md:flex md:flex-col md:gap-2 md:space-y-0">
		<div class="flex items-center gap-1.5 md:flex-none">
			<div class="w-0.5 h-3 bg-[var(--toad-green)] rounded-full"></div>
			<span class="text-[0.65rem] font-semibold text-[var(--toad-green-muted)] uppercase tracking-widest">Saved Proofs</span>
		</div>
		<ProofTable
			onselect={handleProofSelect}
			selectedId={selectedProof?.id ?? null}
			disabled={isWithdrawing}
			details={expandedDetails}
		/>
	</div>

	{#snippet expandedDetails(_proof: Proof)}
		<!-- Selected Proof Details -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1.5">
					<div class="w-0.5 h-3 bg-[var(--toad-green)] rounded-full"></div>
					<span class="text-[0.65rem] font-semibold text-[var(--toad-green-muted)] uppercase tracking-widest">Selected Proof</span>
				</div>
				{#if !isWithdrawing}
					<button
						type="button"
						onclick={() => { selectedProof = null; }}
						class="{badgeVariants({ variant: 'default' })} !rounded-sm cursor-pointer hover:bg-primary/90"
						title="Close withdraw panel"
					>
						Close
					</button>
				{/if}
			</div>

			<div class="swamp-card-source">
				<div class="swamp-card-inner space-y-2">
					<div class="flex justify-between text-xs">
						<span class="text-[var(--muted-foreground)]">Amount</span>
						<span class="font-semibold font-mono text-[var(--foreground)]">
							{selectedProof.amount} {selectedProof.token}
						</span>
					</div>
					<div class="flex justify-between text-xs">
						<span class="text-[var(--muted-foreground)]">Route</span>
						<span class="flex items-center gap-1.5">
							<span class="px-1.5 py-0.5 rounded bg-[rgba(144,97,249,0.2)] text-[var(--warp-purple)] text-[0.65rem]">{selectedProof.sourceChain}</span>
							<span class="text-[var(--muted-foreground)]">→</span>
							<span class="px-1.5 py-0.5 rounded bg-[rgba(130,226,102,0.2)] text-[var(--toad-green)] text-[0.65rem]">{selectedProof.targetChain}</span>
						</span>
					</div>
					<div class="flex justify-between text-xs">
						<span class="text-[var(--muted-foreground)]">Wallet</span>
						<span class="flex items-center gap-1">
							{#if isTargetConnected}
								<CheckCircle2 class="size-3 text-[var(--toad-green)]" />
								<span class="text-[var(--toad-green)]">Connected</span>
							{:else}
								<AlertCircle class="size-3 text-red-500" />
								<span class="text-red-400">Not Connected</span>
							{/if}
						</span>
					</div>

					{#if isTargetConnected && needsNetworkSwitch}
						<div class="flex items-center gap-2 p-2 rounded bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)]">
							<svg class="size-3 text-[var(--eye-yellow)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<p class="text-[0.65rem] text-[var(--foreground)]">
								Switch to {selectedProof.targetChain}
							</p>
						</div>
					{/if}

					{#if !selectedProof.commitmentData}
						<div class="flex items-center gap-2 p-2 rounded bg-[rgba(255,77,77,0.1)] border border-[rgba(255,77,77,0.2)]">
							<svg class="size-3 text-[var(--destructive)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
							<p class="text-[0.65rem] text-[var(--foreground)]">
								Missing commitment, upload note file
							</p>
						</div>
					{/if}

					{#if selectedProof.used}
						<div class="flex items-center gap-2 p-2 rounded bg-[rgba(144,97,249,0.1)] border border-[rgba(144,97,249,0.2)]">
							<Shield class="size-3 text-[var(--warp-purple)] flex-shrink-0" />
							<p class="text-[0.65rem] text-[var(--muted-foreground)]">
								Already used
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Validation Messages -->
		{#if !isTargetConnected}
			<div class="flex items-center gap-2 p-3 rounded-lg bg-[rgba(130,226,102,0.1)] border border-[rgba(130,226,102,0.2)]">
				<div class="size-7 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
					<svg class="size-3.5 text-[var(--toad-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div class="text-xs">
					<span class="font-medium text-[var(--foreground)]">Connect {selectedProof.targetChain} wallet</span>
					{#if selectedProof.targetChain === "Aztec"}
						<span class="text-[var(--muted-foreground)]"> - In-browser wallet</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Auto-unwrap toggle (for L1 withdrawals, but NOT when using relay) -->
		{#if showAutoUnwrap() && !useRelay}
			<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)]">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<label for="auto-unwrap" class="cursor-pointer text-xs font-medium text-[var(--foreground)]">
							Auto-unwrap to native token
						</label>
						<p class="text-[0.65rem] text-[var(--muted-foreground)]">
							Receive native {selectedProof.token}
						</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							id="auto-unwrap"
							type="checkbox"
							bind:checked={autoUnwrap}
							class="sr-only peer"
						/>
						<div class="w-9 h-5 bg-[rgba(130,226,102,0.2)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--toad-green)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--toad-green)]"></div>
					</label>
				</div>
			</div>
		{/if}

		<!-- Relay Service Toggle (for all supported EVM flows) -->
		{#if isRelaySupported() && relayServiceAvailable && relayerInfo}
			<div class="h-px bg-[rgba(130,226,102,0.15)]"></div>

			<div class="space-y-2">
				<!-- Toggle between self-relay and gasless -->
				<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)]">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="use-relay" class="cursor-pointer text-xs font-medium text-[var(--foreground)] flex items-center gap-1.5">
								<svg class="size-3.5 text-[var(--toad-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
								</svg>
								Gasless Withdrawal
							</label>
							<p class="text-[0.65rem] text-[var(--muted-foreground)]">
								Relay service (subsidized for testnet)
							</p>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input
								id="use-relay"
								type="checkbox"
								bind:checked={useRelay}
								class="sr-only peer"
							/>
							<div class="w-9 h-5 bg-[rgba(130,226,102,0.2)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--toad-green)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--toad-green)]"></div>
						</label>
					</div>
				</div>

				<!-- Fee Info (only shown when relay enabled) -->
				{#if useRelay}
					<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)]">
						<div class="space-y-2">
							<!-- Fee Breakdown -->
							<div class="space-y-1.5 text-xs">
								<div class="flex justify-between">
									<span class="text-[var(--muted-foreground)]">Amount</span>
									<span class="font-mono text-[var(--foreground)]">
										{selectedProof.amount} {selectedProof.token}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-[var(--muted-foreground)]">Fee</span>
									<span class="text-[var(--toad-green)]">FREE (Testnet)</span>
								</div>
								<div class="flex justify-between pt-1.5 border-t border-[rgba(130,226,102,0.1)]">
									<span class="text-[var(--muted-foreground)]">You Receive</span>
									<span class="text-[var(--toad-green)]">
										{selectedProof.amount}
										<button
											onclick={addWrappedTokenToWallet}
											class="underline hover:text-[var(--toad-green-glow)] cursor-pointer ml-1"
											title="Add to MetaMask"
										>
											wrptd-{selectedProof.token}
										</button>
									</span>
								</div>
							</div>

							<div class="p-2 rounded bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.2)]">
								<p class="text-[0.65rem] text-[var(--muted-foreground)]">
									<span class="text-[var(--eye-yellow)] font-medium">Note:</span> Wrapped tokens via relay. Unwrap manually after.
								</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- RPC source toggle: only surfaces for EVM source chains, where we -->
		<!-- actually read events to build the merkle proof. -->
		{#if rpcOverrideChainId !== null}
			<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.15)]">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<label for="use-custom-rpc" class="cursor-pointer text-xs font-medium text-[var(--foreground)]">
							Use my own {selectedProof.sourceChain} RPC
						</label>
						<p class="text-[0.65rem] text-[var(--muted-foreground)]">
							{rpcOverrideHasCustom
								? (rpcOverrideEnabled ? "Reads go through your configured endpoint." : "Reads go through the warptoad proxy.")
								: "No custom endpoint saved yet."}
						</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							id="use-custom-rpc"
							type="checkbox"
							checked={rpcOverrideEnabled}
							disabled={!rpcOverrideHasCustom}
							onclick={(e) => { e.preventDefault(); toggleRpcOverride(); }}
							class="sr-only peer"
						/>
						<div class="w-9 h-5 bg-[rgba(130,226,102,0.2)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--toad-green)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--toad-green)] peer-disabled:opacity-50"></div>
					</label>
				</div>
				{#if rpcHintVisible && !rpcOverrideHasCustom}
					<p class="mt-2 text-[0.65rem] text-[var(--eye-yellow)]">
						Add a custom {selectedProof.sourceChain} RPC in the Wallet panel first.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Same-chain transfer info -->
		{#if isSameChainTransfer()}
			<div class="p-2.5 rounded-lg bg-[rgba(144,97,249,0.08)] border border-[rgba(144,97,249,0.15)]">
				<p class="text-[0.65rem] text-[var(--muted-foreground)]">
					<span class="text-[var(--warp-purple)] font-medium">Same-chain:</span> Private transfer on {selectedProof.sourceChain}. Bridge sync required.
				</p>
			</div>
		{/if}

		<!-- Withdraw Progress -->
		{#if isWithdrawing}
			<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.2)]">
				<div class="flex items-center gap-2">
					{#if withdrawStep === "complete"}
						<div class="size-7 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
							<CheckCircle2 class="size-4 text-[var(--toad-green)]" />
						</div>
					{:else}
						<div class="size-7 rounded-full bg-[rgba(130,226,102,0.1)] flex items-center justify-center flex-shrink-0">
							<Loader2 class="size-4 text-[var(--toad-green)] animate-spin" />
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-xs text-[var(--foreground)]">{withdrawMessage}</div>
						{#if withdrawStep !== "idle" && withdrawStep !== "complete"}
							<div class="text-[0.65rem] text-[var(--muted-foreground)]">
								Step {getStepNumber(withdrawStep)}
							</div>
						{/if}
					</div>
				</div>

				<!-- Progress bar -->
				{#if withdrawStep !== "idle"}
					<div class="mt-2 h-1 bg-[var(--swamp-surface)] rounded-full overflow-hidden">
						<div
							class="h-full bg-gradient-to-r from-[var(--toad-green)] to-[var(--warp-purple)] rounded-full shimmer"
							style="width: {withdrawStep === 'complete' ? 100 : (parseInt(getStepNumber(withdrawStep).split('/')[0]) / 6) * 100}%"
						></div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Withdraw Button -->
		<button
			class="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 relative overflow-hidden group cursor-pointer
				{canWithdraw || needsNetworkSwitch
					? 'btn-warp'
					: 'bg-[var(--swamp-surface)] text-[var(--muted-foreground)] cursor-not-allowed border border-[rgba(144,97,249,0.1)]'
				}"
			disabled={(!canWithdraw && !needsNetworkSwitch) || isWithdrawing}
			onclick={needsNetworkSwitch ? switchToTargetNetwork : withdraw}
		>
			<span class="relative z-10 flex items-center justify-center gap-1.5">
				{#if isWithdrawing}
					<Loader2 class="size-4 animate-spin" />
					Processing...
				{:else if needsNetworkSwitch}
					Switch to {selectedProof.targetChain}
				{:else if isAztecToL1() || isSameChainL1()}
					{#if useRelay}
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
						</svg>
						Gasless Withdraw
					{:else if autoUnwrap}
						<Download class="size-4" />
						Withdraw to Ethereum
					{:else}
						<Download class="size-4" />
						Withdraw (Wrapped)
					{/if}
				{:else}
					<Download class="size-4" />
					Withdraw to {selectedProof.targetChain}
				{/if}
			</span>
		</button>
	{/snippet}

	<!-- Success Message -->
	{#if successMessage}
		<div class="p-3 rounded-lg bg-[var(--swamp-deep)] border border-[rgba(130,226,102,0.2)]">
			<div class="flex items-center gap-2">
				<div class="size-7 rounded-full bg-[rgba(130,226,102,0.2)] flex items-center justify-center flex-shrink-0">
					<CheckCircle2 class="size-4 text-[var(--toad-green)]" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-xs font-medium text-[var(--foreground)]">{successMessage}</p>
					{#if successTxChain && successTxHash}
						<ExplorerLink chain={successTxChain} txHash={successTxHash} class="text-[0.7rem] mt-0.5" />
					{/if}
				</div>
				<button
					onclick={() => { successMessage = null; successTxHash = null; successTxChain = null; }}
					aria-label="Dismiss"
					title="Dismiss"
					class="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
				>
					<X class="size-3.5" />
				</button>
			</div>
		</div>
	{/if}
</div>
