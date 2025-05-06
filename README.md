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

make sure you're on aztec 0.85.0-alpha-testnet.9
```shell
aztec-up 0.85.0-alpha-testnet.9
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
VERSION=0.85.0-alpha-testnet.9 aztec start --sandbox
```

## run PXE on alpha testnet (@danish skip this)
```shell
aztec start --port 8080 --pxe --pxe.nodeUrl=https://full-node.alpha-testnet.aztec.network --l1-chain-id 11155111 --l1-rpc-urls https://sepolia.infura.io/v3/urkey

```

## aztec testnet deploy environment
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
```shell
NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network sepolia;
NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployL1.ts --network aztecSandbox;
``` -->

#### deploy on aztec
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network aztecSandbox;
```

<!--
if you just restarted sandbox then the test token address will be the same as below and you can just copy paste this
```shell
PRIVATE_KEY=ASuperSecretPrivateKeyIGotFromEngineerAtObsidion NATIVE_TOKEN_ADDRESS=0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/deployAztec.ts --network sepolia;
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

# frontend
## frontend preparation
copy the ```template.env``` file and rename it to ```.env```

## run frontend in dev mode
```shell
 yarn f:dev
 ```

## connecting wallet to frontend:
we are using obsidion wallet for the frontend.
first you must create a wallet at [app.obsidion.xyz](https://app.obsidion.xyz/).
for non testnet interactions change the network to sandbox (if a local aztec sandbox is running).
After creating a wallet on the same browser as the frontend is running on you can connect to it through a pop up window.