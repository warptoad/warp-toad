import { ArgumentParser } from "argparse";
import { IL1ScrollMessenger, IL1ScrollMessenger__factory } from "../../typechain-types";
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA, SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA } from "../lib/constants";
import { ethers } from "ethers";
import { getContractAddressesEvm } from "../dev_op/getDeployedAddresses";
import hre from "hardhat";




async function main() {
    const provider = hre.ethers.provider as ethers.Provider
    const chainId = (await provider.getNetwork()).chainId
    const IS_MAINNET = chainId === 1n
    const L1_SCROLL_MESSENGER = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    const SCROLL_CHAINID = IS_MAINNET ? SCROLL_CHAINID_MAINNET : SCROLL_CHAINID_SEPOLIA
    const signer = (await hre.ethers.getSigners())[0]
    const scrollContracts = await getContractAddressesEvm(SCROLL_CHAINID)
    const L2ScrollBridgeAdapterAddress = scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]
    const scrollBridgeApiRes = await fetch(`https://sepolia-api-bridge-v2.scroll.io/api/l2/unclaimed/withdrawals?address=${L2ScrollBridgeAdapterAddress}&page=1&page_size=1`)
    const scrollBridgeApiResJson = await scrollBridgeApiRes.json()
    console.log({scrollBridgeApiResJson, L2ScrollBridgeAdapterAddress})
    const claimInfo = scrollBridgeApiResJson.data.results[0].claim_info
    const L1ScrollMessenger = IL1ScrollMessenger__factory.connect(L1_SCROLL_MESSENGER, signer)
    console.log({claimInfo})
    const tx =await (await L1ScrollMessenger.relayMessageWithProof(
        ethers.getAddress(claimInfo.from),
        ethers.getAddress(claimInfo.to),
        BigInt(claimInfo.value),
        BigInt(claimInfo.nonce),
        ethers.hexlify(claimInfo.message),
        {
            batchIndex: BigInt(claimInfo.proof.batch_index),
            merkleProof: ethers.hexlify(claimInfo.proof.merkle_proof)
        }
    )).wait(1)
    console.log({tx})
}

main()