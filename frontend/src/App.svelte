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
	import AsciiNoiseBackground from "$lib/components/AsciiNoiseBackground.svelte";
	import BridgeForm from "$lib/components/BridgeForm.svelte";
	import TransferForm from "$lib/components/TransferForm.svelte";
	import WithdrawForm from "$lib/components/WithdrawForm.svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { uiStore } from "$lib/stores/ui.svelte.js";
	import { themeStore } from "$lib/stores/theme.svelte.js";
	import { isTestMode } from "$lib/config/chains.js";
	import { Menu, Wallet, Sun, Moon, Monitor } from "@lucide/svelte";
	import warptoadLogo from "$lib/../assets/warptoad-logo.svg";

	let walletDialogOpen = $state(false);
	let mobileMenuOpen = $state(false);

	function openWalletDialog() {
		walletDialogOpen = true;
		mobileMenuOpen = false;
	}

	function themeLabel() {
		return themeStore.preference === "system"
			? "System"
			: themeStore.preference === "light"
				? "Light"
				: "Dark";
	}
</script>

<div class="min-h-screen text-foreground relative">
	<!-- Animated ASCII noise background (matches warptoad.org hero) -->
	<AsciiNoiseBackground />

	<!-- Header: floating islands, no shared bar -->
	<header class="fixed top-0 left-0 right-0 z-50">
		<div class="container mx-auto px-6 py-4 max-w-[1200px]">
			<div class="flex items-center justify-between">
				<!-- Logo island -->
				<a
					href="/"
					class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border"
				>
					<img src={warptoadLogo} alt="Warptoad" class="h-7 w-7" />
					<span class="text-xl font-bold tracking-tight">
						warp<span style="color: var(--color-accent)">toad</span>
					</span>
				</a>

				<!-- Desktop right islands -->
				<div class="hidden md:flex items-center gap-2">
					{#if isTestMode}
						<div
							class="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-background/90 backdrop-blur-md border border-border text-foreground-muted"
							title="VITE_TEST_MODE=true: anvil L1 (localhost:8545) + Aztec sandbox (localhost:8080)"
						>
							<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
							Local Dev
						</div>
					{/if}

					{#if walletStore.isEVMConnected}
						<div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-background/90 backdrop-blur-md border border-border">
							<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
							<span>EVM</span>
							<span class="opacity-70">{walletStore.formatAddress(walletStore.wallets.evm)}</span>
						</div>
					{/if}
					{#if walletStore.isAztecConnected}
						<div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-background/90 backdrop-blur-md border border-border">
							<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
							<span>Aztec</span>
							<span class="opacity-70">{walletStore.formatAddress(walletStore.wallets.aztec)}</span>
						</div>
					{/if}

					<!-- Theme toggle island -->
					<button
						onclick={() => themeStore.toggle()}
						title="Theme: {themeLabel()} (click to cycle)"
						class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] flex items-center justify-center transition-colors"
					>
						{#if themeStore.preference === "system"}
							<Monitor class="size-4" />
						{:else if themeStore.preference === "light"}
							<Sun class="size-4" />
						{:else}
							<Moon class="size-4" />
						{/if}
					</button>

					<!-- Connect island -->
					<button
						onclick={openWalletDialog}
						class="cursor-pointer px-4 py-2 rounded-full text-sm font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center gap-2"
					>
						<Wallet class="size-3.5" />
						{walletStore.isBothConnected ? "Manage" : "Connect"}
					</button>
				</div>

				<!-- Mobile right islands -->
				<div class="md:hidden flex items-center gap-2">
					<button
						onclick={() => themeStore.toggle()}
						class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border flex items-center justify-center"
					>
						{#if themeStore.preference === "system"}
							<Monitor class="size-4" />
						{:else if themeStore.preference === "light"}
							<Sun class="size-4" />
						{:else}
							<Moon class="size-4" />
						{/if}
					</button>
					<button
						onclick={() => (mobileMenuOpen = true)}
						class="cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border flex items-center justify-center"
					>
						<Menu class="size-5" />
					</button>
				</div>

				<Sheet bind:open={mobileMenuOpen}>
					<SheetContent side="right" class="w-[300px] bg-background border-l border-border">
						<SheetHeader>
							<SheetTitle>Menu</SheetTitle>
						</SheetHeader>

						<div class="py-6 space-y-4">
							<div class="space-y-3">
								<h3 class="text-sm font-medium text-foreground-muted uppercase tracking-wider">
									Wallet Status
								</h3>

								{#if walletStore.isEVMConnected}
									<div class="p-3 rounded-lg border border-border">
										<div class="flex items-center gap-2 text-xs mb-1" style="color: var(--color-accent)">
											<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
											EVM Wallet
										</div>
										<div class="font-mono text-sm break-all">
											{walletStore.wallets.evm}
										</div>
									</div>
								{:else}
									<div class="p-3 border border-dashed border-border rounded-lg">
										<div class="text-sm text-foreground-muted">EVM wallet not connected</div>
									</div>
								{/if}

								{#if walletStore.isAztecConnected}
									<div class="p-3 rounded-lg border border-border">
										<div class="flex items-center gap-2 text-xs mb-1" style="color: var(--color-accent)">
											<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
											Aztec Wallet
										</div>
										<div class="font-mono text-sm break-all">
											{walletStore.wallets.aztec}
										</div>
									</div>
								{:else}
									<div class="p-3 border border-dashed border-border rounded-lg">
										<div class="text-sm text-foreground-muted">Aztec wallet not connected</div>
									</div>
								{/if}
							</div>

							<Separator />

							<Button
								class="w-full btn-warp rounded-lg py-3"
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
	<main class="relative z-10 flex items-center justify-center px-6 pt-28 pb-12 md:pt-20 md:pb-0 md:min-h-screen">
		<div class="w-full max-w-2xl rounded-xl border border-border bg-card overflow-hidden">
			<Tabs bind:value={uiStore.activeTab} class="w-full">
				<div class="border-b border-border px-2 pt-2">
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

				<div class="p-4 md:p-6 md:min-h-[640px]">
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
	</main>

	<!-- Wallet Connection Dialog -->
	<WalletConnect bind:open={walletDialogOpen} />
</div>
