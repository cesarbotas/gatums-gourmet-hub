# Registro de Alterações — Infra de Deploy e Cadastro de Categorias

> Documento-índice consolidando as iniciativas de engenharia realizadas nesta
> frente de trabalho. Cada seção aponta para os artefatos (specs, plans) e as
> branches onde o código vive. Serve como registro histórico do que foi feito,
> por quê, e como foi verificado.

## Visão geral das branches

| Branch | Tema | Status |
|---|---|---|
| `feature/AjustesProjetoVPS` | Deploy do site (SSR) na VPS Locaweb | Concluído / em uso |
| `feature/deploy-homologacao-vercel` | Pipeline de homologação na Vercel | Pausado |
| `feature/cadastro-categorias` | Cadastro de categorias + migração de contrato | Em finalização |

Cada branch é independente e trata de um tema. Os documentos de design e os
planos de implementação ficam em `docs/superpowers/` na branch correspondente.

---

## 1. Deploy do site (SSR) na VPS Locaweb

**Branch:** `feature/AjustesProjetoVPS`

### Contexto
O projeto é TanStack Start com SSR (não um SPA estático), originalmente
configurado para Cloudflare Workers. O objetivo foi publicá-lo na mesma VPS
Locaweb que hospeda a API, no mesmo esquema (Docker + Nginx host + HTTPS
Let's Encrypt + GitHub Actions).

### O que foi feito
- Alterado o alvo de build de Cloudflare para servidor Node SSR
  (`vite.config.ts`: inicialmente `cloudflare: false`; posteriormente a opção
  migrou para `nitro: false` no preset v2 — ver seção 3).
- Criado adaptador Node (`server/node-server.mjs`) que sobe um HTTP server,
  serve os estáticos de `dist/client/assets` e encaminha o resto para o handler
  SSR (`dist/server/server.js`).
- `Dockerfile` multi-stage (Node 22 + npm 11): build no CI, runtime roda
  `node server/node-server.mjs` na porta 3000, com HEALTHCHECK.
- `docker-compose.production.yml`: publica `127.0.0.1:8090 -> 3000`; a imagem
  é construída no GitHub Actions e carregada na VPS via `docker load`
  (a VPS de 512MB não aguenta o build — estourava o heap do Node).
- Nginx host: server block `app.gatumsgourmet.com.br -> 127.0.0.1:8090`, com
  TLS Let's Encrypt (Certbot). DNS `app` -> IP gerenciado na Locaweb.
- GitHub Actions: build da imagem no runner, envio por SSH (com keepalive para
  builds longos), `docker load` + `docker compose up` na VPS.

### Problemas resolvidos no caminho
- Alvo Cloudflare -> Node SSR.
- Bug do resolver do npm (`edgesOut`) nas versões 10.8/10.9 -> fixado npm 11.
- `package-lock.json` fora de sincronia (EUSAGE) -> lock regenerado.
- SSH `Broken pipe` (exit 255) em build longo -> keepalive + deploy em background.
- OOM no build na VPS de 512MB -> build movido para o runner do GitHub.
- DNS + Nginx + Certbot (configuração única na VPS).

### Verificação
Build Docker + container rodado localmente (SSR 200, assets com cache, health
`healthy`); em produção, `curl -I https://app.gatumsgourmet.com.br/` = 200.

---

## 2. Pipeline de homologação na Vercel

**Branch:** `feature/deploy-homologacao-vercel` (pausado)
**Design:** `docs/superpowers/specs/2026-10-22-deploy-homologacao-vercel-design.md`
(nessa branch)

### Contexto
Criar um ambiente de homologação separado de produção, publicado na Vercel
quando um PR cujo alvo é `release` recebe um Approve, apontando para a API de
homologação (`https://gatums-gourmet-api.onrender.com`).

### Decisões de design (aprovadas)
- Gatilho: `pull_request_review` (approved) + base `release`, publicando o
  código do PR (head). Mais `workflow_dispatch` para rerun manual.
- Autorização: GitHub Environment `homologacao` com required reviewers
  (a "lista de bypass" nativa) guardando os secrets `VERCEL_*`.
- Deploy via Vercel CLI no GitHub Actions (único jeito de disparar por
  aprovação de review).
- Separação total: workflow próprio (`deploy-homologacao.yml`), secrets
  próprios, zero impacto no deploy de produção da VPS.

### Ponto em aberto (motivo da pausa)
O preset `@lovable.dev/vite-tanstack-config` v2 só suporta os alvos
`cloudflare-module` e `lovable-fetch-bundle`, e apaga `NITRO_PRESET` do
ambiente dentro do sandbox — então o SSR serverless nativo da Vercel não é
autodetectado. Caminho escolhido: **SPA estático na Vercel** (modo `spa` do
TanStack Start, via um interruptor `DEPLOY_TARGET` no `vite.config.ts`),
preservando o SSR em produção (VPS). A validação final depende da conta Vercel.

### Artefatos (na branch)
`deploy-homologacao.yml`, `vercel.json`, `.env.homologacao`, interruptor
`DEPLOY_TARGET` no `vite.config.ts`.

---

## 3. Cadastro de categorias + migração de contrato

**Branch:** `feature/cadastro-categorias`
**Design:** `docs/superpowers/specs/2026-10-22-cadastro-categorias-design.md`
**Plano:** `docs/superpowers/plans/2026-10-22-cadastro-categorias.md`

### Contexto
A API passou a tratar categoria como entidade própria (id numérico), removendo
o antigo `GET /produtos/categorias` e o campo `categoria` (string) em produtos.
Em paralelo, a API introduziu paginação com um novo contrato global.

### O que foi feito
1. **Serviço de categorias** (`src/lib/api/categorias.ts`): CRUD completo
   (`list`, `getById`, `create`, `update`, `remove`).
2. **Tela de admin** `/admin/categorias` (`src/routes/_authenticated/admin/categorias.tsx`):
   listar (paginado), criar, editar, excluir; tratamento dos erros de negócio
   (nome duplicado, exclusão com produtos vinculados). Item "Categorias" no
   menu lateral do admin.
3. **Migração do contrato de produtos** (`src/lib/api/produtos.ts`):
   `categoria: string` -> `categoriaId: number` + `categoriaNome: string`;
   removidos `CATEGORIAS` hardcoded e `produtosService.categorias()`.
4. **Consumidores** (`admin/produtos.tsx`, `catalogo.tsx`, `index.tsx`): select
   de categoria por `categoriaId`, exibição de `categoriaNome`, filtro por id.
5. **Combobox com busca** (`src/components/CategoriaCombobox.tsx`): substitui os
   selects de categoria por um dropdown com campo de busca (necessário com 100+
   categorias). [Em finalização]

### Migração do contrato de paginação (global)
A API trocou o contrato de todos os GETs paginados:

| Antes | Agora |
|---|---|
| request `?page=&pageSize=` | `?pagina=&tamanho=` |
| response `{ items, total, page, pageSize }` | `{ itens, totalRegistros, paginaAtual, tamanhoPagina, totalPaginas, temPaginaAnterior, temProximaPagina }` |

Abordagem adotada: **adaptação na borda**. Um helper central em
`src/lib/api/config.ts` (`appendPageParams` + `mapPaginated`) traduz nos dois
sentidos, mantendo o `PaginatedResponse<T>` interno do front inalterado. As
telas não mudaram. Migrados: categorias, produtos, clientes, pedidos.

### Contrato de paginação futura (combinado com o backend)
`GET /categorias?pagina=&tamanho=&apenasAtivas=` -> `PaginatedResponse` no
formato novo. Já implementado e validado contra a API local.

### Verificação
- BUILD=0, TSC=0 no projeto inteiro (Docker, Node 22 + npm 11).
- Smoke test HTTP contra a API local (`http://localhost:5166/api/v1`):
  categorias paginadas, produtos com `categoriaId`/`categoriaNome`, CRUD de
  categoria (create/update/delete OK).
- Validação visual no navegador (dev server apontando para a API local).

### Dívida conhecida (fora de escopo)
- ~60 erros de formatação `prettier` pré-existentes em ~25 arquivos não tocados
  por esta branch (login, register, components/ui, etc.). Sugerida uma limpeza
  separada via `eslint --fix src`.

---

## Convenções de engenharia adotadas

- **Ambiente de build:** Node 22 + npm 11 (o npm 10.8/10.9 tem bug de resolver).
  Não há node/npm nativo na máquina de desenvolvimento usada; builds e
  verificações rodam via Docker (`node:22-alpine`).
- **Processo:** design (spec) -> plano -> implementação por tasks com revisão,
  registrados em `docs/superpowers/`.
- **Separação por branch:** uma branch por tema, sem misturar diffs.
