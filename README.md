# Warp Toad

Cross-chain privacy bridge connecting Ethereum L1, Scroll L2, and Aztec L2 using zero-knowledge proofs.

## Prerequisites

- Node.js >= 22
- pnpm 10.x
- nargo 1.0.0-beta.19
- Aztec sandbox (for cross-chain tests and local deployment)

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
Uses the `bb` binary bundled with `@aztec/bb.js` to ensure version compatibility.

```shell
pnpm b:circuit
```

Or step by step:
```shell
pnpm b:circuit:compile    # nargo compile
pnpm b:circuit:vk         # bb write_vk (EVM target)
pnpm b:circuit:verifier   # bb write_solidity_verifier (EVM target)
```

## Test

### L1 to L1 (same-chain, no Aztec sandbox needed)
```shell
cd backend
npx hardhat test test/testL1ToL1.ts
```

This test deploys all EVM contracts on Hardhat's in-process EDR network, burns a commitment, generates a ZK proof, and mints on the same chain. No external services required.

### Cross-chain tests (requires Aztec sandbox)

Start the sandbox first:
```shell
pnpm b:sandbox
```

Then run:
```shell
cd backend

# L1 -> Aztec
npx hardhat test test/testL1ToAztec.ts

# Aztec -> L1
npx hardhat test test/testAztecToL1.ts

# All tests
npx hardhat test
```

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

The `bb` binary used for VK/verifier generation **must** match the `@aztec/bb.js` version. The build scripts use the `bb` bundled with `@aztec/bb.js` to ensure this.
