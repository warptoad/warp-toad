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

make sure you're on aztec 0.85.0-alpha-testnet.2
```shell
aztec-up --version 0.85.0-alpha-testnet.2
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
VERSION=0.85.0-alpha-testnet.2 aztec start --sandbox
```

## deploy
### deploy L1 aztec-sandbox
#### deploy test token
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network aztecSandbox
```
#### deploy on L1
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network aztecSandbox;
```
<!--  
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this
```shell
NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network aztecSandbox
``` -->

#### deploy on aztec
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox;
```

<!--
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this
```shell
NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox
``` -->
#### initialize contracts
```shell
#L1
yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeL1.ts --network aztecSandbox;
#aztec
yarn workspace @warp-toad/backend hardhat run scripts/deploy/initializeAztec.ts --network aztecSandbox;
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