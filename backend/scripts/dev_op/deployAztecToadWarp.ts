
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
import { WarpToadCoreContractArtifact, WarpToadCoreContract as AztecWarpToadCore } from '../../contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore'

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,Wallet as AztecWallet  } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { USDcoin } from '../../typechain-types';
import { ethers } from "ethers";

const { PXE_URL = 'http://localhost:8080' } = process.env;

// this is the way to do it in a testing environment.
// for test/dev/main do this https://docs.aztec.network/developers/guides/js_apps/deploy_contract#using-generated-contract-class
// TODO create that script

async function deployAztecWarpToad(nativeToken: USDcoin|any, deployerWallet:AztecWallet) {
    const wrappedTokenSymbol = `wrpToad-${await nativeToken.symbol()}`
    const wrappedTokenName = `wrpToad-${await nativeToken.name()}`
    const decimals = 6n; // only 6 decimals what is this tether??

    const constructorArgs = [nativeToken.target, wrappedTokenName, wrappedTokenSymbol, decimals]
    const AztecWarpToad = await Contract.deploy(deployerWallet, WarpToadCoreContractArtifact, constructorArgs)
        .send()
        .deployed() as AztecWarpToadCore;

    return { AztecWarpToad };
}

async function main() {
    console.warn("WARNING: this is ONLY FOR TESTING. This is NOT FOR PROD")
    console.log("creating PXE client")
    const PXE = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(PXE);
    const wallets = await getInitialTestAccountsWallets(PXE);
    const deployWallet = wallets[0]

    // fake native token
    const fakeNativeToken = {
        symbol:async () => "symbol",
        name:async () => "name",
        target:ethers.getAddress("0x0000000000000000000000000000000000000000")
    }
    const {AztecWarpToad} = await deployAztecWarpToad(fakeNativeToken,deployWallet )
    console.log(`contract deployed at ${AztecWarpToad.address.toString()}`);
}
main();