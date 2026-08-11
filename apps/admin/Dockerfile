# Build multi-stage: compila os assets estáticos do painel (Vite) e
# serve via Nginx. VITE_API_URL precisa ser conhecido em build-time
# (é embutido no bundle JS, como em qualquer SPA) — passado via
# --build-arg pelo docker-compose.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/admin/package.json apps/admin/package.json
RUN npm install --workspace=apps/admin --include-workspace-root

COPY apps/admin apps/admin
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace=apps/admin

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
