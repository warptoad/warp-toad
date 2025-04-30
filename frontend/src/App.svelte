<script lang="ts">
  import WalletTest from './lib/WalletTest.svelte';
  import Navbar from './lib/Navbar.svelte';
  import Footer from './lib/Footer.svelte';
  import WindowManager from './lib/WindowManager.svelte';
  import Withdraw from './lib/Withdraw.svelte';
  import Deposit from './lib/Deposit.svelte';

  // App windows config array
  const appWindows = [
    {
      id: 'withdraw',
      title: 'Withdraw',
      icon: 'i-heroicons-arrow-up-on-square', // Example icon class (Heroicons, Unocss, etc.)
      component: Withdraw,
      defaultX: 400,
      defaultY: 100,
      width: 480,
      height: 600
    },
    {
      id: 'deposit',
      title: 'Deposit',
      icon: 'i-heroicons-arrow-down-on-square',
      component: Deposit,
      defaultX: 900,
      defaultY: 100,
      width: 480,
      height: 600
    }
  ];
</script>

<main class="flex flex-col h-screen">
  <Navbar/>
  <div class="flex flex-row flex-grow min-h-0">
    <!-- Sidebar (WindowManager) -->
    <WindowManager {appWindows} />
    <!-- Main content area (centered) -->
    <div class="flex-grow flex justify-center items-center">
      <div>
        <div class="text-center grid gap-2">
          <h1 class="text-base-content">warptoad svelte boilerplate</h1>
          <WalletTest/>
        </div>
      </div>
    </div>
  </div>
  <Footer/>
</main>

<!--
  Sidebar is now a left column inside the main flex layout, below Navbar and above Footer.
  No overlap with Navbar or Footer.
-->

<style>

</style>
