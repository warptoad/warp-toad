/**
 * Deploy the L1 contract stack to a local anvil (the one bundled with the
 * Aztec sandbox at localhost:8545). Writes the resulting addresses to
 * `deploy/ignition/deployments/chain-31337/deployed_addresses.json` so the
 * frontend's `pull:addresses` script can pick them up.
 *
 * Usage:
 *   pnpm hardhat run scripts/deployLocal.ts --network local
 *
 * Or via the workspace shortcut:
 *   pnpm l:deploy
 *
 * Run this once after every anvil restart (the Aztec sandbox restarts anvil
 * each time you `aztec start --local-network`, wiping all deployed state).
 *
 * Re-uses the same `deployEvmContracts` helper the test suite uses, so the
 * deployment shape is identical to what the tests prove works.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deployEvmContracts } from "../test/helpers/deploy-evm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("Deploying L1 stack to localhost anvil...");

    // withAztecAdapter:true also deploys L1AztecBridgeAdapter so the frontend's
    // L1<->Aztec UI has an address to point at. We then manually initialize
    // L1WarpToad with aztecWarptoadAddress=0n; the L1<->L1 and L1<->Scroll flows
    // don't need a real Aztec address, and L1<->Aztec needs the Aztec contracts
    // deployed separately anyway (a follow-up `l:deploy:aztec` command).
    const evm = await deployEvmContracts({ withAztecAdapter: true });

    // Initialize L1WarpToad with aztecWarptoadAddress=0n. The withAztecAdapter
    // path skips initialize() so it can be done after Aztec contracts exist;
    // for a local-deploy without Aztec we just init with 0 right here.
    const initHash = await (evm.l1WarpToad.write.initialize as any)([
        evm.gigaBridge.address,
        evm.l1WarpToad.address,
        0n, // aztecWarptoadAddress; replace with the real Aztec WarpToad
            // bigint when running l:deploy:aztec
    ]);
    await evm.publicClient.waitForTransactionReceipt({ hash: initHash });

    // Write the addresses file in the format pull-contract-addresses.ts expects:
    // keys are `<IgnitionModule>#<ContractName>`. We synthesize Ignition-shaped
    // keys even though we used the test deployer, so the existing pull script
    // doesn't need to know.
    const addresses: Record<string, string> = {
        "TestToken#USDcoin": evm.nativeToken.address,
        "L1WarpToadModule#L1WarpToad": evm.l1WarpToad.address,
        "L1WarpToadModule#WithdrawVerifier": evm.withdrawVerifier.address,
        "L1InfraModule#GigaBridge": evm.gigaBridge.address,
        "L1InfraModule#L1WarpToad": evm.l1WarpToad.address,
    };
    if (evm.l1AztecBridgeAdapter) {
        addresses["L1InfraModule#L1AztecBridgeAdapter"] = evm.l1AztecBridgeAdapter.address;
    }

    const outDir = path.resolve(__dirname, "../deploy/ignition/deployments/chain-31337");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "deployed_addresses.json");
    fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2) + "\n");

    console.log("\nDeployed:");
    for (const [k, v] of Object.entries(addresses)) {
        console.log(`  ${k.padEnd(40)} ${v}`);
    }
    console.log(`\nWrote ${outPath}`);
    console.log(
        "\nNext step: refresh the frontend's address registry with `pnpm --filter frontend pull:addresses`",
    );
    console.log("(or use `pnpm l:deploy` which does both in one shot)");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
