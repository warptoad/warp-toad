# warp-toad
Cross bridge privacy


## deploy L1 aztec-sandbox
`yarn hardhat ignition deploy ./ignition/modules/WarpToadCore.js --parameters ignition/WarpToadCoreParameters.json --network aztecSandbox`

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

# copy to contracts folder
cp circuits/withdraw/target/contract.sol contracts/withdrawVerifier.sol
```


# run sandbox
`VERSION=0.82.3 aztec start --sandbox`