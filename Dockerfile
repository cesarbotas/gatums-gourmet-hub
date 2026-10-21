# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# A base da API entra no bundle do cliente em build time (Vite inlines VITE_*).
ARG VITE_API_BASE_URL=https://gatumsgourmet.com.br/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# npm 11 evita o bug do resolver (edgesOut) das versões 10.8/10.9 em árvores
# com peerDeps (@cloudflare/vite-plugin, wrangler).
RUN npm install -g npm@11

# Instala dependências (inclui devDeps: vite/tanstack são necessários no build).
COPY package*.json ./
RUN npm ci

# Build SSR (alvo Node, não Cloudflare — ver vite.config.ts `cloudflare: false`).
# Gera dist/client (assets) e dist/server/server.js (handler fetch SSR).
COPY . .
RUN npm run build

# Remove devDependencies para copiar só o runtime de produção.
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Só o necessário para servir: build, adaptador Node e deps de produção.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

# Healthcheck interno (o Nginx host também valida de fora).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) +'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/node-server.mjs"]
