# Inventário: esqueleto reutilizável vs conteúdo específico

Este documento mapeia, no repositório `gatums-gourmet-hub` (TanStack Start +
Vite + React 19 + Tailwind v4), o que é **esqueleto reutilizável** (infra que
não muda de um site para outro) e o que é **conteúdo específico do projeto**
(o que precisa ser trocado a cada novo site). Serve de base para extrair um
"projeto base" reutilizável.

As entradas referenciam caminhos de arquivo; não reproduzem trechos extensos de
código, para evitar drift entre este doc e o código real.

## Esqueleto reutilizável (não muda entre sites)

- `vite.config.ts` — configuração do Vite com switch `DEPLOY_TARGET`
  (`vps` / `vercel-spa` / `vercel-ssr`) que seleciona o alvo de build/deploy sem
  duplicar config.
- `server/node-server.mjs` — adaptador Node para servir o handler SSR em runtime
  (produção em container na VPS).
- `src/server.ts` — entrypoint SSR da aplicação.
- `src/start.ts` — middleware de captura de erro no servidor.
- `dev-local.mjs` — utilitário de DX que sobe o Vite e abre o navegador
  automaticamente.
- `Dockerfile` — build SSR + imagem de runtime.
- `src/components/ui/*` — biblioteca de componentes shadcn (primitivos de UI).
- `src/lib/utils.ts` — utilitários genéricos (ex.: `cn`).
- `src/lib/api/` — camada de acesso à API: client HTTP (`client.ts`),
  configuração (`config.ts`), paginação e tratamento de erro/401.
- `src/lib/auth-context.tsx` — contexto de autenticação.
- `src/lib/cart-context.tsx` — contexto do carrinho.
- Estrutura de rotas: `src/routes/` — rotas públicas + grupo `_authenticated`
  (autenticadas) + subárvore `_authenticated/admin` (administração).

## Conteúdo específico do projeto (muda a cada site)

| Categoria | Onde está |
|---|---|
| Branding/textos | `src/components/Navigation.tsx`, `src/components/Footer.tsx`, `src/routes/sobre.tsx`, `src/routes/index.tsx` (hero/pilares/stats), meta tags em `src/routes/__root.tsx` e em cada rota |
| Cores/fontes | `src/styles.css` (tokens OKLCH, `--font-*`) |
| Contatos/redes | `src/routes/sobre.tsx` (WhatsApp, Instagram, e-mail, telefone), `src/components/Footer.tsx` |
| API/ambiente | `.env*`, `Dockerfile` (ARG `VITE_API_BASE_URL`), `.github/workflows/*` |
| Domínio/deploy | `deploy/nginx-host-site.conf`, `docker-compose.production.yml` (nome container/rede), `.github/workflows/*` (host, path, projeto Vercel) |
| Dados embutidos no código | Pix em `src/lib/api/pagamentos.ts` (`5913GATUMS GOURMET`, `6009SAO PAULO`); prefixo de storage `gg.` em `src/lib/api/client.ts` e services |
| Assets | `src/assets/hero-gourmet.jpg` |
