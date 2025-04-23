<script lang="ts">
  import placeHolderLogo from '/logo.svg'
</script>

<main class="flex items-center justify-center h-screen">
  <div class="">
    <a href="https://github.com/JossDuff/warp-toad#" target="_blank" rel="noreferrer" class="justify-center flex">
      <img src={placeHolderLogo} class="logo" alt="WarpToad Logo" />
    </a>
    <h1 class="text-base-content">warptoad svelte boilerplate</h1>
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
