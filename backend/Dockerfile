# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# TXDXSAT backend — Express + Prisma + Socket.IO
# Multi-stage build: dependencies -> build -> dev -> production runtime.
# ---------------------------------------------------------------------------

# Base: pinned, minimal runtime.
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

# ---------------------------------------------------------------------------
# Dependency layer (uses the lockfile for reproducible installs).
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Development target: full deps + source, hot reload via tsx watch.
# Compose mounts src/ over the image copy.
# ---------------------------------------------------------------------------
FROM deps AS dev
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
# A dummy URL lets `prisma generate` run at build time without a database.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Builder: generate the Prisma client, then compile TypeScript to dist/.
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# Production dependencies only.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Runtime: non-root, dist + migrations + entrypoint. No build tooling.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0

# wget (busybox) is used by the healthcheck.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
