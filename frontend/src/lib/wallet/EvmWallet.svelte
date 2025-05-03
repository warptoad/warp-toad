<script lang="ts">
    import { connectMetamaskWallet, evmWalletStore, isWalletConnected } from '../../stores/walletStore';
  </script>
  
  <div class="h-full flex flex-col gap-4">
    <p>EVM Wallets</p>
    <div class="h-full flex justify-between">
        <button
          class="btn btn-ghost btn-outline border-[rgba(255,255,255,.25)] w-full flex items-center gap-2 justify-start px-2 py-6"
          on:click={connectMetamaskWallet}
        >
          <div class="bg-white p-1 rounded-md">
            <img
              src="./logos/wallets/metamask.svg"
              alt="metamask wallet logo"
              class="size-[28px]"
            />
          </div>
          Metamask
        </button>

    </div>
  </div>
  