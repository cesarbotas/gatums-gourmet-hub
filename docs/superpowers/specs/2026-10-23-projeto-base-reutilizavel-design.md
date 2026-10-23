# Projeto Base Reutilizável — Design

Data: 2026-10-23
Status: Proposto (aguardando revisão)

## Propósito

Transformar o repositório `gatums-gourmet-hub` em um **projeto base
reutilizável**: um molde a partir do qual novos sites de catálogo/e-commerce
(no mesmo estilo do Gatum's) possam ser criados rapidamente, trocando apenas o
"conteúdo" (marca, textos, cores, contatos, API, domínio) e preservando o
"esqueleto" (build, deploy, design system, camada de API, estrutura de rotas).

A entrega desta primeira versão é a **opção B**: um conjunto de documentos de
contexto em `docs/` que descrevem o esqueleto, mapeiam os pontos de
parametrização e fornecem um prompt/checklist para adaptar um site novo (manual
ou assistido por IA). O design mantém o caminho aberto para a **opção C** (um
gerador/CLI automático) no futuro, sem retrabalho.

### Por que B antes de C

O repositório já é bem fatorado: a infraestrutura (build/deploy/SSR), o design
system (shadcn + tokens OKLCH), a camada de API (`src/lib/api`) e a estrutura
de rotas são genéricos. O que é específico do Gatum's é **conteúdo** (branding,
textos, cores, contatos, domínio, dados no Pix). O trabalho de reuso, portanto,
é **mapear e documentar** essa fronteira. Um gerador (C) só compensa depois que
essa fronteira estiver documentada e estável — logo, B é pré-requisito natural
de C.

### Não-objetivos (desta versão)

- Não construir um CLI ou gerador automático (fica para a opção C/futuro).
- Não refatorar o código existente para "parametrizar" tudo via config única.
- Não extrair o projeto base para um repositório separado.
- Não criar o repositório de skills (apenas registrar a intenção).

## Contexto da arquitetura atual

Retrato do que existe hoje, que fundamenta o inventário abaixo.

- **Stack:** TanStack Start + Vite + React 19 + Tailwind v4, via preset
  `@lovable.dev/vite-tanstack-config` (inclui tanstackStart, viteReact,
  tailwindcss, tsConfigPaths, nitro, alias `@`, injeção de `VITE_*`). Não há
  `vite.config.ts` manual tradicional — a config é o switch `DEPLOY_TARGET`.
- **Serve/deploy:** três alvos controlados por `process.env.DEPLOY_TARGET` em
  `vite.config.ts` — `vps` (produção, Node SSR em container Docker),
  `vercel-spa` (homologação, SPA estático) e `vercel-ssr` (futuro). Entrypoint
  SSR em `src/server.ts`; adaptador Node em `server/node-server.mjs`.
- **Rotas:** file-based em `src/routes/` (`routeTree.gen.ts` gerado). Público
  (`index`, `catalogo`, `sobre`, `login`, `register`) + `_authenticated`
  (`carrinho`, `minha-conta`, pagamento) + `admin` (produtos, categorias,
  clientes, pedidos, relatorios).
- **API:** `src/lib/api/` — `config.ts` (compõe base a partir de
  `VITE_API_BASE_URL` + `VITE_API_VERSION`; helpers de paginação), `client.ts`
  (`apiRequest`, token de `localStorage["gg.session"]`, ProblemDetails, 401) e
  services por recurso.
- **Design system:** `components.json` (shadcn new-york, lucide), `src/styles.css`
  (tokens OKLCH, fontes Playfair/Inter, utilities `.bg-gradient-warm` etc.),
  `src/components/ui/*`.

## Inventário: esqueleto vs conteúdo

### Esqueleto reutilizável (não muda entre sites)

- **Build/serve:** `vite.config.ts` (switch `DEPLOY_TARGET`),
  `server/node-server.mjs`, `src/server.ts`, `src/start.ts`, `dev-local.mjs`,
  `Dockerfile`.
- **UI base:** `src/components/ui/*` (shadcn), `src/lib/utils.ts`.
- **Camada de API:** `src/lib/api/` (client, `config.ts`, paginação, erro/401).
- **Contextos:** `src/lib/auth-context.tsx`, `src/lib/cart-context.tsx`.
- **Estrutura de rotas:** público + `_authenticated` + `admin`.

### Conteúdo específico do projeto (muda a cada site)

| Categoria | Onde está |
|---|---|
| Branding/textos | `Navigation.tsx`, `Footer.tsx`, `sobre.tsx`, `index.tsx` (hero/pilares/stats), meta tags em `__root.tsx` e em cada rota |
| Cores/fontes | `src/styles.css` (tokens OKLCH, `--font-*`) |
| Contatos/redes | `sobre.tsx` (WhatsApp, Instagram, e-mail, telefone), `Footer.tsx` |
| API/ambiente | `.env*`, `Dockerfile` (ARG `VITE_API_BASE_URL`), workflows |
| Domínio/deploy | `deploy/nginx-host-site.conf`, `docker-compose.production.yml` (nome container/rede), `.github/workflows/*` (host, path, projeto Vercel) |
| Dados embutidos no código | Pix em `src/lib/api/pagamentos.ts` (`5913GATUMS GOURMET`, `6009SAO PAULO`); prefixo de storage `gg.` em `client.ts` e services |
| Assets | `src/assets/hero-gourmet.jpg` |

### Lista de parâmetros (a "ficha" de cada site novo)

Nome do projeto · nome de exibição da marca · cores (primária/accent/secundária)
· fontes · contatos (e-mail/telefone/WhatsApp/Instagram) · cidade/estado · URL da
API + versão · domínio do site · nome no Pix · prefixo de storage · imagens.

## Entrega: documentos a criar em `docs/`

Todos sob `docs/projeto-base/`:

1. **`README.md`** — porta de entrada: o que é o projeto base, como usar, índice
   dos demais documentos.
2. **`inventario-esqueleto-vs-conteudo.md`** — o mapa acima, com caminhos de
   arquivo e explicação do que é reutilizável vs específico.
3. **`parametros.md`** — a ficha de parâmetros, com os valores atuais do Gatum's
   preenchidos como exemplo de referência.
4. **`checklist-novo-site.md`** — passo a passo manual para criar um site novo:
   o que trocar, em quais arquivos, e quais comandos rodar/validar.
5. **`prompt-geracao.md`** — o prompt (opção B) para colar em uma IA junto da
   ficha preenchida, de modo que ela adapte o site automaticamente.
6. **`evolucao-gerador.md`** — visão futura: como isso evolui para um gerador/CLI
   (opção C) e o que seria necessário para automatizar. Inclui também a seção
   **"Futuro: repositório de skills"**, registrando a intenção de extrair as
   skills de desenvolvimento para um repositório próprio (sem implementar agora).

## Fluxo de dados / de uso

1. O usuário copia o projeto base (clone/cópia do repo).
2. Preenche a ficha de `parametros.md` com os dados do novo negócio.
3. **Caminho manual:** segue `checklist-novo-site.md`, editando cada arquivo
   listado no inventário.
   **Caminho assistido:** cola `prompt-geracao.md` + a ficha preenchida em uma
   IA, que aplica as trocas nos arquivos mapeados.
4. Ajusta envs/deploy (API, domínio, nomes de container) e valida com
   `npm run dev` / `npm run build`.

## Tratamento de erros / riscos

- **Drift entre docs e código:** se o esqueleto mudar, os docs podem ficar
  desatualizados. Mitigação: manter o inventário enxuto e apontar caminhos de
  arquivo em vez de copiar trechos.
- **Parâmetros esquecidos:** um site novo com branding residual do Gatum's.
  Mitigação: o checklist funciona como lista de verificação final; a ficha
  centraliza tudo que precisa trocar.
- **Dados sensíveis:** o nome no Pix e o prefixo de storage estão embutidos no
  código; o inventário os destaca explicitamente para não passarem batido.

## Testes / verificação

Esta entrega é documental (sem código de produção). A verificação é:

- Revisão dos documentos quanto a completude (todos os pontos do inventário
  cobertos) e exatidão dos caminhos de arquivo.
- Prova de conceito opcional: seguir o checklist mentalmente para um "site
  fictício" e confirmar que nenhum ponto de parametrização ficou de fora.

## Evolução futura (fora do escopo desta versão)

- **Opção C — gerador/CLI:** a ficha de parâmetros vira input de um script que
  aplica as trocas automaticamente (ex.: `create-site --nome ... --cor ...`).
- **Repositório de skills:** extrair as skills de desenvolvimento para um
  repositório próprio, reutilizável entre projetos. Apenas registrado como
  intenção nesta versão.
