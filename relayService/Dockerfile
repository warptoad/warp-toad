FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
COPY relayService/package.json ./relayService/

RUN yarn install --frozen-lockfile

COPY relayService ./relayService

# IMPORTANT: run build from root via workspace
WORKDIR /app
RUN yarn workspace @warp-toad/relay-service build

EXPOSE 7777

# also start via workspace (more reliable)
CMD ["yarn", "workspace", "@warp-toad/relay-service", "start"]
