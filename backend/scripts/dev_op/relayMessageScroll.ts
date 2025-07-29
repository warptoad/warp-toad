import { ArgumentParser } from "argparse";
import { IL1ScrollMessenger, IL1ScrollMessenger__factory } from "../../typechain-types";
import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA, SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA, SEPOLIA_CHAINID } from "../lib/constants";
import { ethers } from "ethers";
import { getContractAddressesEvm } from "../dev_op/utils";
import hre from "hardhat";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));


async function main() {
    const provider = hre.ethers.provider as ethers.Provider
    const chainId = (await provider.getNetwork()).chainId
    const IS_MAINNET = chainId === 1n
    const L1_SCROLL_MESSENGER = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA
    const SCROLL_CHAINID = IS_MAINNET ? SCROLL_CHAINID_MAINNET : SCROLL_CHAINID_SEPOLIA
    const signer = (await hre.ethers.getSigners())[0]
    const scrollContracts = await getContractAddressesEvm(SCROLL_CHAINID)
    const sepoliaContracts = await getContractAddressesEvm(SEPOLIA_CHAINID)
    const adapterContract = scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"] //sepoliaContracts["L1InfraModule#L1ScrollBridgeAdapter"] //scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]
    
    let claimInfo = null
    while(claimInfo===null) {
        const scrollBridgeApiRes = await fetch(`https://sepolia-api-bridge-v2.scroll.io/api/l2/unclaimed/withdrawals?address=${adapterContract}&page=1&page_size=1`)
        const scrollBridgeApiResJson = await scrollBridgeApiRes.json()
        console.log({scrollBridgeApiResJson, L2ScrollBridgeAdapterAddress: adapterContract})
        claimInfo = scrollBridgeApiResJson.data.results === null? null : scrollBridgeApiResJson.data.results[0].claim_info
        console.log({claimInfo})
        if (claimInfo!==null){break}else{console.log("oooo i am soo eepy. I am going to sleep for 10 minutes!")}
        await sleep(600000)
    }


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
    console.log({txhash: tx?.hash})
}

main()