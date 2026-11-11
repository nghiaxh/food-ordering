# syntax=docker/dockerfile:1

# ---- deps: cài toàn bộ deps (kể cả devDeps) ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Cache /root/.npm giữ tarball giữa các lần build; retry tối đa 5 lần khi mạng bất ổn.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000

# ---- dev: tsx watch + source mount, không cần build ----
FROM deps AS dev
COPY . .
ENV NODE_ENV=development
EXPOSE 8080
# Áp migration Drizzle và seed (bỏ qua nếu DB đã có dữ liệu) trước khi khởi động server.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run dev"]

# ---- build: biên dịch TS sang dist/ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod: chỉ runtime deps + dist/ ----
FROM node:26-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000
COPY --from=build /app/dist ./dist
# Drizzle migration SQL cần có ở prod để db:migrate chạy khi khởi động container.
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
EXPOSE 8080
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && node dist/server.js"]
