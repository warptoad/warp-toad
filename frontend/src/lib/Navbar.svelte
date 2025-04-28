<script lang="ts">
    import ConnectWalletButton from "./ConnectWalletButton.svelte";
    import placeHolderLogo from '/logo.svg'

</script>


<div class="navbar">
    <div class="navbar-start">
      <a class="btn btn-ghost text-4xl gap-4" href="/#">
        Warptoad
        <img src={placeHolderLogo} class="logo" alt="WarpToad Logo" width="32" />
    </a>
    </div>
    <div class="navbar-end">
        <ConnectWalletButton/>
    </div>
  </div>