# Warp Toad

Cross-chain privacy bridge connecting Ethereum L1, Scroll L2, and Aztec L2 using zero-knowledge proofs.

## Architecture

Five workspaces in a single pnpm monorepo:

| Workspace | Role |
|---|---|
| `backend/` | Solidity + Aztec/Noir contracts, deploy + sync scripts, bridging library |
| `frontend/` | Svelte 5 + Vite SPA, in-browser Aztec wallet, ZK proof generation |
| `bridge-sync/` | HTTP service ("BridgeKeeper") that triggers cross-chain root sync. In-process viem-native, calls `backend/lib/bridging.ts` directly |
| `relay-service/` | HTTP service for gasless EVM withdrawals via meta-tx |
| `faucet-service/` | HTTP service that drips testnet ETH (Sepolia + Scroll Sepolia) to user wallets, one claim per chain |

The two services + the frontend can be run in Docker via a single root-level
`docker-compose.yml` (recommended), or locally for dev.

## Prerequisites

- Node.js >= 22
- pnpm 10.x
- nargo 1.0.0-beta.19
- Aztec sandbox (for cross-chain tests and local deployment)
- A locally-built `bb` binary at the same source tag as `@aztec/bb.js` (see [Locally-built bb](#locally-built-bb-required))
- Docker + docker compose (only needed for the unified-services flow)

## Install

```shell
pnpm install
```

Install nargo (Noir compiler):
```shell
noirup -v 1.0.0-beta.19
```

Install Aztec tooling (for sandbox/devnet):
```shell
aztec-up install 4.2.0-aztecnr-rc.2
```

## Compile

### Solidity contracts
```shell
pnpm b:compile
```

### Aztec Noir contracts
```shell
pnpm b:compile:aztec
```

### Withdraw circuit + Solidity verifier

Compiles the Noir circuit, generates the verification key, and generates the Solidity verifier contract.
Requires `BB_BINARY_PATH` to point at a locally-built `bb` (see [Locally-built bb](#locally-built-bb-required)).

```shell
export BB_BINARY_PATH=/path/to/aztec-packages/barretenberg/cpp/build/bin/bb
pnpm b:circuit
```

Or step by step:
```shell
pnpm b:circuit:compile    # nargo compile (also copies withdraw.json into frontend/)
pnpm b:circuit:vk         # bb write_vk (EVM target)
pnpm b:circuit:verifier   # bb write_solidity_verifier (EVM target)
```

## Locally-built bb (required)

The published `@aztec/bb.js@4.2.0-aztecnr-rc.2` ships an internally-inconsistent
combination: its WASM prover writes proofs with `PAIRING_POINTS_SIZE = 8`, but its
bundled Solidity verifier codegen template emits `PAIRING_POINTS_SIZE = 16`. The
two halves don't agree, so any verifier produced by the npm package's
`write_solidity_verifier` will reject every proof produced by the npm package's
`UltraHonkBackend.generateProof`. The aztec-packages source at the same git tag
is consistent (both halves use 8); it's only the published artifact that's broken.

The workaround is to build `bb` from source at that tag and use it for **both**
`write_solidity_verifier` and proof generation:

```shell
git clone --depth 1 --branch v4.2.0-aztecnr-rc.2 \
  https://github.com/AztecProtocol/aztec-packages
cd aztec-packages/barretenberg/cpp
CC=clang CXX=clang++ CFLAGS="-march=native" CXXFLAGS="-march=native" \
  cmake -B build -DCMAKE_BUILD_TYPE=RelWithAssert
cmake --build build --target bb --parallel
```

Then export the path before running circuit builds or backend tests:

```shell
export BB_BINARY_PATH=$PWD/build/bin/bb
```

`backend/lib/proving.ts` reads `BB_BINARY_PATH` and passes it to
`@aztec/bb.js` as the `bbPath` option, which makes it spawn this binary as a
native subprocess instead of falling back to the broken bundled WASM prover.
The `b:circuit:vk` and `b:circuit:verifier` scripts also require this env var.

## Test

**All backend tests require the Aztec sandbox to be running.** The Hardhat
`local` network in `backend/hardhat.config.ts` points at the sandbox's bundled
anvil (`http://localhost:8545`) so warp-toad's L1 contracts share an L1 chain
with the Aztec rollup, outbox, and inbox.

You also need `BB_BINARY_PATH` exported (see [Locally-built bb](#locally-built-bb-required))
because `backend/lib/proving.ts` spawns the local `bb` binary to generate the
withdraw circuit's UltraHonk proof.

```shell
pnpm b:sandbox                      # in one terminal, wait for "Aztec Server listening on port 8080"
export BB_BINARY_PATH=/path/to/aztec-packages/barretenberg/cpp/build/bin/bb
pnpm b:test                         # full suite, ~2.5 minutes
```

Each cross-chain test redeploys all contracts from scratch, so leaving the
sandbox running across multiple test runs is fine and faster than restarting
it between runs.

## Deploy

Deploy uses `dotenv-cli` to load `backend/.env` into the shell before Hardhat
boots, because Hardhat 3's `configVariable()` only reads from an encrypted
keystore by default - not from `process.env`. The `hardhat.config.ts` reads
RPC URLs / deployer key directly from `process.env`.

### Setup secrets

Copy the template and fill in your testnet credentials:

```shell
cp backend/.env.template backend/.env
$EDITOR backend/.env
```

Required vars:
```
DEPLOYER_PRIVATE_KEY=0x...                                # funded on both EVM chains
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY>
SCROLL_SEPOLIA_RPC_URL=https://scroll-sepolia.infura.io/v3/<KEY>
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com
```

You'll need ~0.05 Sepolia ETH and ~0.02 Scroll Sepolia ETH on the deployer.
The Aztec testnet deploy is gas-free (sponsored FPC).

### Local sandbox deploy

```shell
pnpm b:sandbox                      # start sandbox in another terminal
pnpm l:deploy                       # deploys L1 + Aztec to localhost, runs pull:addresses
```

### Testnet deploy

Deploys to Sepolia + Aztec testnet + Scroll Sepolia in a single orchestrated
script (`backend/scripts/deployTestnet.ts`). The script is idempotent; if
something fails partway through, just re-run it and it skips already-deployed
contracts.

```shell
pnpm t:deploy
```

This runs four phases in order:
1. **Phase A - Sepolia**: libs, USDcoin, verifier, L1WarpToad, L1AztecBridgeAdapter, L1ScrollBridgeAdapter, GigaBridge
2. **Phase B - Aztec testnet**: spins up an ephemeral sponsored Aztec wallet, deploys WarpToadCore + L2AztecBridgeAdapter, calls WarpToadCore.initialize
3. **Phase C - Scroll Sepolia**: libs, USDcoin, verifier, L2WarpToad, L2ScrollBridgeAdapter
4. **Phase D - Wire**: initialize() calls on L1WarpToad, L1AztecBridgeAdapter, L1ScrollBridgeAdapter (cross-chain pointers settle here)

When done, `pnpm --filter frontend pull:addresses` regenerates
`frontend/src/lib/contracts/addresses.ts` with all the new addresses.

To verify the Aztec contracts on AztecScan after deploy:

```shell
pnpm verify:aztec-scan
```

## Sync (manual, sandbox only)

After a burn on the local sandbox, the gigaRoot needs to be propagated. In
production the BridgeKeeper service does this automatically; locally you can
run it by hand:

```shell
pnpm l:sync                # L1 -> Aztec gigaRoot push
pnpm l:sync:from-aztec     # Aztec -> L1 (full L2->L1 message + outbox + gigaRoot)
```

## Run the services (Docker compose, recommended)

Single root-level `docker-compose.yml` runs the frontend, bridge-sync, and
relay-service on a shared `warptoad-network`. All three are configured from a
single root `.env`.

```shell
cp .env.template .env
$EDITOR .env                  # fill in keys, RPCs, etc
pnpm services:build           # or: docker compose build
pnpm services:up              # or: docker compose up -d
pnpm services:logs            # tail all 3
pnpm services:down            # stop all 3
```

Once up:
- Frontend → http://localhost:4173
- bridge-sync → http://localhost:6969 (`/health`, `/config`, `POST /bridge/{from}/{to}`)
- relay-service → http://localhost:7777 (`/health`, `/relay/info?chainId=...`, `POST /relay/withdraw`)
- faucet-service → http://localhost:8888 (`/health`, `/faucet/info?address=...`, `POST /faucet/claim`)

You can also run a single service: `docker compose up -d bridge-sync` only
spins up bridge-sync.

### Required env (root `.env`)

See [`.env.template`](./.env.template) for the full list with comments. The minimum is:

```
# bridge-sync (BridgeKeeper)
EVM_PRIVATE_KEY=0x...                                      # signs L1 root-update txs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY>
SCROLL_RPC_URL=https://scroll-sepolia.infura.io/v3/<KEY>
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com

# relay-service
RELAYER_PRIVATE_KEY=0x...                                  # signs mint() relay txs (use a different wallet from EVM_PRIVATE_KEY)

# faucet-service
FAUCET_PRIVATE_KEY=0x...                                   # third dedicated wallet, fund with ~5 ETH on each chain

# CORS (applies to all three)
ALLOWED_ORIGINS=https://your.frontend,http://localhost:4173
```

The Aztec deploy/sync flow uses the SponsoredFPC for gas, so neither service
needs an Aztec funded wallet.

### Frontend env (baked at build time)

Vite resolves `import.meta.env.VITE_*` to literal values during the build, so
to reconfigure RPC URLs / test mode / service URLs in the deployed image you
must rebuild: `docker compose build frontend`. The compose file passes these
as build args. Defaults are derived from the bridge-sync / relay-service
config above; override only when you want different URLs in the browser
bundle than the services listen on (e.g. production domains).

```
# uncomment + set in .env to override defaults
VITE_TEST_MODE=false
VITE_BRIDGE_KEEPER_URL=https://bridge.warptoad.xyz
VITE_RELAY_SERVICE_URL=https://relay.warptoad.xyz
```

## Run the services (local dev, no Docker)

For iterative development on bridge-sync or relay-service.

### bridge-sync

```shell
cd bridge-sync
EVM_PRIVATE_KEY=0x... \
SEPOLIA_RPC_URL=https://... \
SCROLL_RPC_URL=https://... \
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com \
PORT=6969 \
pnpm dev
```

### relay-service

```shell
cd relay-service
RELAYER_PRIVATE_KEY=0x... \
L1_RPC_URL=https://... \
SCROLL_RPC_URL=https://... \
PORT=7777 \
pnpm dev
```

### Frontend

The Vite dev server doesn't work for warp-toad due to wasm-bindgen filename
collisions between `@noir-lang/*` and `@aztec/noir-*`. **Always use build +
preview**:

```shell
cd frontend
pnpm build && pnpm preview
```

For local sandbox testing set `VITE_TEST_MODE=true` in `frontend/.env`.

## Version Compatibility

| Component | Version |
|-----------|---------|
| `@aztec/*` packages | `4.2.0-aztecnr-rc.2` |
| Aztec testnet node | `4.2.0-nightly.20260408-1` (rpc.testnet.aztec-labs.com) |
| `@noir-lang/noir_js` | `1.0.0-beta.19` |
| nargo | `1.0.0-beta.19` |
| Solidity | `0.8.29` |
| Hardhat | `3.x` |
| Node.js | `>= 22` |
| Docker base image | `node:22-trixie-slim` (Debian 13) |

The `bb` binary used for VK/verifier generation **and** for proof generation
in the test pipeline **must** be a locally-built `bb` from the
`v4.2.0-aztecnr-rc.2` source tag of aztec-packages, not the one bundled with
the published `@aztec/bb.js@4.2.0-aztecnr-rc.2`. The published bundle is
internally inconsistent (its codegen template hardcodes `PAIRING_POINTS_SIZE = 16`
while its WASM prover writes 8). See
[Locally-built bb](#locally-built-bb-required).

The Docker images run on Debian trixie (Debian 13) instead of bookworm
(Debian 12) because `@aztec/bb.js` ships a precompiled native module that
requires `libstdc++` from GCC 13+ (`GLIBCXX_3.4.32`). Bookworm ships GCC 12;
trixie ships GCC 14. Alpine doesn't work at all - the precompiled module is
glibc-only.
