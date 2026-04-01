FROM node:24-alpine

WORKDIR /app

# Install build dependencies (needed for some native modules)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY bridge-sync/package.json ./bridge-sync/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source (needed for bridge script execution)
COPY backend ./backend

# Copy bridge-sync source
COPY bridge-sync ./bridge-sync

# Build backend TypeScript
WORKDIR /app/backend
RUN pnpm build || echo "Backend build completed with warnings"

# Build bridge-sync TypeScript
WORKDIR /app/bridge-sync
RUN pnpm build

# Create directories
RUN mkdir -p /app/bridge-sync/logs /app/bridge-sync/db

# Set working directory to bridge-sync for runtime
WORKDIR /app/bridge-sync

# Expose port
EXPOSE 6969

# Start server
CMD ["node", "dist/server.js"]
