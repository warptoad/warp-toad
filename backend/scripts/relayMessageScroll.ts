import { ArgumentParser } from "argparse";
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA, SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA, SEPOLIA_CHAINID } from "../lib/constants";
import hre from "hardhat";
import { claimL1WithdrawScroll, getClaimDataScroll } from "../lib/bridging";
import { evmDeployments } from "./deployment";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId())
    const IS_MAINNET = chainId === 1n
    const L1_SCROLL_MESSENGER = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    const SCROLL_CHAINID = IS_MAINNET ? SCROLL_CHAINID_MAINNET : SCROLL_CHAINID_SEPOLIA
    const [signer] = await connection.viem.getWalletClients();
    evmDeployments
    const scrollContracts = evmDeployments[Number(SCROLL_CHAINID)]
    const sepoliaContracts = evmDeployments[Number(SEPOLIA_CHAINID)]
    const adapterContract = scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"] //sepoliaContracts["L1InfraModule#L1ScrollBridgeAdapter"] //scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]
    
    const claimInfo = await getClaimDataScroll(adapterContract, "0xab8eaf99b303d69dcc763fd300e5513979c44d538b08e0d2720cc6c84717fef4")
    const txHash = await claimL1WithdrawScroll(claimInfo, signer)
    await publicClient.waitForTransactionReceipt({ hash: txHash })
    console.log({txhash: txHash})
}

main()