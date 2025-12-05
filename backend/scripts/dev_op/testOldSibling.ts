import { createAztecNodeClient, Fr } from '@aztec/aztec.js';
const AZTEC_NODE_URL = "https://devnet.aztec-labs.com/"
async function main() {
    const noteHash = BigInt("0x2b1196bc19fe0407c938c9633f4decde0f5ec3425e02fa2d7e9ae41f819ee893") // https://devnet.aztecscan.xyz/tx-effects/0x16cdbae0a675397e0d81abf7f443ce51e4bd5bec11614e6fb3c9df3b625b27ac
    const node = createAztecNodeClient(AZTEC_NODE_URL)
    const currentBlock = await node.getBlockNumber()
    const blockNumber = currentBlock - 80 // - 80 // - 80=works but block older then 80 blocks ago don't
    // warptoad needs MembershipWitnesses of blocks that are up to 100 min old.
    // 100 min = (aztecBridgeTime = >20min + gigaBridgeRelayerInterval = >60min + marginOfError = 20min)
    // assuming block take 30s (according to aztecscan on devnet), the aztec node needs to set WS_NUM_HISTORIC_BLOCKS to 200
    const witness = await node.getNoteHashMembershipWitness(blockNumber, new Fr(noteHash))
    console.log({ witnessPxe: witness })
}
main()