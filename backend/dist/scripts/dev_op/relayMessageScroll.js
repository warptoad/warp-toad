import { L1_SCROLL_MESSENGER_MAINNET, L1_SCROLL_MESSENGER_SEPOLIA, SCROLL_CHAINID_MAINNET, SCROLL_CHAINID_SEPOLIA, SEPOLIA_CHAINID } from "../lib/constants";
import { getContractAddressesEvm } from "../dev_op/utils";
import hre from "hardhat";
import { claimL1WithdrawScroll, getClaimDataScroll } from "../lib/bridging";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function main() {
    const provider = hre.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    const IS_MAINNET = chainId === 1n;
    const L1_SCROLL_MESSENGER = IS_MAINNET ? L1_SCROLL_MESSENGER_MAINNET : L1_SCROLL_MESSENGER_SEPOLIA;
    const SCROLL_CHAINID = IS_MAINNET ? SCROLL_CHAINID_MAINNET : SCROLL_CHAINID_SEPOLIA;
    const signer = (await hre.ethers.getSigners())[0];
    const scrollContracts = await getContractAddressesEvm(SCROLL_CHAINID);
    const sepoliaContracts = await getContractAddressesEvm(SEPOLIA_CHAINID);
    const adapterContract = scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]; //sepoliaContracts["L1InfraModule#L1ScrollBridgeAdapter"] //scrollContracts["L2ScrollModule#L2ScrollBridgeAdapter"]
    const claimInfo = await getClaimDataScroll(adapterContract, "0xab8eaf99b303d69dcc763fd300e5513979c44d538b08e0d2720cc6c84717fef4");
    const tx = await (await claimL1WithdrawScroll(claimInfo, signer)).wait(1);
    console.log({ txhash: tx?.hash });
}
main();
