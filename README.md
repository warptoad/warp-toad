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

make sure you're on aztec 0.82.3
```shell
aztec-up --version 0.82.3
```

install noir and backend
```shell
bbup -nv 1.0.0-beta.3;
noirup -v 1.0.0-beta.3;
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
`yarn ts-node scripts/dev_op/deployAztecToadWarp.ts`

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
yarn ts-node ./scripts/dev_op/replaceLine.ts --file ./contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"
```