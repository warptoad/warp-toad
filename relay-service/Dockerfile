FROM node:24-alpine
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY relay-service/package.json ./relay-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy relay-service source
COPY relay-service ./relay-service

# Build
RUN pnpm --filter @warp-toad/relay-service build

EXPOSE 7777

CMD ["pnpm", "--filter", "@warp-toad/relay-service", "start"]
