# warp-toad
Cross bridge privacy

# WARNING KNOWN ISSUES
jimjim:   
1. event scanning will scan from block 0 to latest. This will break outside of tests and anvil  
1. scripts/lib/proving.ts only works on burning and minting on the same chain. Because gigaTree and aztec proofs provided are just zeros   
1. scripts/lib/proving.ts assumes that every local root is always immediately bridged and included into gigaRoot. That is bad and will break when you do async bridging   



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
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ./ignition/modules/L1WarpToad.ts --parameters ignition/WarpToadCoreParameters.json --network aztecSandbox
```

### deploy L2 test version AztecWarpToad (only works with bun)
`yarn workspace @warp-toad/backend bun scripts/dev_op/deployAztecToadWarp.ts`

## test contracts
test one just EVM (broken need updates)
```shell
yarn workspace @warp-toad/backend hardhat test test/testL1WarpToad.ts 
```

test only one AZTEC (broken need updates)
```shell
yarn workspace @warp-toad/backend hardhat test test/testAztecToadWarp.ts  --network aztecSandbox
```

test one CROSS-CHAIN (works! yay!)
```shell
yarn workspace @warp-toad/backend hardhat test test/testAztecToL1.ts --network aztecSandbox
```

test EVERYTHING (testL1WarpToad and testAztecToadWarp are broken)
```shell
yarn workspace @warp-toad/backend hardhat test --network aztecSandbox
```

get gas estimation minting
```shell
rm -fr backend/ignition/deployments/chain-31337/;
yarn workspace @warp-toad/backend hardhat ignition deploy ./ignition/modules/L1WarpToadWithTestToken.ts --parameters ignition/WarpToadCoreParametersTesting.json --network aztecSandbox;
yarn workspace @warp-toad/backend ts-node scripts/dev_op/estimateGas.ts -d ignition/deployments/chain-31337/deployed_addresses.json;
```