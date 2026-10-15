# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# TXDXSAT frontend — React + Vite + Tailwind CSS v4
# Production: static assets served by Nginx under the public prefix /sat.
# Dev target: Vite dev server with hot reload.
# ---------------------------------------------------------------------------

FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Development: Vite dev server (compose mounts the source tree).
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build the static bundle. VITE_* values are inlined at build time.
FROM deps AS builder
ARG VITE_BASE_PATH=/sat/
ARG VITE_APP_NAME=TXDXSAT
ENV VITE_BASE_PATH=${VITE_BASE_PATH} \
    VITE_APP_NAME=${VITE_APP_NAME}
COPY . .
RUN npm run build

# Runtime: Nginx serving the SPA and proxying the API + WebSocket.
FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/sat
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
