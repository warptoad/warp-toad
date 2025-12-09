# WarpToad Frontend

Svelte 5 application for interacting with the WarpToad privacy bridge.

## Prerequisites

- Node.js 20+
- Yarn
- Running Aztec Sandbox (for Aztec interactions)
- Running Anvil/local EVM node (for L1 interactions)
- Azguard Wallet browser extension (for Aztec wallet)
- MetaMask or similar (for EVM wallet)

## Setup

1. Copy the template environment file:
```bash
cp template.env .env
```

2. Configure the environment variables in `.env`:
```bash
# Aztec Configuration
VITE_AZTEC_NODE_URL=http://localhost:8080        # Aztec sandbox URL
VITE_AZTEC_WARPTOAD_ADDRESS=0x...                # Deployed WarpToad contract on Aztec

# Optional: Source chain configuration
VITE_SOURCE_CHAIN_ID=31337                       # L1 chain ID (31337 for anvil, 11155111 for Sepolia)

# Local development (set to 'true' for sandbox, leave empty for devnet)
VITE_LOCAL=true
```

3. Install dependencies:
```bash
yarn install
```

4. Generate contract ABIs (if not already done):
```bash
yarn run generate:abis
```

5. Pull contract addresses (if using Ignition deployments):
```bash
yarn run pull:addresses
```

## Development

```bash
yarn run dev
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_AZTEC_NODE_URL` | Yes | `http://localhost:8080` | URL of the Aztec node/sandbox |
| `VITE_AZTEC_WARPTOAD_ADDRESS` | Yes | - | Address of the WarpToad contract on Aztec |
| `VITE_SOURCE_CHAIN_ID` | No | `31337` | L1 chain ID for withdraw validation |
| `VITE_LOCAL` | No | - | Set to `true` for sandbox mode |

## Withdraw Flow (L1 -> Aztec)

The withdraw flow requires:

1. **Completed burn on L1**: User must have burned tokens on L1WarpToad with a commitment
2. **Bridge sync**: The GigaBridge must have synced the local root to the gigaRoot
3. **GigaRoot on Aztec**: The gigaRoot must have been sent to the Aztec WarpToad contract
4. **Valid note**: User must have their note file containing the commitment secrets

### Steps:
1. Connect both EVM wallet (MetaMask) and Aztec wallet (Azguard)
2. Go to the "Withdraw" tab
3. Upload your proof/note file or select from saved proofs
4. Click "Withdraw to Aztec"
5. Wait for the transaction to complete

### Troubleshooting

**"GigaRoot has not been synced to Aztec yet"**
- The bridge relayer needs to sync the root. This happens periodically.
- For local development, manually trigger the bridge sync from the backend scripts.

**"Commitment not found on source chain"**
- Ensure the burn transaction completed on L1
- Check that you're using the correct source chain ID

**"Cannot connect to Aztec node"**
- Ensure the Aztec sandbox is running: `aztec start --sandbox`
- Check the `VITE_AZTEC_NODE_URL` environment variable

**"VITE_AZTEC_WARPTOAD_ADDRESS not set"**
- Deploy the WarpToad contract to Aztec and set the address in `.env`

## Architecture

```
src/
├── lib/
│   ├── components/        # Svelte components
│   │   ├── BridgeForm.svelte     # L1 burn/bridge UI
│   │   └── WithdrawForm.svelte   # Aztec mint/withdraw UI
│   ├── contracts/         # Contract ABIs and addresses
│   ├── stores/            # Svelte stores (wallets, proofs)
│   ├── types/             # TypeScript types
│   └── utils/
│       ├── aztec-interactions.ts  # Aztec mint/withdraw logic
│       ├── aztec-wallet.ts        # Azguard wallet connection
│       ├── evm-interactions.ts    # L1 burn/bridge logic
│       └── evm-wallet.ts          # MetaMask connection
├── App.svelte             # Main application
└── main.ts                # Entry point
```

## Key Files

- `aztec-interactions.ts`: Contains the core withdraw logic including:
  - Merkle tree construction from L1 events
  - Merkle proof generation
  - `mintFromEVM()` function to call Aztec contract

- `evm-interactions.ts`: Contains the bridge logic including:
  - Token approval and wrapping
  - Burn with commitment creation
  - Note encoding/decoding
