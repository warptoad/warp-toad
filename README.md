# warp-toad
Cross bridge privacy

# WARNING KNOWN ISSUES
jimjim:   
1. event scanning will scan from block 0 to latest. This will break outside of tests and anvil  
1. getMerkle proof in scripts/lib/proving.ts wont work on L1 -> aztec yet. The rest is supported
 

## install
make sure you're on node 20 (hardhat needs it)
```shell
nvm install 20;
nvm use 20;
npm install --global yarn;
yarn install;
```

make sure you're on aztec alpha-testnet
```shell
aztec-up alpha-testnet
```

install noir and backend
```shell
bbup -nv 1.0.0-beta.3;
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

# L2AztecRootBridgeAdapter
cd backend/contracts/aztec/L2AztecRootBridgeAdapter;
aztec-nargo compile;
aztec codegen -o src/artifacts target;
cd ../../../..
```

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
VERSION=alpha-testnet aztec start --sandbox
```

## run PXE on alpha testnet
```shell
aztec start --port 8080 --pxe --pxe.nodeUrl=http://34.107.66.170 --l1-chain-id 11155111 --l1-rpc-urls https://sepolia.infura.io/v3/urkey

```

## aztec testnet deploy envirment
```shell
export NODE_URL=http://34.107.66.170
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
```shell
NATIVE_TOKEN_ADDRESS=0xa80405F9F1FA485cff83Bb1479A74F70a139C64b yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network sepolia;
``` -->

#### deploy on aztec
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox;
```

<!--
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this
```shell
PRIVATE_KEY=ASuperSecretPrivateKeyIGotFromEngineerAtObsidion NATIVE_TOKEN_ADDRESS=0xa80405F9F1FA485cff83Bb1479A74F70a139C64b PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network sepolia;
``` -->
#### initialize contracts
```shell
#L1
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts --network aztecSandbox;
#aztec
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts --network aztecSandbox;
```

<!-- ```shell
#L1
PXE_URL=http:/localhost:8081yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts --network sepolia;
#aztec
PXE_URL=http:/localhost:8081 yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts --network sepolia;
``` -->

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