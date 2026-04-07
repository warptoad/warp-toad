# Warp Toad

Cross-chain privacy bridge connecting Ethereum L1, Scroll L2, and Aztec L2 using zero-knowledge proofs.

## Prerequisites

- Node.js >= 22
- pnpm 10.x
- nargo 1.0.0-beta.19
- Aztec sandbox (for cross-chain tests and local deployment)
- A locally-built `bb` binary at the same source tag as `@aztec/bb.js` (see [Locally-built bb](#locally-built-bb-required))

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
pnpm b:circuit:compile    # nargo compile
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
anvil (`http://localhost:8545`) so warp-toad's L1 contracts can share an L1
chain with the Aztec rollup, outbox, and inbox. Even the L1↔L1 test runs
against that anvil now.

You also need `BB_BINARY_PATH` exported (see [Locally-built bb](#locally-built-bb-required))
because `backend/lib/proving.ts` spawns the local `bb` binary to generate the
withdraw circuit's UltraHonk proof, and the test pipeline reads it from the env.

Start the sandbox first:
```shell
pnpm b:sandbox
```
Wait for `Aztec Server listening on port 8080` in the sandbox terminal.

Then run from the backend directory:
```shell
cd backend
export BB_BINARY_PATH=/path/to/aztec-packages/barretenberg/cpp/build/bin/bb

# Full suite (5 tests, ~2.5 minutes)
npx hardhat test

# Or individual files
npx hardhat test test/testL1ToL1.ts        # L1 same-chain ZK round-trip
npx hardhat test test/testL1ToAztec.ts     # L1 -> Aztec cross-chain mint
npx hardhat test test/testAztecToL1.ts     # Aztec -> L1 cross-chain mint
```

Each cross-chain test redeploys all contracts from scratch, so leaving the
sandbox running across multiple test runs is fine and faster than restarting
it between runs.

## Deploy

### Setup secrets
```shell
cd backend
npx hardhat vars set DEPLOYER_PRIVATE_KEY
npx hardhat vars set SEPOLIA_RPC_URL
npx hardhat vars set SCROLL_SEPOLIA_RPC_URL
```

### Local/sandbox deployment

#### 1. Start sandbox
```shell
pnpm b:sandbox
```

#### 2. Deploy on L1
```shell
cd backend
NATIVE_TOKEN_ADDRESS=0xYourTokenAddress npx hardhat run scripts/deploy/L1/deployL1.ts --network local
```

#### 3. Deploy on Aztec
```shell
NATIVE_TOKEN_ADDRESS=0xYourTokenAddress PXE_URL=http://localhost:8080 npx hardhat run scripts/deploy/aztec/deployAztec.ts --network local
```

#### 4. Initialize contracts
```shell
PXE_URL=http://localhost:8080 npx hardhat run scripts/deploy/L1/initializeL1.ts --network local
PXE_URL=http://localhost:8080 npx hardhat run scripts/deploy/aztec/initializeAztec.ts --network local
```

### Testnet deployment

#### 1. Deploy on Sepolia
```shell
cd backend
NATIVE_TOKEN_ADDRESS=0xYourTokenAddress npx hardhat run scripts/deploy/L1/deployL1.ts --network sepolia
```

#### 2. Deploy on Aztec testnet
```shell
NATIVE_TOKEN_ADDRESS=0xYourTokenAddress PXE_URL=https://rpc.testnet.aztec-labs.com npx hardhat run scripts/deploy/aztec/deployAztec.ts --network sepolia
```

#### 3. Deploy on Scroll Sepolia
```shell
NATIVE_TOKEN_ADDRESS=0xYourTokenAddress npx hardhat run scripts/deploy/scroll/deployL2Scroll.ts --network scrollSepolia
```

#### 4. Initialize contracts
```shell
# L1
PXE_URL=https://rpc.testnet.aztec-labs.com npx hardhat run scripts/deploy/L1/initializeL1.ts --network sepolia
# Aztec
PXE_URL=https://rpc.testnet.aztec-labs.com npx hardhat run scripts/deploy/aztec/initializeAztec.ts --network sepolia
# Scroll
npx hardhat run scripts/deploy/scroll/initializeL2Scroll.ts --network scrollSepolia
```

## Bridge

### Local/sandbox
```shell
PXE_URL=http://localhost:8080 pnpm --filter @warp-toad/backend tsx scripts/services/bridger.ts --isAztec --localRootProviders 0xL1WarpToadAddress 0xL1AztecAdapterAddress
```

### Aztec testnet
Takes about 0.5-1 hour.
```shell
pnpm --filter @warp-toad/backend tsx scripts/services/bridger.ts --L1Rpc <URL> --L2Rpc https://rpc.testnet.aztec-labs.com --privatekey 0xYourKey --isAztec
```

### Scroll
Note: Requires a paid RPC (free RPCs don't support event queries well enough). Takes about 2-3 hours.
```shell
pnpm --filter @warp-toad/backend tsx scripts/services/bridger.ts --L1Rpc <SEPOLIA_URL> --L2Rpc <SCROLL_URL> --evmPrivatekey 0xYourKey
```

## Bridge Sync Service

### 1. Setup
```shell
cd bridge-sync
cp .env.template .env
```
Edit `.env` (for local testing set `ALLOWED_ORIGINS` to the frontend port).

### 2. Run
```shell
pnpm bridge:dev
```
Or build and run via Docker:
```shell
pnpm bridge:docker && pnpm bridge:docker:run
```

## Frontend

### 1. Setup
```shell
cd frontend
cp .env.template .env
```
Edit `.env` (for local testing set `VITE_TEST_MODE=true` and `VITE_BRIDGE_KEEPER_URL=http://localhost:6969`).

### 2. Generate artifacts
```shell
pnpm f:prep
```

### 3. Run
```shell
pnpm f:dev
```
Or with proving support:
```shell
pnpm f:run
```

## Version Compatibility

| Component | Version |
|-----------|---------|
| `@aztec/*` packages | `4.2.0-aztecnr-rc.2` |
| `@noir-lang/noir_js` | `1.0.0-beta.19` |
| nargo | `1.0.0-beta.19` |
| Solidity | `0.8.29` |
| Hardhat | `3.x` |
| Node.js | `>= 22` |

The `bb` binary used for VK/verifier generation **and** for proof generation
in the test pipeline **must** be a locally-built `bb` from the
`v4.2.0-aztecnr-rc.2` source tag of aztec-packages, not the one bundled with
the published `@aztec/bb.js@4.2.0-aztecnr-rc.2`. The published bundle is
internally inconsistent (its codegen template hardcodes `PAIRING_POINTS_SIZE = 16`
while its WASM prover writes 8). See
[Locally-built bb](#locally-built-bb-required).
