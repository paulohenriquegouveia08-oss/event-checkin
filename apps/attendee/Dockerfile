# Build multi-stage: compila a aplicação Next.js no modo standalone e
# executa em produção com runtime mínimo Node 22 slim.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Instalação isolada de dependências do workspace monorepo
COPY package.json package-lock.json* ./
COPY apps/attendee/package.json apps/attendee/package.json
RUN npm install --workspace=apps/attendee --include-workspace-root

# Código da aplicação
COPY apps/attendee apps/attendee

# Variáveis públicas embutidas no build do Next.js
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build com output: "standalone" (configurado em apps/attendee/next.config.ts)
RUN npm run build --workspace=apps/attendee

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# O Next.js standalone preserva a hierarquia monorepo dentro de .next/standalone
COPY --from=build /app/apps/attendee/.next/standalone ./
COPY --from=build /app/apps/attendee/.next/static ./apps/attendee/.next/static
COPY --from=build /app/apps/attendee/public ./apps/attendee/public

EXPOSE 3001
WORKDIR /app/apps/attendee
CMD ["node", "server.js"]
