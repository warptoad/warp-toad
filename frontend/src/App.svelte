<script lang="ts">
  import WalletTest from './lib/WalletTest.svelte';
  import Navbar from './lib/Navbar.svelte';
  import placeHolderLogo from '/logo.svg'
  import Footer from './lib/Footer.svelte';
  import Draggable from './lib/Draggable.svelte';
</script>

<main class="flex flex-col h-screen p-4">
  <Draggable>
    <p class="mx-8">DRAG ME!</p>
    <div class="mockup-window bg-base-300 border-2 border-white">
      <img src={placeHolderLogo} class="grid place-content-center w-40 m-8" alt="WarpToad Logo" draggable="false"/>
    </div>
  </Draggable>
  <Navbar/>
  <div class="flex-grow flex justify-center items-center">
    <div>
      <div class="text-center grid gap-2">
        <h1 class="text-base-content">warptoad svelte boilerplate</h1>
        <WalletTest/>
      </div>
    </div>
  </div>
  <Footer/>
</main>

<style>

</style>
