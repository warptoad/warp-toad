

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
in root run:
```shell
yarn run b:compile:aztec
```

### generate EVM verifier contracts
```shell
yarn run b:circuit
```

## run sandbox (needed for local/sandbox deployment)
in a new shell window run either:
```shell
VERSION=3.0.0-devnet.5 aztec start --sandbox
```
or
```shell
yarn run b:sandbox
```


## deploy
### setup secrets
```shell
yarn workspace @warp-toad/backend hardhat vars set PRIVATE_KEY;
yarn workspace @warp-toad/backend hardhat vars set SEPOLIA_URL;
yarn workspace @warp-toad/backend hardhat vars set SCROLL_SEPOLIA_URL;
yarn workspace @warp-toad/backend hardhat vars set ETHERSCAN_KEY;
yarn workspace @warp-toad/backend hardhat vars set ETHERSCAN_KEY_SCROLL;
```

## local/sandbox deployment

#### 1. deploy test token on "L1"
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network sepolia;
```
#### 2. deploy warptoad on "L1"
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network sepolia;
```
#### 3. deploy warptoad on aztec
sandbox
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia;
```
#### 4. initialize/connect contracts 
```shell
#L1
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/initializeL1.ts --network aztecSandbox;
#aztec
PXE_URL=http://localhost:8080 yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/initializeAztec.ts --network aztecSandbox;
```

# testnet/devnet deployment
#### 1. deploy test token on "L1"
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ignition/modules/TestToken.ts --network aztecSandbox;
```
#### 2. deploy warptoad on "L1"
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/deployL1.ts --network aztecSandbox;
```
#### 3. deploy warptoad on aztec
sandbox
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia;
```
#### 4. deploy on scroll
```shell
NATIVE_TOKEN_ADDRESS=0xUrNativeTokenAddress yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/deployL2Scroll.ts --network scrollSepolia;
```

#### 5. initialize/connect contracts 
```shell
PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/L1/initializeL1.ts --network sepolia;
#aztec
PXE_URL=https://devnet.aztec-labs.com yarn workspace @warp-toad/backend hardhat run scripts/deploy/aztec/initializeAztec.ts --network sepolia;
#scroll
yarn workspace @warp-toad/backend hardhat run scripts/deploy/scroll/initializeL2Scroll.ts --network scrollSepolia;
```

## bridge
#### sandbox 
```shell
PXE_URL=http:/localhost:8080 yarn workspace @warp-toad/backend bun scripts/dev_op/bridge.ts --isAztec --localRootProviders 0xL1WarpToadAddress 0xL1AztecAdapterAddress
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

# bridgeSync

## 1. prepare .env
prepare .env file.
```shell
    cd bridgeSync/;
    cp .env.template .env;
```
edit the contents of .env (for local test set **ALLOWED_ORIGINS** to the port the frontend will be running on.)
## 2. run bridge
in root either run
```shell
yarn bridge:dev
```
or build and spin up docker container: 
```shell
yarn bridge:docker && yarn bridge:docker:run
```

# frontend
## 1. prepare .env
prepare .env file.
```shell
    cd frontend/;
    cp .env.template .env;
``` 
edit the contents of .env (for local test set **VITE_TEST_MODE=true and VITE_BRIDGE_KEEPER_URL=http://localhost:6969)**
## 2. generate artifacts from backend for frontend.
in root run
```shell
yarn f:prep
```
## 3. run frontend
either run: 
```shell
yarn f:dev
```
or if you want to use proving: 
```shell
yarn f:run
```