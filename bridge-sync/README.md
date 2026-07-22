# bridge-sync (BridgeKeeper)

HTTP service that triggers cross-chain root sync between EVM chains
(Sepolia, ZKsync Era Sepolia, local anvil) and Aztec testnet.

Calls `backend/lib/bridging.ts` directly in-process via cross-workspace
relative imports - no child processes, no stdout parsing, real promises with
real stack traces. Same code path the backend tests + sandbox sync scripts
exercise.

## Architecture

```
POST /bridge/{from}/{to}      ─┐
                                ├─→  in-process executeBridge()
                                │      ├─ viem clients (L1 + L2 EVM)
                                │      ├─ Aztec wallet (sponsored FPC, ephemeral)
                                │      ├─ contractLoader (reads Hardhat ABIs)
                                │      └─ bridgeBetweenL1AndL2() from backend/lib
GET  /status/{operationId}    ─┘
```

The Aztec wallet is generated fresh on the first bridge call (via `Fr.random()`)
and cached for the rest of the service lifetime. The SponsoredFPC pays gas, so
no Aztec credentials need to be funded.

## Bridge operation times

| Route | Approx duration |
|---|---|
| Sandbox local (chain 31337) | seconds |
| Sepolia ↔ Aztec testnet | 30 min - 1 hour |
| Sepolia ↔ ZKsync Era Sepolia | 30 min - 3 hours (2h batch window) |

**Do NOT use `waitForCompletion: true` in production** - it'll hold the HTTP
connection open for hours. Use `POST /bridge/...` to enqueue, then poll
`GET /status/{operationId}` instead.

## API

| Method + path | Purpose |
|---|---|
| `POST /bridge/{fromChainId}/{toChainId}` | Enqueue a bridge operation |
| `GET /status/{operationId}` | Check operation status |
| `GET /health` | Health probe |
| `GET /config` | List supported chains + routes |

### POST /bridge/{from}/{to}

Body (optional):
```json
{
  "waitForCompletion": false,
  "confirmations": 3
}
```

Chain IDs: `11155111` (Sepolia), `300` (ZKsync Era Sepolia), `31337` (local anvil), `aztec`.

Supported routes (see `src/bridge/chainMapper.ts:VALID_ROUTES`):
- `11155111 ↔ 300`
- `11155111 ↔ aztec`
- `31337 → 300` / `31337 → aztec` (local sandbox testing)

Response:
```json
{
  "ok": true,
  "operationId": "uuid",
  "status": "pending",
  "expectedDuration": "30 min - 1 hour"
}
```

## Run

### Via Docker compose (recommended)

The unified `docker-compose.yml` at the monorepo root runs bridge-sync,
relay-service, and the frontend on a shared `warptoad-network`. Configure
once via the root `.env`:

```bash
cd /path/to/warp-toad
cp .env.template .env
$EDITOR .env
docker compose up -d bridge-sync   # just this service
# or:
docker compose up -d               # all three
```

See the [root README](../README.md) for the full env-var list.

### Locally (dev)

```bash
cd bridge-sync
EVM_PRIVATE_KEY=0x... \
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY> \
SCROLL_RPC_URL=https://scroll-sepolia.infura.io/v3/<KEY> \
AZTEC_NODE_URL=https://v5.testnet.rpc.aztec-labs.com \
PORT=6969 \
pnpm dev
```

bridge-sync runs via `tsx` directly - no build step. The `start` and `dev`
scripts both invoke `tsx src/server.ts`.

## Required env

| Var | Purpose |
|---|---|
| `EVM_PRIVATE_KEY` | Signs L1 root-update + Scroll-message-dispatch txs. Should NOT be the same wallet as `RELAYER_PRIVATE_KEY` to avoid mempool nonce races. |
| `SEPOLIA_RPC_URL` | Sepolia L1 RPC |
| `ZKSYNC_ERA_SEPOLIA_RPC_URL` | ZKsync Era Sepolia L2 RPC (optional, defaults to the public endpoint) |
| `AZTEC_NODE_URL` | Aztec testnet full node, e.g. `https://v5.testnet.rpc.aztec-labs.com` |

Optional:
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `6969` | HTTP port |
| `ALLOWED_ORIGINS` | `https://warptoad.xyz,http://localhost:5173,http://localhost:3000` | CORS comma-separated list |
| `DEFAULT_CONFIRMATIONS` | `3` | L1 confirmation count |

## Persistence

Currently in-memory only - operation state is lost on restart. For a stateless
root-syncer that's fine; the service just enqueues work and the work itself
is durable on-chain.

## Notes

- Operations to the same `{from}/{to}` route are serialized via an in-memory
  lock to prevent concurrent bridges fighting on nonces
- The Aztec wallet is ephemeral per service lifetime - every restart deploys
  a fresh sponsored account on first use
- bridge-sync depends on `backend/` source files at runtime via tsx; for Docker
  builds the entire `backend/` workspace is copied into the image
