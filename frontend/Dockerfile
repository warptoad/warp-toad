# frontend image - multi-stage build
#
# Stage 1: install + `pnpm build` (vite build + patch-dist.js postbuild).
# Stage 2: minimal runtime that serves the built dist via `vite preview`.
#
# Why vite preview: see memory feedback_frontend_use_build_preview.md - the
# Vite dev server cannot serve the app due to wasm-bindgen filename collisions.
# Only `vite build` + `vite preview` (or any static server pointed at dist/)
# works. We use vite preview for parity with local dev.
#
# Why trixie-slim: matches bridge-sync/relay-service. Frontend doesn't need
# the newer libstdc++, but using the same base saves layer downloads.
#
# Build context MUST be the monorepo root. The compose file uses
# `context: .` for that reason.
#
# IMPORTANT: Vite bakes VITE_* env vars at BUILD time, not runtime. To
# reconfigure RPC URLs / test mode / bridge-keeper URL etc, you must REBUILD
# the image. The compose file passes them as build args.

# =============================================================================
# Stage 1: builder
# =============================================================================
FROM node:22-trixie-slim AS builder

WORKDIR /app

# Build deps for native modules pulled in by aztec packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# 1. Workspace manifests for ALL workspaces so pnpm can resolve the full
#    dep graph. We need this because the frontend imports artifact .ts files
#    from backend/aztec/ which expect @aztec/aztec.js/abi etc to be resolvable
#    from inside the backend/ tree at build time. With `--filter frontend...`
#    pnpm doesn't install backend's transitive deps in a layout Vite can
#    follow, so we install everything.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY bridge-sync/package.json ./bridge-sync/
COPY relay-service/package.json ./relay-service/
COPY frontend/package.json ./frontend/

# 2. Full install. pnpm.overrides at the root pin the @aztec/noir-* family.
RUN pnpm install --frozen-lockfile

# 3. Copy the backend bits the frontend imports at build time:
#      - backend/deploy/  : deployed_addresses.json files (chains.ts static imports)
#      - backend/aztec/   : Aztec contract artifact .ts files (resolved via the
#                           @backend Vite alias in frontend/vite.config.ts:71)
COPY backend/deploy ./backend/deploy
COPY backend/aztec ./backend/aztec

# 4. Copy frontend source.
COPY frontend ./frontend

# 5. VITE_* build args. Vite bakes these into the bundle at build time.
ARG VITE_TEST_MODE=false
ARG VITE_SEPOLIA_RPC_URL
ARG VITE_SCROLL_SEPOLIA_RPC_URL
ARG VITE_AZTEC_NODE_URL
ARG VITE_LOCAL_AZTEC_NODE_URL
ARG VITE_BRIDGE_KEEPER_URL
ARG VITE_RELAY_SERVICE_URL
ARG VITE_UMAMI_SCRIPT_URL
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_TEST_MODE=$VITE_TEST_MODE \
    VITE_SEPOLIA_RPC_URL=$VITE_SEPOLIA_RPC_URL \
    VITE_SCROLL_SEPOLIA_RPC_URL=$VITE_SCROLL_SEPOLIA_RPC_URL \
    VITE_AZTEC_NODE_URL=$VITE_AZTEC_NODE_URL \
    VITE_LOCAL_AZTEC_NODE_URL=$VITE_LOCAL_AZTEC_NODE_URL \
    VITE_BRIDGE_KEEPER_URL=$VITE_BRIDGE_KEEPER_URL \
    VITE_RELAY_SERVICE_URL=$VITE_RELAY_SERVICE_URL \
    VITE_UMAMI_SCRIPT_URL=$VITE_UMAMI_SCRIPT_URL \
    VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

# 6. Build (vite build + patch-dist.js postbuild for the Aztec class names).
#
# NODE_OPTIONS=--max-old-space-size=4096 bumps the V8 heap from the ~2GB
# default to 4GB. The bundle is huge (Aztec + Noir + bb.js wasm) and the
# default heap OOMs partway through Rollup's renderChunks pass.
WORKDIR /app/frontend
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm pull:addresses && pnpm build

# =============================================================================
# Stage 2: runtime - serve dist/ via nginx
#
# We don't need node, vite, or pnpm at runtime - the frontend is a static
# SPA. nginx:alpine is ~25MB, no symlink fragility, and handles SPA fallback
# routing trivially. The host's reverse-proxy nginx adds the COOP/COEP
# headers needed for SharedArrayBuffer + wasm threads, so this inner nginx
# only needs to serve files.
# =============================================================================
FROM nginx:alpine AS runtime

# wget for the docker-compose healthcheck.
RUN apk add --no-cache wget

# Minimal nginx config: listen on 4173, serve dist/, SPA fallback to index.html.
RUN printf '%s\n' \
    'server {' \
    '    listen 4173;' \
    '    listen [::]:4173;' \
    '    server_name _;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '    # Long cache for hashed assets, no-cache for index.html.' \
    '    location ~* \.(js|css|wasm|woff2?|ttf|png|jpg|svg)$ {' \
    '        expires 1y;' \
    '        add_header Cache-Control "public, immutable";' \
    '    }' \
    '    location = /index.html {' \
    '        add_header Cache-Control "no-cache";' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

# Drop the built dist into the nginx web root.
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 4173

# nginx:alpine's default ENTRYPOINT already runs nginx in the foreground.
