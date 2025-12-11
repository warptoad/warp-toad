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

# Local development (set to 'true' for sandbox, leave empty for devnet)
VITE_TEST_MODE=true
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
yarn run f:dev
```

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
