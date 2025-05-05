<script lang="ts">
  import ApplicationContainer from "./lib/applications/ApplicationContainer.svelte";
  import Navbar from "./lib/Navbar.svelte";
  import placeHolderLogo from "/logo.svg";
  import Footer from "./lib/Footer.svelte";
  import Draggable from "./lib/Draggable.svelte";
  import DepositApplication from "./lib/applications/DepositApplication.svelte";

  let isDepositOpen = true;
  let isWithdrawOpen = false;
  let isFaqOpen = false;
</script>

<main class="flex flex-col h-screen p-4">
  <Draggable
    title={"FAQ"}
    x={window.innerWidth / 2}
    y={window.innerHeight / 2}
    height={40}
    width={40}
    bind:isVisible={isFaqOpen}
  >
    <div class="w-full h-full grid text-center justify-center">
      <p>*qwark* FAQ</p>
      <img src={placeHolderLogo} alt="warptoad" draggable="false" />
    </div>
  </Draggable>
  <Draggable
    title={"Deposit"}
    x={0}
    y={window.innerHeight / 10}
    height={50}
    width={50}
    bind:isVisible={isDepositOpen}
  >
    <DepositApplication />
  </Draggable>
  <Draggable
    title={"Withdraw"}
    x={window.innerWidth / 2}
    y={window.innerHeight / 5}
    height={50}
    width={50}
    bind:isVisible={isWithdrawOpen}
  >
    <div class="w-full h-full grid text-center justify-center">
      <p>*qwark*</p>
      <img src={placeHolderLogo} alt="warptoad" draggable="false" />
    </div>
  </Draggable>
  <Navbar />
  <div class="flex-grow flex justify-center items-center">
    <ApplicationContainer
      bind:depositOpen={isDepositOpen}
      bind:withdrawOpen={isWithdrawOpen}
      bind:faqOpen={isFaqOpen}
    />
  </div>
  <Footer />
</main>

<style>
</style>
