### build it
```shell
yarn build
```

### publish it
```
npm publish
```

### note
you might need to add with {type:"json"} to L2AztecBridgeAdapter.ts and WarpToadCore.ts


### how to use
see: https://github.com/warptoad/warp-toad/blob/npm-package-demo/backend/test/testAztecToL1.ts

and: 
https://github.com/warptoad/warp-toad/blob/npm-package-demo/backend/scripts/dev_op/bridge.ts

ex: 

```ts
//TODO test this
import { GIGA_TREE_DEPTH } from "warp-toad-old-backend/constants";
import { EVM_TREE_DEPTH, gasCostPerChain } from "warp-toad-old-backend/constants";
import { hashCommitment, hashPreCommitment } from "warp-toad-old-backend/hashing";
import { calculateFeeFactor, createProof, getMerkleData, getProofInputs } from "warp-toad-old-backend/proving";
import { sendGigaRoot, bridgeAZTECLocalRootToL1, parseEventFromTx, updateGigaRoot, receiveGigaRootOnAztec, bridgeBetweenL1AndL2 } from "warp-toad-old-backend/bridging";

import { getL1Contracts, getL2Contracts, getAztecTestWallet } from 'warp-toad-old-backend/deployment';
import { getLocalRootProviders, getPayableGigaRootRecipients, bridgeBetweenL1AndL2, sleep } from 'warp-toad-old-backend/bridging';


const l1Provider = new ethers.JsonRpcProvider(args.L1Rpc);
const l1Wallet = new ethers.Wallet(args.evmPrivatekey, l1Provider);

const l1ChainId = (await l1Provider.getNetwork()).chainId


const { L1Adapter, gigaBridge, l1Warptoad } = await getL1Contracts(l1ChainId, l2ChainId as bigint, l1Wallet, isAztec)
//const { L2Adapter, L2WarpToad } = await getL2Contracts(l2Wallet,l1ChainId, l2ChainId, isAztec, PXE as PXE, AZTEC_NODE_URL)

const amount = 100n
//wrap it 
await (await l1Warptoad.wrap(amount)).wait(1)

const commitmentPreImg = {
    amount: amount,
    destination_chain_id: tempFakeChainIdAztec,
    secret: 1234n,              // Use Fr.random().toBigInt() pls
    nullifier_preimg: 4321n,    // Use Fr.random().toBigInt() pls
}
const preCommitment = hashPreCommitment(commitmentPreImg.nullifier_preimg, commitmentPreImg.secret, commitmentPreImg.destination_chain_id)
await (await l1Warptoad.burn(commitmentPreImg, commitmentPreImg.amount)).wait(1)

const feeFactor = 0                                                     // will skip relayer logic (cant be 1)
const evmRelayerAddress = "0x0000000000000000000000000000000000000001"  // circuit excepts anything but address(0x00)
const priorityFee = 1                                                   // circuit excepts anything but 0
const proofInputs = await getProofInputs(
    gigaBridge,
    l1Warptoad,
    l1Warptoad,
    amount,
    feeFactor,
    priorityFee,
    maxFee,
    evmRelayerAddress,
    await l1Wallet.getAddress(),
    commitmentPreImg.nullifier_preimg,
    commitmentPreImg.secret,
)

const mintTx = await (await L1WarpToadWithRelayer.mint(
    ethers.toBigInt(proofInputs.nullifier),
    ethers.toBigInt(proofInputs.amount),
    ethers.toBigInt(proofInputs.giga_root),
    ethers.toBigInt(proofInputs.destination_local_root),
    ethers.toBigInt(proofInputs.fee_factor),
    ethers.toBigInt(proofInputs.priority_fee),
    ethers.toBigInt(proofInputs.max_fee),
    ethers.getAddress(proofInputs.relayer_address.toString()),
    ethers.getAddress(proofInputs.recipient_address.toString()),
    ethers.hexlify(proof.proof),
    {
        maxPriorityFeePerGas: ethers.toBigInt(proofInputs.priority_fee),
        maxFeePerGas: ethers.toBigInt(proofInputs.priority_fee) * 100n //Otherwise HRE does the gas calculations wrong to make sure we don't get `max_priority_fee_per_gas` greater than `max_fee_per_gas
    }
)).wait(1)
```