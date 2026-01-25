<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
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
	} from "$lib/components/ui/sheet/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import WalletConnect from "$lib/components/WalletConnect.svelte";
	import BridgeForm from "$lib/components/BridgeForm.svelte";
	import TransferForm from "$lib/components/TransferForm.svelte";
	import WithdrawForm from "$lib/components/WithdrawForm.svelte";
	import SwampBackground from "$lib/components/SwampBackground.svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { uiStore } from "$lib/stores/ui.svelte.js";
	import { Menu, Wallet, Zap } from "@lucide/svelte";
	import warptoadLogo from "$lib/../assets/warptoad-logo.svg";

	let walletDialogOpen = $state(false);
	let mobileMenuOpen = $state(false);

	function openWalletDialog() {
		walletDialogOpen = true;
		mobileMenuOpen = false;
	}
</script>

<div class="dark min-h-screen text-foreground relative">
	<!-- Atmospheric background -->
	<SwampBackground />

	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-[rgba(130,226,102,0.1)] backdrop-blur-xl bg-[rgba(5,7,8,0.8)]">
		<div class="container mx-auto px-4 py-3 md:py-4">
			<div class="flex items-center justify-between">
				<!-- Logo with breathing animation -->
				<div class="flex items-center gap-3 group cursor-pointer">
					<div class="relative">
						<img
							src={warptoadLogo}
							alt="Warptoad"
							class="h-10 w-10 md:h-12 md:w-12 transition-transform duration-500 group-hover:scale-110"
						/>
						<!-- Glow effect behind logo -->
						<div class="absolute inset-0 -z-10 blur-xl opacity-50 group-hover:opacity-80 transition-opacity">
							<img src={warptoadLogo} alt="" class="h-10 w-10 md:h-12 md:w-12" />
						</div>
					</div>
					<div class="flex flex-col">
						<span class="text-xl md:text-2xl font-bold tracking-tight text-brand">
							Warptoad
						</span>
						<span class="text-[10px] md:text-xs text-[var(--muted-foreground)] tracking-widest uppercase">
							Privacy Bridge
						</span>
					</div>
				</div>

				<!-- Desktop: Wallet badges + button -->
				<div class="hidden md:flex items-center gap-3">
					{#if walletStore.isEVMConnected}
						<div class="badge-glow flex items-center gap-2">
							<div class="w-2 h-2 rounded-full bg-[var(--toad-green)] animate-pulse"></div>
							<span>EVM</span>
							<span class="opacity-70">{walletStore.formatAddress(walletStore.wallets.evm)}</span>
						</div>
					{/if}
					{#if walletStore.isAztecConnected}
						<div class="badge-purple flex items-center gap-2">
							<div class="w-2 h-2 rounded-full bg-[var(--warp-purple)] animate-pulse"></div>
							<span>Aztec</span>
							<span class="opacity-70">{walletStore.formatAddress(walletStore.wallets.aztec)}</span>
						</div>
					{/if}
					<button
						onclick={openWalletDialog}
						class="cursor-pointer px-4 py-2 rounded-full text-sm font-medium border border-[rgba(130,226,102,0.3)] text-[var(--foreground)] hover:border-[var(--toad-green)] hover:text-[var(--toad-green)] transition-all flex items-center gap-2"
					>
						<Wallet class="size-3.5" />
						{walletStore.isBothConnected ? "Manage" : "Connect"}
					</button>
				</div>

				<!-- Mobile: Hamburger menu -->
				<div class="md:hidden">
					<Button
						size="icon"
						variant="ghost"
						onclick={() => (mobileMenuOpen = true)}
						class="hover:bg-[rgba(130,226,102,0.1)] text-[var(--toad-green)]"
					>
						<Menu class="size-5" />
					</Button>
				</div>

				<Sheet bind:open={mobileMenuOpen}>
					<SheetContent side="right" class="w-[300px] bg-[var(--swamp-card)] border-l border-[rgba(130,226,102,0.15)]">
						<SheetHeader>
							<SheetTitle class="text-brand">Menu</SheetTitle>
						</SheetHeader>

						<div class="py-6 space-y-4">
							<!-- Wallet Status -->
							<div class="space-y-3">
								<h3 class="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
									Wallet Status
								</h3>

								{#if walletStore.isEVMConnected}
									<div class="p-3 glass-card rounded-lg">
										<div class="flex items-center gap-2 text-xs text-[var(--toad-green)] mb-1">
											<div class="w-2 h-2 rounded-full bg-[var(--toad-green)] animate-pulse"></div>
											EVM Wallet
										</div>
										<div class="font-mono text-sm break-all text-[var(--foreground)]">
											{walletStore.wallets.evm}
										</div>
									</div>
								{:else}
									<div class="p-3 border border-dashed border-[rgba(130,226,102,0.2)] rounded-lg">
										<div class="text-sm text-[var(--muted-foreground)]">
											EVM wallet not connected
										</div>
									</div>
								{/if}

								{#if walletStore.isAztecConnected}
									<div class="p-3 glass-card-purple rounded-lg">
										<div class="flex items-center gap-2 text-xs text-[var(--warp-purple)] mb-1">
											<div class="w-2 h-2 rounded-full bg-[var(--warp-purple)] animate-pulse"></div>
											Aztec Wallet
										</div>
										<div class="font-mono text-sm break-all text-[var(--foreground)]">
											{walletStore.wallets.aztec}
										</div>
									</div>
								{:else}
									<div class="p-3 border border-dashed border-[rgba(144,97,249,0.2)] rounded-lg">
										<div class="text-sm text-[var(--muted-foreground)]">
											Aztec wallet not connected
										</div>
									</div>
								{/if}
							</div>

							<Separator class="bg-[rgba(130,226,102,0.1)]" />

							<!-- Connect Button -->
							<Button
								class="w-full btn-warp rounded-xl py-3"
								onclick={openWalletDialog}
							>
								<Wallet class="size-4 mr-2" />
								{walletStore.isBothConnected ? "Manage Wallets" : "Connect Wallets"}
							</Button>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-8 md:py-12 max-w-2xl relative z-10">
		<!-- Main card container with glassmorphism -->
		<div class="glass-card rounded-2xl p-1 animate-glow-pulse">
			<div class="bg-[var(--swamp-card)] rounded-xl overflow-hidden">
				<Tabs bind:value={uiStore.activeTab} class="w-full">
					<!-- Custom styled tabs -->
					<div class="border-b border-[rgba(130,226,102,0.1)] px-2 pt-2">
						<TabsList class="w-full bg-transparent gap-1 h-auto p-0">
							<TabsTrigger
								value="transfer"
								class="tab-lily flex-1 data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent rounded-t-lg"
							>
								<svg class="size-4 mr-2 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M12 5v14M5 12l7-7 7 7" />
								</svg>
								Transfer
							</TabsTrigger>
							<TabsTrigger
								value="bridge"
								class="tab-lily flex-1 data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent rounded-t-lg"
							>
								<svg class="size-4 mr-2 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
								</svg>
								Bridge
							</TabsTrigger>
							<TabsTrigger
								value="withdraw"
								class="tab-lily flex-1 data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent rounded-t-lg"
							>
								<svg class="size-4 mr-2 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 5v14M5 12l7 7 7-7" />
								</svg>
								Withdraw
							</TabsTrigger>
						</TabsList>
					</div>

					<div class="p-4 md:p-6">
						<TabsContent value="transfer" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
							<TransferForm />
						</TabsContent>

						<TabsContent value="bridge" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
							<BridgeForm />
						</TabsContent>

						<TabsContent value="withdraw" class="mt-0 focus-visible:outline-none focus-visible:ring-0">
							<WithdrawForm />
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>

		<!-- Powered by badge -->
		<div class="mt-6 flex justify-center">
			<div class="flex items-center gap-2 text-xs text-[var(--muted-foreground)] opacity-60">
				<span>Powered by</span>
				<span class="font-semibold text-[var(--warp-purple)]">Aztec</span>
				<span>&</span>
				<span class="font-semibold text-[var(--toad-green)]">Noir</span>
			</div>
		</div>
	</main>

	<!-- Wallet Connection Dialog -->
	<WalletConnect bind:open={walletDialogOpen} />
</div>
