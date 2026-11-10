# syntax=docker/dockerfile:1

# ---- deps: cài toàn bộ (kể cả devDeps) + sinh Prisma Client ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall chạy prisma generate nên phải có schema trước khi cài.
# Cache /root/.npm giữ tarball giữa các lần build nên retry không tải lại từ đầu;
# mạng đứt giữa chừng vẫn được npm thử lại tối đa 5 lần.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

# ---- dev: tsx watch + source mount, không cần build ----
FROM deps AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 8080
CMD ["npm", "run", "dev"]

# ---- build: biên dịch TS sang dist (tsc cũng biên dịch src/generated) ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: chỉ runtime deps + dist ----
FROM node:26-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# dist đã gồm Prisma Client đã biên dịch nên không cần postinstall ở đây.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
