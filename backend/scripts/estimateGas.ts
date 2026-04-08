import { ArgumentParser } from 'argparse';
import fs from "fs/promises";
import { type Address, type WalletClient, type PublicClient, getContract, formatUnits, getAddress } from "viem";
import { hashCommitment, hashPreCommitment } from '../lib/hashing';
import { createProof, getProofInputs } from '../lib/proving';
import os from 'os';

// Minimal viem ABI for the helpers below
const USDCOIN_ABI = [
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "getFreeShit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
] as const;

const L1WARPTOAD_NATIVE_TOKEN_ABI = [
    { type: "function", name: "nativeToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

// /**
//  * assumes you have at least 1n wei of the wrapped token token
//  * @param signer
//  * @param warpToadAddress
//  */
// async function estimateMintGas(...) { ... }  // see git history; relied on ethers + typechain

async function getFreeMoney(walletClient: WalletClient, publicClient: PublicClient, USDcoinAddress: Address, amount: bigint) {
    const USDC = getContract({ address: USDcoinAddress, abi: USDCOIN_ABI, client: { public: publicClient, wallet: walletClient } });
    console.log(`trying to mint ${formatUnits(amount, await USDC.read.decimals())} ${await USDC.read.symbol()} function of native token`)
    // TODO just rename to mint lmao
    const hash = await (USDC.write as any).getFreeShit([amount]);
    await publicClient.waitForTransactionReceipt({ hash });
}

async function getBalance(walletClient: WalletClient, publicClient: PublicClient, USDcoinAddress: Address) {
    const USDC = getContract({ address: USDcoinAddress, abi: USDCOIN_ABI, client: publicClient });
    return await USDC.read.balanceOf([walletClient.account!.address]);
}

async function getNativeTokenAddress(publicClient: PublicClient, warpToadAddress: Address): Promise<Address> {
    const warpToad = getContract({ address: warpToadAddress, abi: L1WARPTOAD_NATIVE_TOKEN_ABI, client: publicClient });
    return getAddress(await warpToad.read.nativeToken());
}

// async function main() {
//     const parser = new ArgumentParser({
//         description: 'TODO',
//         usage: ``
//     });
//     parser.add_argument("-d", "--deployedAddressesJson", {help: 'ex ignition/deployments/chain-31337/deployed_addresses.json'})
//     parser.add_argument('-p', '--privatekey', { help: 'privatekey used to initiated burn', default:"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", required: false, type: 'str' });
//     parser.add_argument('-r', '--rpc', { help: 'url to rpc ex: http:localhost:8545',default:"http:localhost:8545", required: false, type: 'str' });
//     // ...
// }

// if (require.main === module) {
//     main()
// }
