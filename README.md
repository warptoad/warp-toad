# warp-toad
Cross bridge privacy


## install
make sure you're on node 20 (hardhat needs it)
```shell
nvm install 20;
nvm use 20;
npm install --global yarn;
yarn install;
```

make sure you're on aztec 0.82.3
```shell
aztec-up --version 0.82.3
```

install noir and backend
```shell
bbup -nv 1.0.0-beta.2;
noirup -v 1.0.0-beta.2;
```



## run sandbox
```shell
VERSION=0.82.3 aztec start --sandbox
```

## deploy
### deploy L1 aztec-sandbox
```shell
yarn workspace @warp-toad/backend hardhat ignition deploy ./ignition/modules/L1WarpToad.ts --parameters ignition/WarpToadCoreParameters.json --network aztecSandbox
```

### deploy L2 aztec-sandbox
`yarn workspace @warp-toad/backend ts-node scripts_dev_op/deployAztecToadWarp.ts`

## test contracts
test everything
```shell
yarn workspace @warp-toad/backend hardhat test --network aztecSandbox
```

test only one file (ex L1WarpToad)
```shell
yarn workspace @warp-toad/backend hardhat test --network aztecSandbox test/TestL1WarpToad.ts 
```

## compile contracts
### aztec
```
cd backend/contracts/aztec/WarpToadCore;
aztec-nargo compile;
aztec codegen -o src/artifacts target;
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
yarn workspace @warp-toad/backend ts-node scripts_dev_op/replaceLine.ts --file contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"
```

