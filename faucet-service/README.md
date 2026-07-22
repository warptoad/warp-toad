# faucet-service

Testnet ETH faucet for warp-toad. Drips a fixed amount of Sepolia / ZKsync Era
Sepolia ETH per wallet, one claim per chain forever (no cooldown).

Self-contained. viem-native, no backend coupling, runs via tsx.

## API

| Method + path | Purpose |
|---|---|
| `GET /health` | Faucet wallet address, drip amount, balances per chain, total claims |
| `GET /faucet/info?address=0x...` | Per-chain claim status for the given address |
| `POST /faucet/claim` | Body `{ chainId, address }`. Sends a drip and records the claim. |

### POST /faucet/claim

Body:
```json
{
  "chainId": 11155111,
  "address": "0x..."
}
```

Returns:
```json
{
  "ok": true,
  "txHash": "0x...",
  "chainId": 11155111,
  "address": "0x...",
  "amountWei": "50000000000000000"
}
```

Errors:
- `400` invalid chainId / address
- `409` already claimed on this chain
- `429` rate-limited (>5 requests/min from same IP)
- `503` faucet wallet out of funds

## Run

### Via Docker compose (recommended)

The unified `docker-compose.yml` at the monorepo root runs faucet-service
alongside the rest of the stack on the shared `warptoad-network`. Configure
once via the root `.env`:

```bash
cd /path/to/warp-toad
cp .env.template .env
$EDITOR .env
docker compose up -d faucet-service
# or:
docker compose up -d
```

### Locally (dev)

```bash
cd faucet-service
FAUCET_PRIVATE_KEY=0x... \
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<KEY> \
ZKSYNC_ERA_SEPOLIA_RPC_URL=https://sepolia.era.zksync.dev \
PORT=8888 \
pnpm dev
```

## Required env

| Var | Purpose |
|---|---|
| `FAUCET_PRIVATE_KEY` | Wallet that holds the testnet ETH and signs the drip txs. Should be a dedicated wallet, NOT the same as bridge-sync's `EVM_PRIVATE_KEY` or relay-service's `RELAYER_PRIVATE_KEY`. |
| `SEPOLIA_RPC_URL` | Sepolia L1 RPC (also accepts `L1_RPC_URL` as a fallback) |
| `ZKSYNC_ERA_SEPOLIA_RPC_URL` | ZKsync Era Sepolia L2 RPC (optional, defaults to the public endpoint) |

Optional:
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8888` | HTTP port |
| `FAUCET_DRIP_AMOUNT_ETH` | `0.05` | ETH per claim |
| `FAUCET_LEDGER_PATH` | `./db/claims.json` | Where the per-wallet claim ledger is stored |
| `ALLOWED_ORIGINS` | `https://warptoad.xyz,http://localhost:5173,http://localhost:4173` | CORS comma-separated list |

## Funding the faucet

After setting `FAUCET_PRIVATE_KEY` you can derive the address by running the
service once and reading the `Faucet Address: 0x...` line from the boot logs,
or via:

```bash
node -e "const { privateKeyToAccount } = require('viem/accounts'); console.log(privateKeyToAccount(process.env.FAUCET_PRIVATE_KEY).address)"
```

Then send testnet ETH to that address on each chain:
- Sepolia: https://sepoliafaucet.com/ (or any other Sepolia faucet)
- ZKsync Era Sepolia: bridge from Sepolia via https://portal.zksync.io/bridge/?network=sepolia

5 ETH per chain ÷ 0.05 ETH drip = 100 claims per chain before refill is needed.
The `/health` endpoint reports current balances so you can monitor.

## Persistence

Claims are stored in a single JSON file (`db/claims.json` by default), mounted
as a docker volume so state survives container restarts. Format:

```json
{
  "claims": {
    "0xabc...": [
      { "chainId": 11155111, "txHash": "0x...", "timestamp": 1700000000000 }
    ]
  }
}
```

To clear a specific claim manually (e.g. after a refund or a failed tx that
the user reports), edit the JSON file and restart the container.

## Notes

- One claim per `(address, chainId)` pair, forever. No cooldown.
- Rate limit: 5 claim requests/minute per IP.
- The ledger entry is recorded BEFORE waiting for the tx receipt, so a user
  who queries `/info` while their tx is still mining sees `claimed: true`.
- If a tx reverts after being recorded (very rare for plain ETH transfers),
  manually clear the entry from the JSON file.
- No CAPTCHA, no proof-of-personhood. This is testnet ETH; the rate limit +
  per-address-once limit are sufficient anti-abuse for low-value drips.
