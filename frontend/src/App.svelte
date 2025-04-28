<script lang="ts">
  import WalletTest from './lib/WalletTest.svelte';
  import Navbar from './lib/Navbar.svelte';
  import placeHolderLogo from '/logo.svg'
</script>

<main class="h-screen p-4">
  <Navbar/>
  <div>
    <div class="text-center grid gap-2">
      <a href="https://github.com/JossDuff/warp-toad#" target="_blank" rel="noreferrer" class="justify-center flex">
        <img src={placeHolderLogo} class="logo" alt="WarpToad Logo" />
      </a>
      <h1 class="text-base-content">warptoad svelte boilerplate</h1>
      <WalletTest/>
    </div>
  </div>
</main>

<style>

  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em cyan);
  }

</style>
