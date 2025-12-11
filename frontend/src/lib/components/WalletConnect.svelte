<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Alert, AlertDescription } from "$lib/components/ui/alert/index.js";
	import {
		Wallet,
		Shield,
		Loader2,
		AlertCircle,
		CheckCircle2,
	} from "@lucide/svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { balanceStore } from "$lib/stores/balances.svelte.js";
	import {
		mintFreeTokens,
		triggerBridgeSync,
	} from "$lib/utils/evm-interactions";
	import { getChainId } from "$lib/utils/evm-wallet";
	import { getAztecWarpToadBalance } from "$lib/utils/aztec-interactions";
	import { getWalletInstance } from "$lib/utils/aztec-wallet";

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	let isSyncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncSuccess = $state<string | null>(null);

	async function handleTriggerBridgeSync() {
		isSyncing = true;
		syncError = null;
		syncSuccess = null;

		try {
			const chainId = await getChainId();
			if (!chainId) throw new Error("Could not determine chain ID");

			const result = await triggerBridgeSync(chainId);
			syncSuccess = `Bridge synced! GigaRoot updated: ${result.updateGigaRootTxHash.slice(0, 10)}...`;
		} catch (error) {
			console.error("Bridge sync error:", error);
			syncError =
				error instanceof Error
					? error.message
					: "Failed to sync bridge";
		} finally {
			isSyncing = false;
		}
	}

	async function handleConnectEVM() {
		try {
			await walletStore.connectEVM();
		} catch (error) {
			// Error is already stored in walletStore.error
			console.error("Connection error:", error);
		}
	}

	function handleDisconnectEVM() {
		walletStore.disconnectEVM();
	}

	async function handleConnectAztec() {
		try {
			await walletStore.connectAztec();
		} catch (error) {
			// Error is already stored in walletStore.aztecError
			console.error("Aztec connection error:", error);
		}
	}

	async function handleDisconnectAztec() {
		await walletStore.disconnectAztec();
	}

	async function handleCheckAztecBalance() {
		const wallet = getWalletInstance();
		if (!wallet) {
			console.error("Aztec wallet not connected");
			return;
		}

		try {
			const balance = await getAztecWarpToadBalance(wallet);
			console.log("Aztec WarpToad Balance:", balance.toString());
		} catch (error) {
			console.error("Failed to get Aztec balance:", error);
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-[600px]">
		<DialogHeader>
			<DialogTitle>Connect Wallets</DialogTitle>
		</DialogHeader>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
			<!-- EVM Wallet Section -->
			<div
				class="flex flex-col items-center space-y-4 p-4 border rounded-lg"
			>
				<Wallet class="size-12" />
				<h3 class="text-lg font-semibold">MetaMask / EVM</h3>

				{#if walletStore.isEVMConnected}
					<div class="flex flex-col items-center gap-2 w-full">
						<Badge variant="default" class="font-mono text-xs">
							{walletStore.formatAddress(walletStore.wallets.evm)}
						</Badge>

						{#if walletStore.chainName}
							<div
								class="flex items-center gap-1 text-xs text-muted-foreground"
							>
								<CheckCircle2 class="size-3" />
								<span>{walletStore.chainName}</span>
							</div>
						{/if}
						<Button
							onclick={async () => {
								const currentChain = walletStore.chainName;
								if (currentChain && currentChain !== 'Aztec') {
									await mintFreeTokens("USDC", currentChain, 100);
									await balanceStore.refresh();
								}
							}}
							disabled={!walletStore.chainName || walletStore.chainName === 'Aztec'}
						>
							mint 100 test USDC
						</Button>
					</div>

					<Button
						variant="outline"
						onclick={handleDisconnectEVM}
						disabled={walletStore.isConnecting}
					>
						Disconnect
					</Button>
				{:else if !walletStore.isWalletInstalled}
					<div class="text-sm text-center text-muted-foreground">
						No wallet detected. Please install <a
							href="https://metamask.io/download/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline">MetaMask</a
						>
					</div>
				{:else}
					<Button
						variant="outline"
						onclick={handleConnectEVM}
						disabled={walletStore.isConnecting}
					>
						{#if walletStore.isConnecting}
							<Loader2 class="size-4 mr-2 animate-spin" />
							Connecting...
						{:else}
							Connect MetaMask
						{/if}
					</Button>
				{/if}
			</div>

			<!-- Aztec Wallet Section -->
			<div
				class="flex flex-col items-center space-y-4 p-4 border rounded-lg"
			>
				<Shield class="size-12" />
				<h3 class="text-lg font-semibold">Azguard / Aztec</h3>

				{#if walletStore.isAztecConnected}
					<div class="flex flex-col items-center gap-2 w-full">
						<Badge variant="default" class="font-mono text-xs">
							{walletStore.formatAddress(
								walletStore.wallets.aztec,
							)}
						</Badge>

						<div
							class="flex items-center gap-1 text-xs text-muted-foreground"
						>
							<CheckCircle2 class="size-3" />
							<span>Connected</span>
						</div>
					</div>

					<Button
						variant="outline"
						onclick={handleDisconnectAztec}
						disabled={walletStore.isConnectingAztec}
					>
						Disconnect
					</Button>
				{:else if !walletStore.isAzguardInstalled}
					<div class="text-sm text-center text-muted-foreground">
						No Azguard wallet detected. Please install <a
							href="https://azguard.io"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline"
							>Azguard Wallet</a
						>
					</div>
				{:else}
					<Button
						variant="outline"
						onclick={handleConnectAztec}
						disabled={walletStore.isConnectingAztec}
					>
						{#if walletStore.isConnectingAztec}
							<Loader2 class="size-4 mr-2 animate-spin" />
							Connecting...
						{:else}
							Connect Azguard
						{/if}
					</Button>
				{/if}
			</div>
		</div>

		{#if walletStore.error}
			<Alert variant="destructive">
				<AlertCircle class="size-4" />
				<AlertDescription>
					{walletStore.error}
				</AlertDescription>
			</Alert>
		{/if}

		{#if walletStore.aztecError}
			<Alert variant="destructive">
				<AlertCircle class="size-4" />
				<AlertDescription>
					{walletStore.aztecError}
				</AlertDescription>
			</Alert>
		{/if}

		{#if syncError}
			<Alert variant="destructive">
				<AlertCircle class="size-4" />
				<AlertDescription>
					{syncError}
				</AlertDescription>
			</Alert>
		{/if}

		{#if syncSuccess}
			<Alert>
				<CheckCircle2 class="size-4" />
				<AlertDescription>
					{syncSuccess}
				</AlertDescription>
			</Alert>
		{/if}

		<Separator />

		<div class="text-sm text-muted-foreground text-center">
			Connect both wallets to use the bridge
		</div>
	</DialogContent>
</Dialog>
