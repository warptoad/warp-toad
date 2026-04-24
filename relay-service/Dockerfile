# relay-service image
#
# Self-contained: no backend coupling, only @warp-toad/relay-service.
# Runs via tsx (no build step).
#
# Build context MUST be the monorepo root. The compose file uses
# `context: ..` for that reason.

# node:22-trixie-slim for parity with bridge-sync. relay-service doesn't
# actually need the newer libstdc++ (no native modules), but using the same
# base saves a layer download on hosts running both services.
FROM node:22-trixie-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# 1. Copy workspace manifests so pnpm can resolve the dep graph.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY relay-service/package.json ./relay-service/

# 2. Install only the deps relay-service needs.
RUN pnpm install --frozen-lockfile --filter @warp-toad/relay-service...

# 3. Copy relay-service source.
COPY relay-service ./relay-service

WORKDIR /app/relay-service

EXPOSE 7777

# tsx runtime entry. No build step (start script is `tsx src/server.ts`).
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
