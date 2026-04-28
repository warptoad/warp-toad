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
	import Footer from "$lib/components/Footer.svelte";
	import { walletStore } from "$lib/stores/wallets.svelte.js";
	import { uiStore } from "$lib/stores/ui.svelte.js";
	import { themeStore } from "$lib/stores/theme.svelte.js";
	import { isTestMode } from "$lib/config/chains.js";
	import { Menu, Wallet, Sun, Moon, Monitor, Github, ExternalLink, Mail } from "@lucide/svelte";
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
			<div class="flex items-center gap-2">
				<!-- Logo island -->
				<a
					href="/"
					class="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border"
				>
					<img src={warptoadLogo} alt="Warptoad" class="h-7 w-7" />
					<span class="text-xl font-bold tracking-tight">
						warp<span style="color: var(--color-accent)">toad</span>
					</span>
				</a>

				<!-- Desktop center: info / social pills, centered in the
				     remaining space between logo and the right cluster.
				     Each pill is a `group` whose child <span> appears on hover
				     as a custom tooltip below it. Native `title` is omitted to
				     avoid double-tooltips. aria-label still covers icon-only. -->
				<div class="hidden md:flex flex-1 items-center justify-center gap-2">
					<a
						href="https://warptoad.org"
						target="_blank"
						rel="noopener noreferrer"
						class="group relative h-9 flex items-center gap-1.5 px-3 rounded-full text-xs font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors"
					>
						<span>Learn more</span>
						<ExternalLink class="size-3" />
						<span class="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-background/95 backdrop-blur-md border border-border shadow-md transition-opacity duration-150 z-50 pointer-events-none">
							learn more about warptoad
						</span>
					</a>
					<a
						href="https://github.com/warptoad/warp-toad"
						target="_blank"
						rel="noopener noreferrer"
						class="group relative cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
						aria-label="GitHub"
					>
						<Github class="size-4" />
						<span class="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-background/95 backdrop-blur-md border border-border shadow-md transition-opacity duration-150 z-50 pointer-events-none">
							warptoad is open source
						</span>
					</a>
					<a
						href="https://x.com/warptoad_xyz"
						target="_blank"
						rel="noopener noreferrer"
						class="group relative cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
						aria-label="X"
					>
						<svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
						<span class="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-background/95 backdrop-blur-md border border-border shadow-md transition-opacity duration-150 z-50 pointer-events-none">
							follow us on x
						</span>
					</a>
					<a
						href="mailto:contact@warptoad.org"
						class="group relative cursor-pointer h-9 w-9 rounded-full bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center justify-center"
						aria-label="Email"
					>
						<Mail class="size-4" />
						<span class="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap bg-background/95 backdrop-blur-md border border-border shadow-md transition-opacity duration-150 z-50 pointer-events-none">
							found a bug or want to chat?
						</span>
					</a>
				</div>

				<!-- Desktop right cluster: TestMode, theme, Connect/Manage -->
				<div class="hidden md:flex items-center gap-2 shrink-0">
					{#if isTestMode}
						<div
							class="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-background/90 backdrop-blur-md border border-border text-foreground-muted"
							title="VITE_TEST_MODE=true: anvil L1 (localhost:8545) + Aztec sandbox (localhost:8080)"
						>
							<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
							Local Dev
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

					<!-- Connect / Manage island. Two dots stacked vertically after
					     the label indicate connection state (top = EVM, bottom =
					     Aztec); accent = connected, muted = not connected. Wallet
					     detail (addresses) lives inside the dialog. -->
					<button
						onclick={openWalletDialog}
						class="cursor-pointer px-4 py-2 rounded-full text-sm font-medium bg-background/90 backdrop-blur-md border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors flex items-center gap-2"
						title="EVM: {walletStore.isEVMConnected ? 'connected' : 'not connected'} · Aztec: {walletStore.isAztecConnected ? 'connected' : 'not connected'}"
					>
						{(walletStore.isEVMConnected || walletStore.isAztecConnected) ? "Manage" : "Connect"}
						<Wallet class="size-3.5" />
						<span class="flex flex-col items-center gap-0.5">
							<span class="w-1.5 h-1.5 rounded-full {walletStore.isEVMConnected ? 'bg-[color:var(--color-accent)]' : 'bg-border'}" aria-label="EVM {walletStore.isEVMConnected ? 'connected' : 'not connected'}"></span>
							<span class="w-1.5 h-1.5 rounded-full {walletStore.isAztecConnected ? 'bg-[color:var(--color-accent)]' : 'bg-border'}" aria-label="Aztec {walletStore.isAztecConnected ? 'connected' : 'not connected'}"></span>
						</span>
					</button>
				</div>

				<!-- Mobile right islands. ml-auto pushes them to the end since
				     the parent no longer uses justify-between. -->
				<div class="md:hidden flex items-center gap-2 ml-auto">
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
					<SheetContent side="right" class="w-[320px] bg-background border-l border-border p-0 flex flex-col gap-0">
						<SheetHeader class="px-6 pt-6 pb-4 border-b border-border">
							<SheetTitle class="flex items-center gap-2 text-lg font-bold tracking-tight">
								<img src={warptoadLogo} alt="" class="h-7 w-7" />
								warp<span style="color: var(--color-accent)">toad</span>
							</SheetTitle>
						</SheetHeader>

						<div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
							<!-- Wallet status section -->
							<section class="space-y-3">
								<h3 class="text-xs font-medium text-muted-foreground uppercase tracking-widest">
									Wallets
								</h3>

								<div class="space-y-2">
									{#if walletStore.isEVMConnected}
										<div class="p-3 rounded-lg border border-border">
											<div class="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider mb-1.5" style="color: var(--color-accent)">
												<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
												EVM
											</div>
											<div class="font-mono text-xs break-all text-foreground/80">
												{walletStore.wallets.evm}
											</div>
										</div>
									{:else}
										<div class="p-3 border border-dashed border-border rounded-lg">
											<div class="text-xs text-muted-foreground">EVM wallet not connected</div>
										</div>
									{/if}

									{#if walletStore.isAztecConnected}
										<div class="p-3 rounded-lg border border-border">
											<div class="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider mb-1.5" style="color: var(--color-accent)">
												<div class="w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></div>
												Aztec
											</div>
											<div class="font-mono text-xs break-all text-foreground/80">
												{walletStore.wallets.aztec}
											</div>
										</div>
									{:else}
										<div class="p-3 border border-dashed border-border rounded-lg">
											<div class="text-xs text-muted-foreground">Aztec wallet not connected</div>
										</div>
									{/if}
								</div>
							</section>

							<!-- Theme section -->
							<section class="space-y-3">
								<h3 class="text-xs font-medium text-muted-foreground uppercase tracking-widest">
									Appearance
								</h3>
								<div class="grid grid-cols-3 gap-2">
									<button
										onclick={() => themeStore.setPreference("system")}
										class="cursor-pointer flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors {themeStore.preference === 'system' ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-border text-muted-foreground'}"
									>
										<Monitor class="size-4" />
										System
									</button>
									<button
										onclick={() => themeStore.setPreference("light")}
										class="cursor-pointer flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors {themeStore.preference === 'light' ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-border text-muted-foreground'}"
									>
										<Sun class="size-4" />
										Light
									</button>
									<button
										onclick={() => themeStore.setPreference("dark")}
										class="cursor-pointer flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors {themeStore.preference === 'dark' ? 'border-[color:var(--color-accent)] text-[color:var(--color-accent)]' : 'border-border text-muted-foreground'}"
									>
										<Moon class="size-4" />
										Dark
									</button>
								</div>
							</section>

							<!-- Mobile drawer footer: navbar pill mirrors + donate section
							     (the inline donate card is desktop-only). -->
							<Footer variant="drawer" />
						</div>

						<!-- Footer action -->
						<div class="px-6 pb-6 pt-4 border-t border-border">
							<button
								onclick={openWalletDialog}
								class="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-medium border border-border hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors"
							>
								<Wallet class="size-4" />
								{walletStore.isBothConnected ? "Manage Wallets" : "Connect Wallets"}
							</button>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="relative z-10 flex flex-col items-stretch md:items-center justify-center min-h-[100dvh] px-4 pt-24 pb-6 md:px-6 md:pt-20 md:pb-6">
		<Tabs bind:value={uiStore.activeTab} class="w-full max-w-2xl mx-auto flex flex-col flex-1 md:flex-none">
			<div class="w-full rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1 md:flex-none">
				<!-- Mobile: tab islands inside the card -->
				<div class="md:hidden p-3 border-b border-border">
					<TabsList class="w-full bg-transparent gap-2 h-auto p-0 flex">
						<TabsTrigger
							value="transfer"
							class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-background border border-border data-[state=active]:border-[color:var(--color-accent)] data-[state=active]:text-[color:var(--color-accent)] transition-colors"
						>
							<svg class="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 5v14M5 12l7-7 7 7" />
							</svg>
							Transfer
						</TabsTrigger>
						<TabsTrigger
							value="bridge"
							class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-background border border-border data-[state=active]:border-[color:var(--color-accent)] data-[state=active]:text-[color:var(--color-accent)] transition-colors"
						>
							<svg class="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
							</svg>
							Bridge
						</TabsTrigger>
						<TabsTrigger
							value="withdraw"
							class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-full text-sm font-medium bg-background border border-border data-[state=active]:border-[color:var(--color-accent)] data-[state=active]:text-[color:var(--color-accent)] transition-colors"
						>
							<svg class="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M12 5v14M5 12l7 7 7-7" />
							</svg>
							Withdraw
						</TabsTrigger>
					</TabsList>
				</div>

				<!-- Desktop: in-card underline tabs -->
				<div class="hidden md:block border-b border-border px-2 pt-2">
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

				<div class="p-4 md:p-6 flex-1 overflow-y-auto md:flex-none md:h-[640px] md:overflow-hidden md:flex md:flex-col">
					<TabsContent value="transfer" class="mt-0 focus-visible:outline-none focus-visible:ring-0 md:flex-1 md:min-h-0">
						<TransferForm />
					</TabsContent>

					<TabsContent value="bridge" class="mt-0 focus-visible:outline-none focus-visible:ring-0 md:flex-1 md:min-h-0">
						<BridgeForm />
					</TabsContent>

					<TabsContent value="withdraw" class="mt-0 focus-visible:outline-none focus-visible:ring-0 md:flex-1 md:min-h-0">
						<WithdrawForm />
					</TabsContent>
				</div>
			</div>
		</Tabs>

		<!-- Donate card: same width as the form card, sits below it on every viewport. -->
		<Footer variant="donate-card" />
	</main>

	<!-- Wallet Connection Dialog -->
	<WalletConnect bind:open={walletDialogOpen} />
</div>
