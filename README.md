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
yarn hardhat ignition deploy ./ignition/modules/L1WarpToad.ts --parameters ignition/WarpToadCoreParameters.json --network aztecSandbox
```

### deploy L2 aztec-sandbox
`yarn ts-node scripts_dev_op/deployAztecToadWarp.ts`

## test contracts
test everything
```shell
yarn hardhat test --network aztecSandbox
```

test only one file (ex L1WarpToad)
```shell
yarn hardhat test --network aztecSandbox test/testL1WarpToad.ts 
```

## compile contracts
### aztec
```
cd contracts/aztec/WarpToadCore;
aztec-nargo compile;
aztec codegen -o src/artifacts target;
```

### generate EVM verifier contracts
<!-- //this should be a bash script lmao -->
```shell
cd circuits/withdraw/; 
nargo compile; 
bb write_vk -b ./target/withdraw.json;
bb contract;
cd ../..;

# move to contracts folder
mv circuits/withdraw/target/contract.sol contracts/evm/WithdrawVerifier.sol

# rename the contract
yarn ts-node scripts_dev_op/replaceLine.ts --file contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"
```

### generate vkhash and vkAsFields
-t 32 <- should be same tree depth in circuits/constants/lib.nr (sorry couldn't find a better way to do it)
```shell
cd circuits/EVMMerkleVerify;
nargo compile;
bb write_vk -b ./target/EVMMerkleVerify.json;
cd ../..;

cd circuits/GigaTreeMerkleVerify;
nargo compile;
bb write_vk -b ./target/GigaTreeMerkleVerify.json;
cd ../..;

yarn ts-node scripts_dev_op/getVkEvmMerkleCircuits.ts -c circuits/GigaTreeMerkleVerify/target/GigaTreeMerkleVerify.json -t 5 -o circuits/GigaTreeMerkleVerify/target/vkAsFields.json &

yarn ts-node scripts_dev_op/getVkEvmMerkleCircuits.ts -c circuits/EVMMerkleVerify/target/EVMMerkleVerify.json -t 32 -o circuits/EVMMerkleVerify/target/vkAsFields.json
```

