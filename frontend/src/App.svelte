<script lang="ts">
  import WalletTest from './lib/WalletTest.svelte';
  import Navbar from './lib/Navbar.svelte';
  import placeHolderLogo from '/logo.svg'
  import Footer from './lib/Footer.svelte';
  import Draggable from './lib/Draggable.svelte';
  import Wagmi from './lib/Wagmi.svelte';
</script>

<main class="flex flex-col h-screen p-4">
  <Draggable title={'Test Window 1'} x={500} y={100} height={33} width={33}>
    <div class="w-full h-full flex flex-col items-center justify-center">
      
      <Wagmi/>
    </div>
  </Draggable>
  <Draggable title={'Test Window 2'}>
    <div class="w-full h-full grid text-center justify-center">
      <p>*qwark*</p>
      <img src={placeHolderLogo} alt="warptoad" draggable="false">
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
