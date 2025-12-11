<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Tabs,
		TabsContent,
		TabsList,
		TabsTrigger,
	} from "$lib/components/ui/tabs/index.js";
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetTrigger,
	} from "$lib/components/ui/sheet/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import WalletConnect from "$lib/components/WalletConnect.svelte";
	import BridgeForm from "$lib/components/BridgeForm.svelte";
	import TransferForm from "$lib/components/TransferForm.svelte";
	import WithdrawForm from "$lib/components/WithdrawForm.svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { uiStore } from "$lib/stores/ui.svelte.js";
	import { Menu, Wallet } from "@lucide/svelte";
	import warptoadLogo from "$lib/../assets/warptoad-logo.svg";

	let walletDialogOpen = $state(false);
	let mobileMenuOpen = $state(false);

	function openWalletDialog() {
		walletDialogOpen = true;
		mobileMenuOpen = false;
	}
</script>

<div class="dark min-h-screen bg-background text-foreground">
	<!-- Header -->
	<header class="border-b">
		<div class="container mx-auto px-4 py-3 md:py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<img src={warptoadLogo} alt="Warptoad" class="h-10 w-10" />
					<span class="text-xl md:text-2xl font-bold">Warptoad</span>
				</div>

				<!-- Desktop: Wallet badges + button -->
				<div class="hidden md:flex items-center gap-3">
					{#if walletStore.isEVMConnected}
						<Badge variant="secondary" class="font-mono text-xs">
							EVM: {walletStore.formatAddress(
								walletStore.wallets.evm,
							)}
						</Badge>
					{/if}
					{#if walletStore.isAztecConnected}
						<Badge variant="secondary" class="font-mono text-xs">
							Aztec: {walletStore.formatAddress(
								walletStore.wallets.aztec,
							)}
						</Badge>
					{/if}
					<Button onclick={openWalletDialog}>
						{walletStore.isBothConnected
							? "Manage Wallets"
							: "Connect Wallet"}
					</Button>
				</div>

				<!-- Mobile: Hamburger menu -->
				<div class="md:hidden">
					<Button
						size="icon"
						variant="ghost"
						onclick={() => (mobileMenuOpen = true)}
					>
						<Menu class="size-5" />
					</Button>
				</div>

				<Sheet bind:open={mobileMenuOpen}>
					<SheetContent side="right" class="w-[300px]">
						<SheetHeader>
							<SheetTitle>Menu</SheetTitle>
						</SheetHeader>

						<div class="py-6 space-y-4">
							<!-- Wallet Status -->
							<div class="space-y-3">
								<h3
									class="text-sm font-semibold text-muted-foreground"
								>
									Wallet Status
								</h3>

								{#if walletStore.isEVMConnected}
									<div class="p-3 border rounded-lg">
										<div
											class="text-xs text-muted-foreground mb-1"
										>
											EVM Wallet
										</div>
										<div
											class="font-mono text-sm break-all"
										>
											{walletStore.wallets.evm}
										</div>
									</div>
								{:else}
									<div
										class="p-3 border rounded-lg border-dashed"
									>
										<div
											class="text-sm text-muted-foreground"
										>
											EVM wallet not connected
										</div>
									</div>
								{/if}

								{#if walletStore.isAztecConnected}
									<div class="p-3 border rounded-lg">
										<div
											class="text-xs text-muted-foreground mb-1"
										>
											Aztec Wallet
										</div>
										<div
											class="font-mono text-sm break-all"
										>
											{walletStore.wallets.aztec}
										</div>
									</div>
								{:else}
									<div
										class="p-3 border rounded-lg border-dashed"
									>
										<div
											class="text-sm text-muted-foreground"
										>
											Aztec wallet not connected
										</div>
									</div>
								{/if}
							</div>

							<Separator />

							<!-- Connect Button -->
							<Button class="w-full" onclick={openWalletDialog}>
								<Wallet class="size-4 mr-2" />
								{walletStore.isBothConnected
									? "Manage Wallets"
									: "Connect Wallets"}
							</Button>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
		<Tabs bind:value={uiStore.activeTab} class="w-full">
			<TabsList class="grid w-full grid-cols-3 mb-6 md:mb-8">
				<TabsTrigger value="transfer" class="text-sm md:text-base">
					Transfer
				</TabsTrigger>
				<TabsTrigger value="bridge" class="text-sm md:text-base">
					Bridge
				</TabsTrigger>
				<TabsTrigger value="withdraw" class="text-sm md:text-base">
					Withdraw
				</TabsTrigger>
			</TabsList>

			<TabsContent value="transfer">
				<TransferForm />
			</TabsContent>

			<TabsContent value="bridge">
				<BridgeForm />
			</TabsContent>

			<TabsContent value="withdraw">
				<WithdrawForm />
			</TabsContent>
		</Tabs>
	</main>

	<!-- Wallet Connection Dialog -->
	<WalletConnect bind:open={walletDialogOpen} />
</div>
