# faucet-service image
#
# Self-contained: no backend coupling, viem only.
# Runs via tsx (no build step).

FROM node:22-trixie-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# Workspace manifests so pnpm can resolve the dep graph.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY faucet-service/package.json ./faucet-service/

# Install only the deps faucet-service needs.
RUN pnpm install --frozen-lockfile --filter @warp-toad/faucet-service...

# Copy faucet-service source.
COPY faucet-service ./faucet-service

# Persistent ledger dir (mounted as a volume in compose).
RUN mkdir -p /app/faucet-service/db

WORKDIR /app/faucet-service

EXPOSE 8888

CMD ["pnpm", "exec", "tsx", "src/server.ts"]
