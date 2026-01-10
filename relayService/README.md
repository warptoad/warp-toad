# WarpToad Multi-Chain Relay Service

Gasless withdrawal relay service for WarpToad. This service accepts ZK proofs from users and submits mint transactions on their behalf across multiple chains (L1 Ethereum and Scroll L2).

## Setup

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Required Environment Variables**:
   - `RELAYER_PRIVATE_KEY`: Private key of the relayer wallet (same wallet for both chains)
   - `L1_RPC_URL`: Ethereum L1 RPC endpoint (e.g., Sepolia)
   - `SCROLL_RPC_URL`: Scroll L2 RPC endpoint (e.g., Scroll Sepolia)
   - `MIN_FEE_FACTOR`: Minimum fee in basis points (default: 0 = altruistic)
   - `MAX_FEE_FACTOR`: Maximum fee in basis points (default: 0 = altruistic)
   - `MIN_PROFIT_USD`: Minimum profit in USD (default: 0 = altruistic)

3. **Fund the relayer wallet**:
   - Ensure the wallet has ETH on both Sepolia and Scroll Sepolia
   - For testnet, get free ETH from faucets:
     - Sepolia: https://sepoliafaucet.com/
     - Scroll Sepolia: https://scroll.io/bridge (bridge from Sepolia)

## Running

**Development**:
```bash
yarn dev
```

**Production**:
```bash
yarn build
yarn start
```

## API Endpoints

### GET /health
Health check endpoint. Returns service status and supported chains.

### POST /relay/withdraw
Submit a withdrawal request to be relayed.

### GET /relay/status/:operationId
Check the status of a relay operation.
