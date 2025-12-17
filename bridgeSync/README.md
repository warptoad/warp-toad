# BridgeKeeper Service

HTTP service for triggering cross-chain bridge operations between EVM chains and Aztec.

##  IMPORTANT: Bridge Operation Times

Bridge operations take significant time to complete:


**Scroll** (any direction)  **2-3 hours** 
**Aztec** (any direction)  **30 min - 1 hour** 
**Local/Testing**  should be instant

** DO NOT use `waitForCompletion: true` in production!**
- This will keep the HTTP connection open for hours
- Instead, use polling: call `GET /status/:operationId` every 30-60 seconds

## API Endpoints

### Bridge Operation
```
POST /bridge/:fromChainId/:toChainId
```

Trigger a bridge operation to sync local root from `fromChainId` to `toChainId`.

**Parameters:**
- `fromChainId`: Source chain ID (`11155111`, `534351`, `31337`, or `aztec`)
- `toChainId`: Destination chain ID

**Body (optional):**
```json
{
  "waitForCompletion": false,
  "confirmations": 3
}
```

**Response:**
```json
{
  "ok": true,
  "operationId": "uuid",
  "status": "pending",
  "message": "Bridge operation queued: 11155111 -> 534351",
  "expectedDuration": "2-3 hours",
  "note": "Poll /status/:operationId to check progress. Do not use waitForCompletion for production."
}
```

### Check Status
```
GET /status/:operationId
```

### Health Check
```
GET /health
```

### View Configuration
```
GET /config
```

### View Logs
```
GET /logs/:operationId
```

## Setup

### 1. Install Dependencies
```bash
cd bridgeSync
yarn install
```

### 2. Configure Environment
Copy `.env.template` to `.env` and fill in:
- `EVM_PRIVATE_KEY`: Your wallet private key
- `SEPOLIA_RPC_URL`: Infura/Alchemy Sepolia RPC
- Other RPC URLs as needed

### 3. Run in Development
```bash
yarn dev
```

### 4. Build for Production
```bash
yarn build
yarn start
```

## Docker Deployment

### Build Image
```bash
yarn docker:build
```

### Run Container
```bash
docker-compose up -d
```

The service will be available on port 6969.

## Security

- API accepts requests only from `https://warptoad.xyz` or localhost
- All other origins are rejected
- CORS configured for security

## Notes

- Operations are queued to prevent concurrent bridges to same route
- Logs are stored in `./logs/` directory
- Database is stored in `./db/` directory
- Backend bridge logic is reused from `../backend/scripts/`
