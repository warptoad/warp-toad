

## install
make sure you're on node 20 (hardhat needs it)
```shell
nvm install 20;
nvm use 20;
npm install --global yarn;
yarn install;
```

make sure you're on aztec 3.0.0-devnet.5
```shell
aztec-up 3.0.0-devnet.5

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
aztec-postprocess-contract
aztec codegen -o src/artifacts target;
cd ../../../..

# L2AztecBridgeAdapter
cd backend/contracts/aztec/L2AztecBridgeAdapter;
aztec-nargo compile;
aztec-postprocess-contract
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
aztec-nargo compile; 
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
VERSION=3.0.0-devnet.5 aztec start --sandbox
```

## run PXE on alpha testnet
```shell
VERSION=3.0.0-devnet.5 aztec start --port 8080 --pxe --pxe.nodeUrl=https://devnet.aztec-labs.com/ --l1-chain-id 11155111 --l1-rpc-urls https://sepolia.infura.io/v3/urkey

```
<!--
## aztec testnet deploy environment
```shell
export NODE_URL=https://aztec-alpha-testnet-fullnode.zkv.xyz
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
note: you might need comment out the scroll chainId json imports in `backend/scripts/dev_op/deployment.ts`  
@TODO fix that
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network aztecSandbox;
```
<!--  
NATIVE_TOKEN_ADDRESS=0x95401dc811bb5740090279Ba06cfA8fcF6113778 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network aztecSandbox;

NATIVE_TOKEN_ADDRESS=0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network sepolia;

-->

#### deploy on aztec
sandbox
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network aztecSandbox;
```

sepolia devnet
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia;
```

<!--
NATIVE_TOKEN_ADDRESS=0x95401dc811bb5740090279Ba06cfA8fcF6113778 PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network aztecSandbox;

NATIVE_TOKEN_ADDRESS=0x53bAc8Df8Ee03a057DF9309f4f613E5478354E60 PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia;
-->

#### deploy on scroll
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/deployL2Scroll.ts --network scrollSepolia;
```
<!-- 
NATIVE_TOKEN_ADDRESS=0xe899983Ff2C81E1c64d8a4Ac22AeE873A2382413 yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/deployL2Scroll.ts --network scrollSepolia;
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
PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/initializeL1.ts --network sepolia;
#aztec
PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/initializeAztec.ts --network sepolia;
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
PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --isAztec --localRootProviders 0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf 0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
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

## publish backend npm package
makes sure the aztec, ethers and circuit artifacts are build (compile instruction above)  
You might need to add `// @ts-ignore` in  `backend/contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore.ts` and `backend/contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.ts` above the json import line

### build it
```shell
yarn workspace @warp-toad/backend build
```

### publish it
```shell
yarn workspace @warp-toad/backend publish
```