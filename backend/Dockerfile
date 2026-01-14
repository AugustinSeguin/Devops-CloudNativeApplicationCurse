# --- STAGE 1: Build ---
FROM node:18-alpine AS build

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

RUN npx prisma generate

# --- STAGE 2: Production ---
FROM node:18-alpine AS production

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

WORKDIR /app

USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "src/index.js"]