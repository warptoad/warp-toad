# bridge-sync image
#
# bridge-sync runs via tsx (no build step) and imports backend source files
# directly via cross-workspace relative paths (../../backend/lib/bridging.js
# etc.). The container therefore needs BOTH the bridge-sync and backend
# workspaces present, plus the workspace root for pnpm install.
#
# Build context MUST be the monorepo root. The compose files use
# `context: ..` for that reason.

# Debian trixie (Debian 13) instead of bookworm (Debian 12) or alpine:
#   - alpine ships musl, but @aztec/bb.js ships a precompiled glibc native
#     module - LinkErrors on alpine
#   - bookworm has glibc but its libstdc++ is from GCC 12 (GLIBCXX_3.4.30),
#     too old for bb.js which needs GLIBCXX_3.4.32 (GCC 13+)
#   - trixie has GCC 14 / libstdc++ 6.0.33 which satisfies bb.js
FROM node:22-trixie-slim

WORKDIR /app

# Build deps for any native modules pulled in by aztec packages, plus
# `wget` for the docker-compose healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# 1. Copy workspace manifests so pnpm can resolve the dep graph.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY bridge-sync/package.json ./bridge-sync/

# 2. Install bridge-sync deps + backend deps (including backend's devDeps so
#    `hardhat compile` works in the next step). pnpm's transitive workspace
#    filter excludes devDeps of non-filtered packages, so we filter both.
RUN pnpm install --frozen-lockfile --filter @warp-toad/bridge-sync... --filter @warp-toad/backend

# 3. Copy backend source. bridge-sync's executor.ts imports:
#      ../../backend/lib/bridging.ts
#      ../../backend/deploy/utils/aztecUtilsNoEnv.ts
#      ../../backend/aztec/WarpToadCore/src/artifacts/WarpToadCore.ts
#      ../../backend/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter.ts
#    and contractLoader.ts reads:
#      ../../backend/artifacts/contracts/**/*.json (Hardhat artifacts)
#      ../../backend/deploy/ignition/deployments/chain-*/deployed_addresses.json
#      ../../backend/deploy/aztec/aztecDeployments/*/deployed_addresses.json
COPY backend ./backend

# 4. Copy bridge-sync source.
COPY bridge-sync ./bridge-sync

# 5. Compile the Solidity contracts so contractLoader.ts can find the
#    Hardhat ABI artifacts at /app/backend/artifacts/contracts/...
#    These artifacts are gitignored so they won't be present on a fresh
#    `git clone`; we MUST regenerate them inside the build.
WORKDIR /app/backend
RUN pnpm exec hardhat compile
WORKDIR /app

# Runtime data dirs.
RUN mkdir -p /app/bridge-sync/logs /app/bridge-sync/db

WORKDIR /app/bridge-sync

EXPOSE 6969

# tsx runtime entry. No build step - bridge-sync deliberately ships TS source
# (see bridge-sync/package.json `start`).
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
