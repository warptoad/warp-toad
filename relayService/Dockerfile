FROM node:20-alpine

WORKDIR /app

# corepack for yarn
RUN corepack enable

# Copy root package files for workspace setup
COPY package.json yarn.lock ./
COPY relayService/package.json ./relayService/

# Install all workspace dependencies
RUN yarn install --frozen-lockfile

# Copy relayService source
COPY relayService ./relayService

# Build relayService TypeScript
WORKDIR /app/relayService
RUN yarn build

# Set working directory to bridgeSync for runtime
WORKDIR /app/relayService

# Expose port
EXPOSE 7777

# Start server
CMD ["node", "dist/server.js"]
