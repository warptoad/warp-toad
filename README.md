Circuit size is way too big idk how this works
```shell
Scheme is: ultra_honk
Finalized circuit size: 2178922
```
individually circuits total is smaller: 
```shell
EVM merkle:                         2050240
aztec (copy paste of EVM merkle):   59673
giga tree:                          9336
total:                              128682
main circuit is larger by:          2050240
```
main circuit should be faster than generating 1 EVM merkle proofs. Other wise this makes no sense.  
I haven't tried actual benchmarks yet though  

Saleel from aztec said the dev UX of recursion will be a lott better in the future: https://discord.com/channels/1113924620781883405/1362902910605857149/1363365873632677929


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

### set vkhash and vkAsFields into main circuit
-t 32 <- should be same tree depth in circuits/constants/lib.nr (sorry couldn't find a better way to do it)
```shell
cd circuits/EVMMerkleVerify;
nargo compile;
bb write_vk -b ./target/EVMMerkleVerify.json -o ./target/;
cd ../..;

cd circuits/GigaTreeMerkleVerify;
nargo compile;
bb write_vk -b ./target/GigaTreeMerkleVerify.json -o ./target/;
cd ../..;

yarn ts-node scripts_dev_op/setVkAsFields.ts -r circuits/GigaTreeMerkleVerify -c GigaTreeMerkleVerify -ct EVM -d 5 -j &

yarn ts-node scripts_dev_op/setVkAsFields.ts -r circuits/EVMMerkleVerify -c EVMMerkleVerify -ct EVM -d 32 -j
```

