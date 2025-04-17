# warp-toad
Cross bridge privacy


## deploy L1 aztec-sandbox
`yarn hardhat ignition deploy ./ignition/modules/L1WarpToad.ts --parameters ignition/WarpToadCoreParameters.json --network aztecSandbox`

## deploy on aztec TODODODODODO
`yarn ts-node scripts_dev_op/deployAztecToadWarp.ts`

## test contracts
make sure you're on node 20
```shell
nvm install 20;
nvm use 20;
npm install --global yarn;
yarn install;
```
run test
```shell
yarn hardhat test --network aztecSandbox
```

## compile aztec contracts
`aztec-nargo compile`

# install noir and backend
```shell
bbup -nv 1.0.0-beta.2
```

```shell
noirup -v 1.0.0-beta.2
```

# generate verifier contracts
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


# run sandbox
`VERSION=0.82.3 aztec start --sandbox`