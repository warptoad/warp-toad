# relay-service

Gasless withdrawal relay for warp-toad. Accepts ZK proofs from users and
submits the corresponding `mint()` tx on the destination EVM chain on their
behalf.

Self-contained - no backend coupling. The only contract ABI it knows is
`WarpToadCore.mint(...)`, hardcoded inline. viem-native (no ethers).

Supported chains: Sepolia (`11155111`), Scroll Sepolia (`534351`), local
anvil (`31337`).

## Architecture

```
GET  /relay/info?chainId=...   ─→  returns relayer addr + gas price + bounds
POST /relay/withdraw           ─→  estimateContractGas → writeContract → poll
GET  /relay/status/{id}        ─→  in-memory operation state
GET  /health
```

The relayer's wallet is derived from `RELAYER_PRIVATE_KEY` via
`privateKeyToAccount`. One viem `walletClient` per chain (L1 + Scroll), all
sharing the same account.

For each `POST /relay/withdraw`:
1. Validate request (chainId, relayer addr matches our wallet, fee bounds)
2. `estimateContractGas` against `mint(...)` with the user's args + 25% headroom (falls back to a 1.2M gas floor on revert)
3. `writeContract` with `maxPriorityFeePerGas` and `maxFeePerGas` from the request
4. `waitForTransactionReceipt` and update operation state

## Run

### Via Docker compose (recommended)

The unified `docker-compose.yml` at the monorepo root runs relay-service,
bridge-sync, and the frontend on a shared `warptoad-network`. Configure
once via the root `.env`:

```bash
cd /path/to/warp-toad
cp .env.template .env
$EDITOR .env
docker compose up -d relay-service   # just this service
# or:
docker compose up -d                 # all three
```

See the [root README](../README.md) for the full env-var list.

### Locally (dev)

```bash
cd relay-service
RELAYER_PRIVATE_KEY=0x... \
L1_RPC_URL=https://sepolia.infura.io/v3/<KEY> \
SCROLL_RPC_URL=https://scroll-sepolia.infura.io/v3/<KEY> \
PORT=7777 \
pnpm dev
```

relay-service runs via `tsx` directly - no build step. Both `start` and `dev`
invoke `tsx src/server.ts`.

## Required env

| Var | Purpose |
|---|---|
| `RELAYER_PRIVATE_KEY` | Signs the `mint()` relay txs. Should be a different wallet from bridge-sync's `EVM_PRIVATE_KEY` to avoid mempool nonce races. |
| `L1_RPC_URL` | Sepolia L1 RPC |
| `SCROLL_RPC_URL` | Scroll Sepolia L2 RPC |

Optional:
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `7777` | HTTP port |
| `ALLOWED_ORIGINS` | `https://warptoad.xyz,http://localhost:5173,http://localhost:3000` | CORS comma-separated list |
| `MIN_FEE_FACTOR` | `0` | Minimum fee factor in basis points (`0` = altruistic relayer for testnet demo) |
| `MAX_FEE_FACTOR` | `0` | Maximum fee factor in basis points |
| `MIN_PROFIT_USD` | `0` | Minimum profit threshold (currently unused; kept for future profitability checks) |

## API

### GET /health

```json
{
  "ok": true,
  "uptime": 123,
  "timestamp": "...",
  "relayerAddress": "0x...",
  "supportedChains": [11155111, 31337, 534351]
}
```

### GET /relay/info?chainId={id}

Returns relayer address + current gas price + estimated gas cost ceiling for
the given chain. Used by the frontend to decide whether to use the gasless
flow and to display the relay address.

### POST /relay/withdraw

Body matches the frontend's `WithdrawRelayRequest` shape (see
`frontend/src/lib/utils/relay-client.ts`):

```json
{
  "chainId": "11155111",
  "contractAddress": "0x...",
  "nullifier": "0x...",
  "amount": "...",
  "gigaRoot": "...",
  "localRoot": "...",
  "feeFactor": "0",
  "priorityFee": "...",
  "maxFee": "...",
  "relayer": "0x...",       // must match this service's wallet
  "recipient": "0x...",
  "proof": "0x..."           // raw bytes hex
}
```

Returns `{ ok, operationId, status: "pending", estimatedConfirmationTime: 30 }`
immediately. Poll `GET /relay/status/{operationId}` for the actual tx hash and
final status.

### GET /relay/status/{operationId}

```json
{
  "ok": true,
  "operationId": "uuid",
  "status": "pending|validating|submitting|completed|failed",
  "txHash": "0x...",
  "gasUsed": "...",
  "startTime": 1234,
  "endTime": 1234
}
```

## Funding the relayer

For testnet:
- Sepolia ETH: https://sepoliafaucet.com/
- Scroll Sepolia ETH: https://scroll.io/bridge (bridge from Sepolia)

The required balance per relay tx is roughly 1.2M gas × current gas price.
With a small buffer ~0.05 ETH on each chain is plenty for hundreds of relays.

## Notes

- Operation state is in-memory only; lost on restart (acceptable for testnet
  demo, the user's wallet still has the tx hash from the response)
- The hardcoded fee model is altruistic for testnet (`feeFactor=0`). Setting
  `MIN_FEE_FACTOR` / `MAX_FEE_FACTOR` enables fee bounds checking but the
  actual fee logic on the contract side still needs revisiting before mainnet
- Gas estimation can revert when the proof is invalid; the service falls back
  to a 1.2M gas floor and submits anyway, letting the chain be the source of truth
