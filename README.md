# warp-toad
Cross bridge privacy

# WARNING KNOWN ISSUES
jimjim:   
1. event scanning will scan from block 0 to latest. This will break outside of tests and anvil  
 

## install
make sure you're on node 20 (hardhat needs it)
```shell
nvm install 20.19.1;
nvm use 20.19.1;
npm install --global yarn;
yarn install;
```

make sure you're on aztec 0.85.0-alpha-testnet.9
```shell
aztec-up 0.85.0-alpha-testnet.9
```

install noir and backend
```shell
bbup -v 0.72.1;
noirup -v 1.0.0-beta.3;
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
TODO hardhat (and after verifier)

### generate EVM verifier contracts
<!-- //this should be a bash script lmao -->
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
VERSION=0.85.0-alpha-testnet.9 aztec start --sandbox
```

## run PXE on alpha testnet (@danish skip this)
```shell
aztec start --port 8080 --pxe --pxe.nodeUrl=https://full-node.alpha-testnet.aztec.network --l1-chain-id 11155111 --l1-rpc-urls https://sepolia.infura.io/v3/urkey

```

## aztec testnet deploy environment
TODO is this needed??
```shell
export NODE_URL=https://full-node.alpha-testnet.aztec.network
export SPONSORED_FPC_ADDRESS=0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5
```

## deploy
### deploy L1 aztec-sandbox
#### deploy test token
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network aztecSandbox
```

<!-- ```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network sepolia
``` -->
#### deploy on L1
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network aztecSandbox;
```
<!--  
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this

NATIVE_TOKEN_ADDRESS=0xAFD45Bf16D431BFbdF637261b749D256fEC02390 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network sepolia;
NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network aztecSandbox;
-->

#### deploy on aztec
```shell
PRIVATE_KEY=0xYourPrivateKey NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox;
```

<!--
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this
PRIVATE_KEY=ASuperSecretPrivateKeyIGotFromEngineerAtObsidion NATIVE_TOKEN_ADDRESS=0xAFD45Bf16D431BFbdF637261b749D256fEC02390 PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network sepolia;
PRIVATE_KEY=0xYourPrivateKey NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox;
-->

#### deploy on scroll
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL2Scroll.ts --network scrollSepolia;
```
<!-- 
NATIVE_TOKEN_ADDRESS=0xAFD45Bf16D431BFbdF637261b749D256fEC02390 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL2Scroll.ts --network scrollSepolia;
 -->

#### initialize contracts
sandbox  
```shell
#L1
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts --network aztecSandbox;
#aztec
PRIVATE_KEY=0xYourPrivateKey PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts --network aztecSandbox;
```
  
sepolia  
```shell
PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts --network sepolia;
#aztec
PRIVATE_KEY=0xYourPrivateKey PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts --network sepolia;
#scroll
yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL2Scroll.ts --network scrollSepolia;
```

## verify contracts
```shell
#sepolia  
yarn workspace @warp-toad/backend hardhat ignition verify chain-11155111 --include-unrelated-contracts;
#scroll sepolia  
yarn workspace @warp-toad/backend hardhat ignition verify chain-534351 --include-unrelated-contracts;

```

## bridge
#### sandbox 
```shell
yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --isAztec
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