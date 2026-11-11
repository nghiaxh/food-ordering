# syntax=docker/dockerfile:1

# ---- deps: cai toan bo deps (ke ca devDeps) ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Cache /root/.npm giu tarball giua cac lan build; retry toi da 5 lan khi mang bat on.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

# ---- dev: tsx watch + source mount, khong can build ----
FROM deps AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 8080
# Ap migration Drizzle va seed (bo qua neu DB da co du lieu) truoc khi khoi dong server.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run dev"]

# ---- build: bien dich TS sang dist/ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: chi runtime deps + dist/ ----
FROM node:26-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000
COPY --from=build /app/dist ./dist
# Drizzle migration SQL can co o prod de db:migrate chay khi khoi dong container.
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
EXPOSE 8080
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && node dist/server.js"]
