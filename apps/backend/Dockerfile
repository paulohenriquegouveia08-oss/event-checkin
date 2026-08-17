# Build multi-stage: compila TypeScript e gera o Prisma Client numa etapa,
# roda em produção numa imagem enxuta.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# O motor do Prisma (schema engine / query engine) precisa de libssl no
# sistema — a imagem "slim" não vem com ela, e sem isso o Prisma falha
# ("Schema engine error", detecção de libssl/openssl falha).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspace=apps/backend --include-workspace-root

COPY apps/backend apps/backend
# prisma generate PRECISA rodar antes do tsc: o código importa tipos de
# @prisma/client que só existem depois de gerados a partir do schema —
# sem isso, o build falha ("Namespace Prisma has no exported member...").
RUN npx --workspace=apps/backend prisma generate
RUN npm run build --workspace=apps/backend

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspace=apps/backend --include-workspace-root --omit=dev

COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY --from=build /app/apps/backend/prisma apps/backend/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
# Template visual do certificado (ver certificate-template.ts) — não passa
# pelo build do TS, então precisa ser copiado à parte pro estágio runtime.
COPY apps/backend/assets apps/backend/assets

EXPOSE 3000
WORKDIR /app/apps/backend
CMD ["node", "dist/server.js"]
