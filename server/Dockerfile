# syntax=docker/dockerfile:1

# ---- deps: cài toàn bộ (kể cả devDeps) + sinh Prisma Client ----
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall chạy prisma generate nên phải có schema trước khi cài.
RUN npm ci --no-audit --no-fund

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
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
