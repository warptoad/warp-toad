# Warptoad

> Cross-bridge privacy infrastructure that scales with Aztec


## Table of Contents

- [Technical Overview](#technical-overview)
- [The GigaRoot](#the-gigaroot)
- [Proving](#proving)
- [Siloing Commitments Per Chain ID](#siloing-commitments-per-chain-id)
- [Aztec Integration](#aztec-integration)
- [Project History and NoirHack Contributions](#project-history-and-noirhack-contributions)
- [Privacy Primitives Used](#privacy-primitives-used)
- [Benchmarks](#benchmarks)
- [Live Demo](#live-demo)
- [Video Demo](#video-demo)
- [Pitch](#pitch)
- [Links to deployed contracts](#links-to-deployed-contracts)
- [Warning: Known Issues](#️-warning-known-issues)
- [Installation and Execution Guide](#installation-and-execution-guide)

---

## Technical Overview

WarpToad is a privacy-preserving bridge protocol that enables users to move assets across L1, L2s, and Aztec without revealing sender, recipient or the chain you came from. It does this by aggregating commitments from each chain and creating a unified Merkle root — the GigaRoot — on Ethereum mainnet.

### The GigaRoot

WarpToad achieves cross-chain privacy by tracking commitments inside in-contract Merkle trees on each chain separately. It then uses the native bridges of the integrated rollups to send those roots to L1. On L1, the GigaBridge contract collects these roots and aggregates them into a larger Merkle tree (the **GigaTree**), with the root known as the **GigaRoot**. This GigaTree includes commitments from all integrated L2s and L1.

### Proving

Once the GigaRoot is posted to L1, it is propagated back to the L2s. Users can then generate zk-proofs showing they made a valid deposit on any integrated chain — without revealing the chain, the deposit, or transaction details.

For users who deposit and withdraw on the same chain, WarpToad includes the latest local Merkle root. This allows for same-chain withdrawals using the full cross-chain anonymity set — no need to wait for the GigaRoot.
This is useful for users who want privacy without moving assets across chains, such as recycling addresses, breaking linkability, or hiding the timing between deposit and use.

Because roots are sent asynchronously, the protocol remains fast and responsive, even across rollups with different bridging speeds.

### Siloing Commitments Per Chain ID

WarpToad commitments are **siloed per destination chain ID**. Each commitment is created as:
`commitment = hash(hash(nullifierPreimage, secret, destinationChainId), amount)`
This is similar to 0xbow, with the chain ID added. The inclusion of the chain ID enforces that a commitment can only be withdrawn on one specific chain. This eliminates the need to bridge nullifiers. The circuit enforces this by requiring the destination chain ID to be revealed as a public input during withdrawal.

### Aztec Integration

On Aztec, privacy is even stronger due to its shielded architecture and larger anonymity set. Instead of creating a separate Merkle tree on Aztec, WarpToad pushes commitments and nullifiers directly into Aztec’s native note tree.

This means:

* Bridging transactions that originate on Aztec are fully shielded and indistinguishable from other Aztec transactions.
* Transactions arriving on Aztec are also completely private.
* Since bridge transfers resemble regular shielded transfers, **WarpToad inherits the full anonymity set of Aztec**.

This model scales even better in the future if another privacy-preserving protocol integrates WarpToad as deeply as Aztec. In that scenario, anonymity sets of multiple protocols could be joined through WarpToad — simply by virtue of the shared bridge.


### Project History and NoirHack Contributions

WarpToad began two weeks prior to NoirHack during ETHaly, where initial work was limited to architectural research and implementation planning — no code was written before the hackathon.

The project is a direct evolution of an earlier hackathon submission, [Toadnado](https://ethglobal.com/showcase/toadnado-vvkcb) , built at ETHGlobal Brussels 2024. Toadnado was a cross-layer mixer enabling shielded transfers between L1 and L2, and won prizes from Blockscout and Scroll.

WarpToad builds on that conceptual foundation but reimagines cross-chain privacy with:

asynchronous commitment aggregation,

destination-bound commitments,

and deep integration with Aztec’s native note tree.

---

## Privacy Primitives Used

* **Lazy Incremental Merkle Tree (Lazy IMT):** Used to track commitments on each chain. Lazy IMTs reduce gas costs by delaying root computation until needed, allowing amortized cost across multiple deposits.
* **GigaTree as Lazy IMT:** The GigaTree also uses a Lazy IMT to enable batch insertion of L2 roots efficiently during aggregation.
* **Poseidon & Poseidon2:** We use Poseidon for on-chain hashing and Poseidon2 for Aztec compatibility.
* **zk-Kits Merkle Verifier:** Merkle proofs are verified in Noir using zk-Kits' verifier, which supports custom hash functions.

---

## Benchmarks
```
constraint count:
Aztec Warptoad:
goblin ecc op : 4/1024
busread       : 727/6000
lookups       : 9354/15000
pub inputs    : 16/5000 (populated in decider pk constructor)
arithmetic    : 56000/56000
delta range   : 2381/18000
elliptic      : 670/6000
auxiliary     : 549/26000
poseidon ext  : 622/17000
poseidon int  : 3536/92000
overflow      : 30841/30841
```

*Constraints evm circuit (noir + bb)*
```
acir_opcodes: 25403
circuit_size: 81060
```

*Gas cost evm mint:*
```
·····························|················|················|·················|················|
|  Contracts / Methods       ·  Min           ·  Max           ·  Avg            ·  # calls       |
·····························|················|················|·················|················|
|  L1WarpToad                ·                                                                    |
·····························|················|················|·················|················|
|      burn                  ·       104,705  ·       820,196  ·        159,753  ·         20000  |       
```

---

## Live Demo

* [https://warptoad.xyz/](https://warptoad.xyz/)

## Video Demo

* [Demo Recording](https://www.youtube.com/watch?v=0HKP5Viis_0)

## Pitch

* [Pitch recording](https://www.youtube.com/watch?v=SElCIv6eW78)

## Links to deployed contracts

We have the Aztec smart contracts deployed on testnet, but the application doesn't currently work there, likely due to a configuration issue with the L1 to L2 bridge.
It does work fully in the Aztec sandbox environment.

### L1 sepolia
L1WarpToad:[0x199953A6a80a67B1FFFf7A541cEd4602eF662bc9](https://sepolia.etherscan.io/address/0x199953A6a80a67B1FFFf7A541cEd4602eF662bc9)

L1AztecBridgeAdapter: [0xCCeB96020819b9a5f194FC7176659624BD87a674](https://sepolia.etherscan.io/address/0xCCeB96020819b9a5f194FC7176659624BD87a674#code)

<!-- L1ScrollBridgeAdapter: [0xf524005D94849D5a5935B775544ab6b6A1B4c483](https://sepolia.etherscan.io/address/0xf524005D94849D5a5935B775544ab6b6A1B4c483#code) -->

GigaBridge: [0x7dd5bC8bc0dA28B282322143e2c8A4a1A8e916F1](https://sepolia.etherscan.io/address/0x7dd5bC8bc0dA28B282322143e2c8A4a1A8e916F1#code)

WithdrawVerifier: [0x28A6aA736A47823822355f70642d167e36dA7760](https://sepolia.etherscan.io/address/0x28A6aA736A47823822355f70642d167e36dA7760)

### L2 aztec
Aztec WarpToad: [0x0e730046743e6432ae2260b82ac5060d428fdc6a22674181244928b9b14a778e](https://aztecscan.xyz/contracts/instances/0x0e730046743e6432ae2260b82ac5060d428fdc6a22674181244928b9b14a778e)

L2AztecBridgeAdapter: [0x11992442ce2548511f7fa7e83b263b72a6c7fb7029e489b089f7fc50e5b69753](https://aztecscan.xyz/contracts/instances/0x11992442ce2548511f7fa7e83b263b72a6c7fb7029e489b089f7fc50e5b69753)
<!-- 
### L2 scroll
L2WarpToad: [0x83f981ebb58d6540b0661b38aad0a12163b29ef5](https://sepolia.scrollscan.com/address/0x83f981ebb58d6540b0661b38aad0a12163b29ef5)

L2ScrollAdapter: [0x2f94c4e2fd362c62983745adcb90e8492587f026](https://sepolia.scrollscan.com/address/0x2f94c4e2fd362c62983745adcb90e8492587f026)

WithdrawVerfifier: [0xb88e8c9af5069b42b4cea9a9f0218ae0c412f827](https://sepolia.scrollscan.com/address/0xb88e8c9af5069b42b4cea9a9f0218ae0c412f827) -->



---

# ⚠️ WARNING: KNOWN ISSUES

1. event scanning will scan from block 0 to latest. This will break outside of tests and anvil  
2. Currently doesn't work on Aztec testnet, only the sandbox. This is due to a issue with the testnet message bridge [https://github.com/AztecProtocol/aztec-packages/issues/14174](https://github.com/AztecProtocol/aztec-packages/issues/14174).  We include the code below for deploying & running on testnet for when this issue is resolved.
---

## Installation and Execution Guide

## install
make sure you're on node 20 (hardhat needs it)
```shell
nvm install 20;
nvm use 20;
npm install --global yarn;
yarn install;
```

make sure you're on aztec 1.2.1
```shell
aztec-up 1.2.1
```

install noir and backend
```shell
bbup -v 0.72.1;
noirup -v 1.0.0-beta.5;
```

## compile contracts
### aztec
```shell
# aztec warpToad
cd backend/contracts/aztec/WarpToadCore;
aztec-nargo compile;
aztec codegen -o src/artifacts target;
cd ../../../..

# L2AztecBridgeAdapter
cd backend/contracts/aztec/L2AztecBridgeAdapter;
aztec-nargo compile;
aztec codegen -o src/artifacts target;
cd ../../../..
```

### generate EVM verifier contracts
<!-- //this should be a bash script lmao -->
<!-- 
idk what happened to the new versions of bb but it sucks!!
This is how to do it with the new version of bb but it doesnt work
```shell
cd backend/circuits/withdraw/; 
nargo compile; 
bb write_vk -b ./target/withdraw.json -o ./target/ --oracle_hash keccak;
bb write_solidity_verifier -k ./target/vk --scheme ultra_honk -o ./target/contract.sol;

cd ../../..;

# move to contracts folder
mv backend/circuits/withdraw/target/contract.sol backend/contracts/evm/WithdrawVerifier.sol

# rename the contract
yarn workspace @warp-toad/backend ts-node ./scripts/dev_op/replaceLine.ts --file ./contracts/evm/WithdrawVerifier.sol --remove "contract HonkVerifier is BaseHonkVerifier(N, LOG_N, NUMBER_OF_PUBLIC_INPUTS) {" --replace "contract WithdrawVerifier is BaseHonkVerifier(N, LOG_N, NUMBER_OF_PUBLIC_INPUTS) {"
``` -->
```shell
cd backend/circuits/withdraw/; 
nargo compile; 
bb write_vk -b ./target/withdraw.json;
bb contract;
cd ../../..;

# move to contracts folder
mv backend/circuits/withdraw/target/contract.sol backend/contracts/evm/WithdrawVerifier.sol

# rename the contract
yarn workspace @warp-toad/backend ts-node ./scripts/dev_op/replaceLine.ts --file ./contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"
```


## run sandbox
```shell
VERSION=1.2.1 aztec start --sandbox
```

## run PXE on alpha testnet
```shell
VERSION=1.2.1 aztec start --port 8080 --pxe --pxe.nodeUrl=https://full-node.alpha-testnet.aztec.network --l1-chain-id 11155111 --l1-rpc-urls https://sepolia.infura.io/v3/urkey

```
<!--
## aztec testnet deploy environment
```shell
export NODE_URL=https://full-node.alpha-testnet.aztec.network
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5
```
-->


## deploy
### setup secrets
```shell
yarn workspace @warp-toad/backend hardhat vars set PRIVATE_KEY;
yarn workspace @warp-toad/backend hardhat vars set SEPOLIA_URL;
yarn workspace @warp-toad/backend hardhat vars set ETHERSCAN_KEY;
yarn workspace @warp-toad/backend hardhat vars set ETHERSCAN_KEY_SCROLL;
```

### deploy L1 aztec-sandbox
#### deploy test token
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network aztecSandbox;
```

<!-- ```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network sepolia
``` -->
#### deploy on L1
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network aztecSandbox;
```
<!--  
NATIVE_TOKEN_ADDRESS=0xc5a5C42992dECbae36851359345FE25997F5C42d yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network aztecSandbox;

NATIVE_TOKEN_ADDRESS=0x53bAc8Df8Ee03a057DF9309f4f613E5478354E60 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network sepolia;

-->

#### deploy on aztec
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network aztecSandbox;
```

<!--
NATIVE_TOKEN_ADDRESS=0xc5a5C42992dECbae36851359345FE25997F5C42d PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network aztecSandbox;

NATIVE_TOKEN_ADDRESS=0x53bAc8Df8Ee03a057DF9309f4f613E5478354E60 PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia;
-->

#### deploy on scroll
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/deployL2Scroll.ts --network scrollSepolia;
```
<!-- 
NATIVE_TOKEN_ADDRESS=0x53bAc8Df8Ee03a057DF9309f4f613E5478354E60 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployL2Scroll.ts --network scrollSepolia;
 -->

#### initialize contracts
sandbox  
```shell
#L1
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/initializeL1.ts --network aztecSandbox;
#aztec
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/initializeAztec.ts --network aztecSandbox;
```
  
sepolia  
```shell
PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/initializeL1.ts --network sepolia;
#aztec
PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/initializeAztec.ts --network sepolia;
#scroll
yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/initializeL2Scroll.ts --network scrollSepolia;
```

## verify contracts
The deploy script verifies most contracts accept for poseidon since it is on an older version.
<!-- ```shell
#sepolia  
yarn workspace @warp-toad/backend hardhat ignition verify chain-11155111 --include-unrelated-contracts;
#scroll sepolia  
yarn workspace @warp-toad/backend hardhat ignition verify chain-534351 --include-unrelated-contracts;

``` -->

## bridge
#### sandbox 
```shell
yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --isAztec
```
#### aztec
Takes about 0.5-1 hour to run
```shell
yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --L1Rpc UrUrl --L2Rpc http://localhost:8080/ --privatekey 0xUrPrivateKey --isAztec
```

#### scroll
Note: You have to use a paid rpc since free rpcs wont allow you to work with events well enough  
Takes about 2-3 hours to run
```shell
yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --L1Rpc https://usSepoliaRpc --L2Rpc https://urlScrollRpc  --evmPrivatekey 0xUrPrivateKey
```

## test contracts
test L1->Aztec
```shell
yarn workspace @warp-toad/backend hardhat test test/testL1ToAztec.ts --network aztecSandbox
```

test Aztec->L1
```shell
yarn workspace @warp-toad/backend hardhat test test/testAztecToL1.ts --network aztecSandbox
```

test L1->L1
```shell
yarn workspace @warp-toad/backend hardhat test test/testL1ToL1.ts --network aztecSandbox
```

test EVERYTHING
```shell
yarn workspace @warp-toad/backend hardhat test --network aztecSandbox
```

get gas estimation minting (broken)
```shell
rm -fr backend/ignition/deployments/chain-31337/;
yarn workspace @warp-toad/backend hardhat ignition deploy ./ignition/modules/L1WarpToadWithTestToken.ts --parameters ignition/WarpToadCoreParametersTesting.json --network aztecSandbox;
yarn workspace @warp-toad/backend ts-node scripts/dev_op/estimateGas.ts -d ignition/deployments/chain-31337/deployed_addresses.json;
```

# frontend 
## preReq
```shell
    cd frontend/;
    cp template.env .env;
    yarn install;
```

## run dev
```shell
    yarn dev in /frontend or yarn f:dev
```
