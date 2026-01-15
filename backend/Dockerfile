# --- STAGE 1: Build ---
FROM node:18-alpine AS build

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create a temporary .env file for Prisma schema validation during build
RUN echo 'DATABASE_URL="postgresql://user:password@postgres:5432/db"' > .env

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# --- STAGE 2: Production ---
FROM node:18-alpine AS production

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node src/index.js"]