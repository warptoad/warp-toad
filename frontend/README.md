# frontend

Svelte 5 + Vite SPA for the warp-toad privacy bridge. In-browser Aztec
wallet, in-browser ZK proof generation via the same `bb` binary as the
backend tests.

This is a workspace package; for the full Docker stack see the
[root README](../README.md).

## Architecture

- Svelte 5 (runes mode) + Vite 7 + Tailwind v4
- viem for all EVM interaction (no ethers, no wagmi)
- `@aztec/wallets` `BrowserEmbeddedWallet` for the in-browser Aztec wallet
- `@noir-lang/noir_js` + `@aztec/bb.js` for client-side proof generation
- shadcn-svelte primitives + bits-ui for the UI atoms
- Theme-aware ASCII noise canvas background, light/dark mode toggle (system / light / dark cycle)

Three forms in three tabs:
- **Transfer**: same-chain L1 → L1 (or Scroll → Scroll) deposit + withdraw round-trip
- **Bridge**: cross-chain deposit (L1 → L2 / L2 → L1 / EVM → Aztec / Aztec → EVM)
- **Withdraw**: upload a proof JSON, optionally use the gasless relayer, mint on the destination chain

## Why `pnpm build` + `pnpm preview` instead of `pnpm dev`

The Vite dev server cannot serve this app. There are two transitive copies of
`wasm-bindgen` (one from `@noir-lang/noir_js`, one from the
`@aztec/noir-acvm_js` family) and they ship `_bg.wasm` files with the same
basename but different ABIs. Vite's dev server has no way to disambiguate
them.

The production build path (`pnpm build`) DOES disambiguate them via an
esbuild plugin in `vite.config.ts` that rewrites the wasm URLs during
`optimizeDeps`, plus a postbuild script (`scripts/patch-dist.js`) that
re-adds class names that Rollup strips during scope-hoisting (Aztec uses
`class.name` for static initializers).

**Always use `pnpm build && pnpm preview`** - never `pnpm dev`. This is
documented in the `feedback_frontend_use_build_preview` memory.

## Setup

### 1. Install (from monorepo root, not here)

```bash
cd ..
pnpm install
```

### 2. Configure env

```bash
cp .env.template .env
$EDITOR .env
```

Required for local sandbox:
```
VITE_TEST_MODE=true
VITE_LOCAL_AZTEC_NODE_URL=http://localhost:8080      # default; override if non-standard
```

For testnet:
```
VITE_TEST_MODE=false
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY>
VITE_SCROLL_SEPOLIA_RPC_URL=https://scroll-sepolia.infura.io/v3/<KEY>
VITE_AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com
VITE_BRIDGE_KEEPER_URL=https://bridge.warptoad.xyz   # or http://localhost:6969 if running locally
VITE_RELAY_SERVICE_URL=https://relay.warptoad.xyz    # or http://localhost:7777 if running locally
```

Vite bakes `VITE_*` env vars at **build time**. To reconfigure, you must
rebuild (`pnpm build`).

### 3. Generate frontend artifacts

```bash
pnpm f:prep      # generate:abis + pull:addresses (from monorepo root)
```

This regenerates `src/lib/contracts/abis/` (from Hardhat compiled artifacts)
and `src/lib/contracts/addresses.ts` (from `backend/deploy/.../deployed_addresses.json`).
Run this whenever the backend re-deploys or recompiles.

### 4. Build + serve

```bash
pnpm f:run       # build && preview, from monorepo root
# or:
cd frontend
pnpm build && pnpm preview
```

The preview server listens on `http://localhost:4173` by default.

## Withdraw flow

1. Connect both wallets:
   - **MetaMask** (or other EVM wallet) for L1/Scroll
   - **In-browser Aztec wallet** auto-spins up via `BrowserEmbeddedWallet` (no extension needed)
2. Go to the **Withdraw** tab, upload your proof JSON or pick one from the saved proofs table
3. (Optional) Toggle **Gasless Withdrawal** to use the relay service. Only available for EVM destinations (`Aztec → L1`, `Aztec → Scroll`, any `EVM → EVM`). Aztec destinations always use the user's own wallet because the EVM relayer can't broadcast Aztec txs.
4. Click withdraw. The frontend generates the ZK proof in-browser (~30-60s), then either submits the `mint()` tx itself or POSTs the proof to relay-service for gasless submission.

## Memory of gotchas

If something breaks in a familiar way, check these memories first:

- `feedback_frontend_use_build_preview` - dev server fundamentally broken, use build+preview
- `feedback_aztec_noir_version_pinning` - pin `@aztec/noir-*` via `pnpm.overrides` or you get 3+ wasm-bindgen versions
- `feedback_vite_deps_cache_invalidation` - `rm -rf node_modules/.vite && pnpm dev --force` after pnpm changes
- `feedback_wasm_bindgen_dual_versions` - disambiguate via the esbuild plugin in `vite.config.ts`, NOT in middleware
- `feedback_aztec_class_static_initializer` - `scripts/patch-dist.js` postbuild script for Rollup name-stripping
- `feedback_circuit_sync` - `b:circuit:compile` auto-copies `withdraw.json` here from backend
- `feedback_aztec_note_hash_pitfalls` - generator-index constants must mirror backend; use `getLocalRootAndBlock()` not events

## Docker

For the full unified stack (frontend + bridge-sync + relay-service in one
network), see the [root README](../README.md#run-the-services-docker-compose-recommended).
The frontend has its own multi-stage Dockerfile (`frontend/Dockerfile`) but
should be driven via the root `docker-compose.yml`:

```bash
cd ..
docker compose build frontend
docker compose up -d frontend
```

`VITE_*` env vars must be passed as Docker build args, not runtime env. The
root compose file already wires those up from your root `.env`.
