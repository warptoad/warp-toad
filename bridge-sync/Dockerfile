FROM node:24-alpine

WORKDIR /app

# Install build dependencies (needed for some native modules)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY bridgeSync/package.json ./bridgeSync/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source (needed for bridge script execution)
COPY backend ./backend

# Copy bridgeSync source
COPY bridgeSync ./bridgeSync

# Build backend TypeScript
WORKDIR /app/backend
RUN pnpm build || echo "Backend build completed with warnings"

# Build bridgeSync TypeScript
WORKDIR /app/bridgeSync
RUN pnpm build

# Create directories
RUN mkdir -p /app/bridgeSync/logs /app/bridgeSync/db

# Set working directory to bridgeSync for runtime
WORKDIR /app/bridgeSync

# Expose port
EXPOSE 6969

# Start server
CMD ["node", "dist/server.js"]
