<script>
    import { ethers } from 'ethers';

    async function connectWallet() {
  if (!window.ethereum) throw new Error('No crypto wallet found');

  await window.ethereum.request({ method: 'eth_requestAccounts' });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);

  return {
    address,
    balance: ethers.formatEther(balance)
  };
}
</script>

<div>
    <p>WAGMI</p>
    <button class="btn btn-accent" onclick={connectWallet}>CONNECT EVM</button>
</div>