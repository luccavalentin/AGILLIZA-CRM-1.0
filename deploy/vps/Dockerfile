# =============================================================================
# Agilliza 2.0 na VPS (banco único) — o mesmo app, compilado para Node em vez de
# Cloudflare Workers. Contexto de build: a raiz do repositório.
#
#   docker build -f deploy/vps/Dockerfile --build-arg SUPABASE_ANON_KEY=... -t agilliza/app:TAG .
# =============================================================================
ARG NODE=node:22-bookworm-slim

FROM ${NODE} AS construcao
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
# A chave anônima vai no pacote do navegador (é pública por definição). O endereço é
# "mesma-origem": a borda serve a API do Supabase no mesmo domínio do app.
ARG SUPABASE_ANON_KEY
ENV NITRO_PRESET=node-server \
    VITE_SUPABASE_URL=mesma-origem \
    VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}
RUN test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" && npx vite build

FROM ${NODE} AS final
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 TZ=America/Sao_Paulo
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=construcao --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
