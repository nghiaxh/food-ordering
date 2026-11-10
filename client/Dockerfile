# syntax=docker/dockerfile:1

# ===== DEV: Vite dev server (hot reload) =====
FROM node:26-alpine AS dev
WORKDIR /app
COPY package*.json ./
# Cache /root/.npm giữ tarball giữa các lần build nên retry không tải lại từ đầu;
# mạng đứt giữa chừng vẫn được npm thử lại tối đa 5 lần.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ===== PROD: build tĩnh rồi phục vụ bằng nginx =====
FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
# Cache /root/.npm giữ tarball giữa các lần build nên retry không tải lại từ đầu;
# mạng đứt giữa chừng vẫn được npm thử lại tối đa 5 lần.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=120000
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
