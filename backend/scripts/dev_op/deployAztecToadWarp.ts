import WarpToadCoreContractArtifactJson from '../../contracts/aztec/WarpToadCore/target/WarpToadCore-WarpToadCore.json'
//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact,loadContractArtifact, NoirCompiledContract } from "@aztec/aztec.js"
export const WarpToadCoreContractArtifact = loadContractArtifact(WarpToadCoreContractArtifactJson as NoirCompiledContract);

//@ts-ignore
import { createPXEClient, waitForPXE, Contract, ContractArtifact } from "@aztec/aztec.js"

//@ts-ignore
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'; // idk why but node is bitching about this but bun doesnt care

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const { PXE_URL = 'http://localhost:8080' } = process.env;

// this is the way to do it in a testing environment.
// for test/dev/main do this https://docs.aztec.network/developers/guides/js_apps/deploy_contract#using-generated-contract-class
// TODO create that script
async function main() {
    console.log("creating PXE client")
    const pxe = createPXEClient(PXE_URL);
    console.log("waiting on PXE client", PXE_URL)
    await waitForPXE(pxe);

    console.log("getting test accounts")
    const [ownerWallet] = await getInitialTestAccountsWallets(pxe);
    const ownerAddress = ownerWallet.getAddress();

    console.log("deploying")
    const wrappedTokenSymbol = `wrpToad-${"symbol"}`
    const wrappedTokenName = `wrpToad-${"name"}`
    const decimals = 6n; // only 6 decimals what is this tether??
    const giga_bridge_adapter = "0x0000000000000000000000000000000000000000000000000000000000000000"
    //_giga_bridge_adapter: AztecAddress, _name: str<31>, _symbol: str<31>, _decimals: u8
    const constructorArgs = [giga_bridge_adapter,wrappedTokenName,wrappedTokenSymbol,decimals]
    const WarpToadCoreDeployed = await Contract.deploy(ownerWallet, WarpToadCoreContractArtifact, constructorArgs)
        .send()
        .deployed();

    console.log(`contract deployed at ${WarpToadCoreDeployed.address.toString()}`);

    const addresses = { contract: WarpToadCoreDeployed.address.toString() };
    writeFileSync('WarptoadCoreAztecDeployment.json', JSON.stringify(addresses, null, 2));
}
main();