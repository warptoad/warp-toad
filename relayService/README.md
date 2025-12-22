# WarpToad Relay Service

Gasless withdrawal relay service for WarpToad. This service accepts ZK proofs from users and submits mint transactions on their behalf, charging a small fee from the withdrawal amount.

1. **Configure environment**:
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

2. **Required Environment Variables**:
   - `RELAYER_PRIVATE_KEY`: Private key of the relayer wallet
   - `L1_RPC_URL`: Ethereum L1 RPC endpoint
   - `MIN_FEE_FACTOR`: Minimum fee in basis points (default: 25 = 0.25%)
   - `MAX_FEE_FACTOR`: Maximum fee in basis points (default: 500 = 5%)
   - `MIN_PROFIT_USD`: Minimum profit in USD (default: 1.0)

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
Health check endpoint.

### POST /relay/withdraw
Submit a withdrawal request to be relayed.

### GET /relay/status/:operationId
Check the status of a relay operation.

