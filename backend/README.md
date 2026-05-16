# backend

Solidity + Aztec/Noir contracts, deploy + sync scripts, and the bridging
library that powers warp-toad's cross-chain root propagation.

This is a workspace package; most users should drive it via the root
[README](../README.md) shortcuts (`pnpm l:deploy`, `pnpm t:deploy`,
`pnpm b:test`, `pnpm b:compile` etc). The notes below cover what lives where
inside this workspace.

## Layout

```
backend/
├── contracts/                Solidity sources
│   ├── core/                   L1WarpToad, L2WarpToad, WarpToadCore (abstract)
│   ├── bridge/                 GigaBridge + per-L2 adapters (Aztec, Scroll)
│   ├── verifier/               Generated WithdrawVerifier.sol
│   └── interfaces/
├── aztec/                    Aztec/Noir contracts + generated TS artifacts
│   ├── WarpToadCore/           main.nr + src/artifacts/WarpToadCore.ts
│   └── L2AztecBridgeAdapter/
├── circuits/                 Noir circuits
│   └── withdraw/               main.nr + Prover.toml + target/withdraw.json
├── lib/                      Runtime library (viem-native, no hardhat)
│   ├── bridging.ts             Cross-chain orchestrator (bridgeBetweenL1AndL2 etc)
│   ├── proving.ts              ZK proof generation, calls bb binary
│   ├── hashing.ts              Poseidon helpers + generator-index constants
│   ├── constants.ts            Chain IDs, Scroll messenger addresses
│   └── types.ts
├── scripts/                  Deploy / sync / verify scripts (tsx + hardhat)
│   ├── deployLocal.ts          Local sandbox deploy (chain 31337)
│   ├── deployTestnet.ts        Testnet orchestrator (drives `hardhat ignition deploy` per phase, see root README)
│   ├── deployAztecTestnet.ts   Aztec testnet deploy (called by deployTestnet.ts phase 3 via aztec.js)
│   ├── emitNpmArtifacts.ts     Hardhat 3 workaround (emits per-contract JSON + patches userSourceNameMap for npm sources)
│   ├── verifyAztecScan.ts      Publish Aztec contracts to AztecScan
│   ├── aztecScanMetadata.ts    Deployer/contract metadata used by verifyAztecScan
│   ├── syncLocal.ts            L1 -> Aztec gigaRoot push (sandbox)
│   ├── syncLocalFromAztec.ts   Aztec -> L1 (full L2->L1 message + outbox + gigaRoot)
│   ├── syncTestnetToAztec.ts   Same as syncLocal but for Sepolia + Aztec testnet
│   ├── services/bridger.ts     CLI used by `pnpm bridge:runner`
│   └── utils.ts                Hardhat-aware helpers (artifact loading, deployed-addresses lookup)
├── deploy/                   Deployment definitions + recorded addresses
│   ├── ignition/modules/       Ignition module sources: L1WarpToad, L1Infra, L1Wire, L2Scroll, L2ScrollWire, TestToken, _loadNpmArtifact
│   ├── ignition/deployments/   Per-chain Ignition state (addresses, journal, artifacts, build-info)
│   │   ├── chain-31337/        Local sandbox
│   │   ├── chain-11155111/     Sepolia
│   │   └── chain-534351/       Scroll Sepolia
│   ├── aztec/aztecDeployments/ Aztec contract metadata (constructorArgs, salt, deployer) per chain
│   └── utils/aztecUtilsNoEnv.ts  Aztec PXE + sponsored wallet helpers
├── test/                     Backend test suite (5 tests)
│   ├── testL1ToL1.ts
│   ├── testL1ToAztec.ts
│   ├── testAztecToL1.ts
│   └── helpers/                deploy-evm, setup, artifacts
├── hardhat.config.ts         Networks: local, sepolia, scrollSepolia (read from .env)
├── .env.template             Required env for testnet deploy
└── package.json
```

## lib/ vs scripts/

- `lib/` is **runtime-pure**: only depends on viem + @aztec/* + @noir-lang/*.
  No hardhat. Can be imported from any workspace including bridge-sync (which
  pulls in `lib/bridging.ts` directly via cross-workspace relative imports).
- `scripts/` is **hardhat-aware**: `scripts/utils.ts` and the hardhat-runnable
  sync scripts (`syncLocal.ts`, `syncLocalFromAztec.ts`) import
  `hre from 'hardhat'`, which is why bridge-sync deliberately bypasses them
  with its own `contractLoader.ts`. The orchestrators (`deployTestnet.ts`,
  `deployAztecTestnet.ts`, `verifyAztecScan.ts`, `emitNpmArtifacts.ts`) run
  via tsx and don't pull in Hardhat at all.

## Compile

```bash
pnpm b:compile           # Solidity (Hardhat)
pnpm b:compile:aztec     # Aztec/Noir contracts
pnpm b:circuit           # Withdraw circuit + Solidity verifier (needs BB_BINARY_PATH)
```

See the [root README](../README.md#compile) for circuit / verifier details
and the `bb` binary requirement.

## Test

Requires the Aztec sandbox running and `BB_BINARY_PATH` exported. From the
monorepo root:

```bash
pnpm b:sandbox      # in another terminal
pnpm b:test         # full suite, ~2.5 min
```

Per-test invocation:
```bash
cd backend
npx hardhat test test/testL1ToL1.ts
npx hardhat test test/testL1ToAztec.ts
npx hardhat test test/testAztecToL1.ts
```

## Deploy

Configure `backend/.env` (see [`.env.template`](./.env.template)) with
`DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `SCROLL_SEPOLIA_RPC_URL`,
`AZTEC_NODE_URL`. Then from the monorepo root:

```bash
pnpm l:deploy       # local sandbox (chain 31337)
pnpm t:deploy       # Sepolia + Aztec testnet + Scroll Sepolia
```

Both shortcuts also run `pull:addresses` so the frontend's
`addresses.ts` registry stays in sync.

The testnet deploy is **idempotent** - re-running after a failure skips
already-deployed contracts and only retries the missing pieces.

### Hardhat 3 + .env loading

`backend/hardhat.config.ts` reads `process.env` directly (NOT
`configVariable()`, which falls back to an encrypted keystore by default).
The `deploy:testnet` script wraps the tsx orchestrator with `dotenv-cli` so
that `backend/.env` is loaded into `process.env` before any Hardhat subprocess
(spawned per phase) boots:

```jsonc
"deploy:testnet": "BB_BINARY_PATH=... dotenv -e .env -- tsx scripts/deployTestnet.ts"
```

This is a deliberate design choice. Don't switch back to `configVariable()` -
it'll prompt for a keystore password interactively at config-load time and
break non-interactive deploys.

The orchestrator spawns `pnpm exec hardhat ignition deploy <module>` per phase
and inherits the loaded env via `process.env`, so each child Hardhat process
sees the same `SEPOLIA_RPC_URL` etc. that the orchestrator was started with.
It also sets `HARDHAT_IGNITION_CONFIRM_DEPLOYMENT=1` /
`HARDHAT_IGNITION_CONFIRM_RESET=1` on the children to bypass Ignition's
interactive "Confirm deploy to network sepolia" prompt (which aborts under no
TTY).

## Sync (sandbox only)

After a burn on the local sandbox you need to propagate the gigaRoot. In
production the bridge-sync service does this automatically; locally:

```bash
pnpm l:sync                # L1 -> Aztec gigaRoot push
pnpm l:sync:from-aztec     # Aztec -> L1 (slow: waits for L2->L1 message + outbox)
```

## Importing the bridging library externally

`lib/bridging.ts` exports the cross-chain orchestration as plain functions
operating on viem clients + @aztec/* contract handles:

```ts
import { bridgeBetweenL1AndL2, getPayableGigaRootRecipients } from "./lib/bridging.js";

await bridgeBetweenL1AndL2(
  l1PublicClient, l1WalletClient,
  L1Adapter, gigaBridge, L2Adapter, L2WarpToad,
  localRootProviders,
  payableLocalRootProviders,
  { isAztec: true, PXE, sponsoredPaymentMethod, aztecNode, aztecWallet }
);
```

This is exactly what bridge-sync's `executor.ts` does internally - see
`bridge-sync/src/bridge/executor.ts` for a working example that builds the
viem clients + Aztec wallet from scratch.
