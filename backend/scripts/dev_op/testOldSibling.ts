import { createAztecNodeClient, Fr } from '@aztec/aztec.js';
const AZTEC_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz"
async function main() {
    const noteHash = BigInt("0x1ce3aa5e5186cd17fe7ddd5cb4dc734bbe8502bc700826082429e49cd667a31c")
    const node = createAztecNodeClient(AZTEC_NODE_URL)
    const currentBlock = await node.getBlockNumber()
    const blockNumber = currentBlock - 150
    const witness = await node.getNoteHashMembershipWitness(blockNumber, new Fr(noteHash))
    console.log({ witnessPxe: witness })
}
main()

