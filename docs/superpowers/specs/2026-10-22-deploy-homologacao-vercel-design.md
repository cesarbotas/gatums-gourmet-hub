# Deploy de Homologação na Vercel — Design

Data: 2026-10-22
Status: aprovado em brainstorming, aguardando revisão do spec

## 1. Objetivo e intenção

Criar um pipeline de deploy de **homologação** totalmente separado do de
produção. Quando um Pull Request **cuja base (alvo) é `release`** receber um
**Approve**, o GitHub Actions builda o **código daquele PR** e publica o site na
**Vercel**, apontando para a **API de homologação** em
`https://gatums-gourmet-api.onrender.com`.

O deploy de produção existente (VPS Locaweb via `deploy.yml`, push na `main`)
**não é alterado**.

## 2. Separação produção × homologação

| Aspecto        | Produção (existente)                | Homologação (novo)                        |
|----------------|-------------------------------------|-------------------------------------------|
| Plataforma     | VPS Locaweb (Docker + Node SSR)     | Vercel (serverless)                       |
| Gatilho        | push na `main`                      | PR aprovado com base `release` + manual   |
| Arquivo        | `.github/workflows/deploy.yml`      | `.github/workflows/deploy-homologacao.yml`|
| API            | `gatumsgourmet.com.br/api/v1`       | `gatums-gourmet-api.onrender.com`         |
| Secrets        | `VPS_*`                             | `VERCEL_*`, `VITE_API_BASE_URL_HOMOLOG`   |
| Autorização    | branch protection da `main`         | GitHub Environment `homologacao`          |

## 3. Gatilhos

### 3.1 Automático — PR aprovado
```yaml
on:
  pull_request_review:
    types: [submitted]
```
Deploy ocorre apenas quando TODAS as condições forem verdadeiras:
1. `github.event.review.state == 'approved'` (é um Approve, não comment/changes).
2. `github.event.pull_request.base.ref == 'release'` (PR mira a branch `release`).

Publica o `head` do PR (`github.event.pull_request.head.sha`) — o código exato
que foi aprovado, NÃO a branch `release` (que ainda não tem o merge).

### 3.2 Manual — rerun
```yaml
on:
  workflow_dispatch:
    inputs:
      ref:
        description: "Branch/tag/SHA a publicar em homologação"
        default: "release"
        required: false
```
Permite rerodar homologação após o PR já mergeado, sem abrir PR novo.

### 3.3 Concorrência
`concurrency` por PR/ref para cancelar deploys sobrepostos do mesmo alvo.

Escopo: fluxo 100% interno (sem PRs de fork), então o evento
`pull_request_review` tem acesso aos secrets normalmente.

## 4. Autorização — Environment `homologacao`

Mecanismo nativo do GitHub (a "lista de bypass"):

- O job de deploy declara `environment: homologacao`.
- Em Settings → Environments → `homologacao`, define-se **required reviewers**
  = lista de pessoas autorizadas a publicar em homologação.
- Ao atingir o job (automático OU manual), o GitHub **pausa e exige aprovação**
  de alguém dessa lista antes de executar.
- Os secrets `VERCEL_*` e `VITE_API_BASE_URL_HOMOLOG` ficam DENTRO desse
  Environment — sem aprovação, nada é publicado.

## 5. Build e variável de ambiente

- Runner: Node 22 + npm 11, `npm ci` (mesma stack já validada no projeto).
- Alvo Vercel: detecção automática do Nitro/TanStack Start (a Vercel define
  `VERCEL=1` no build; o Nitro gera a saída serverless sozinho). O
  `cloudflare: false` do `vite.config.ts` permanece; nada de produção muda.
  **A ser verificado em build de teste**; se a detecção falhar, aplicar preset
  Vercel condicional sem afetar o build da VPS.
- `VITE_API_BASE_URL` = `https://gatums-gourmet-api.onrender.com`, vindo do
  secret `VITE_API_BASE_URL_HOMOLOG` do Environment.

### Fluxo do deploy (Vercel CLI)
1. Checkout do `head` do PR (ou do `ref` no disparo manual).
2. `npm ci`.
3. `vercel pull` (config do projeto via `VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID`).
4. `vercel build` com `VITE_API_BASE_URL` da homologação.
5. `vercel deploy --prebuilt` (sem `--prod`: homologação é staging, separado do
   production da Vercel).
6. Imprime a URL do deploy no log do Actions.

## 6. Arquivos

- `.github/workflows/deploy-homologacao.yml` — NOVO, independente.
- `.env.homologacao` — alterado para apontar ao Render.
- `vercel.json` — NOVO e mínimo, SOMENTE se o teste de build indicar necessidade.
- `.github/workflows/deploy.yml` (produção) — INTOCADO.

## 7. Secrets/variáveis (Environment `homologacao`)

- `VERCEL_TOKEN` — token da conta Vercel.
- `VERCEL_ORG_ID` — ID da org/conta Vercel.
- `VERCEL_PROJECT_ID` — ID do projeto Vercel.
- `VITE_API_BASE_URL_HOMOLOG` = `https://gatums-gourmet-api.onrender.com`.
- Required reviewers do Environment = lista autorizada.

## 8. Verificação

Antes de entregar (com evidência):
- `npm ci` + build em Node 22 + npm 11 (Docker).
- Validação de sintaxe YAML do workflow novo.
- Teste da detecção Vercel/Nitro (simulando `VERCEL=1`); fallback para preset
  condicional se falhar.

Não verificável sem acesso (comprova no primeiro uso real):
- Deploy real na Vercel.
- Disparo por review no GitHub e o gate do Environment.

## 9. Pré-requisitos do usuário (fora do código)

1. Criar projeto na Vercel e vincular (`vercel link`).
2. Gerar `VERCEL_TOKEN` e obter `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`.
3. Cadastrar os secrets no Environment `homologacao` do GitHub.
4. Definir os required reviewers do Environment.
(Passo a passo detalhado será fornecido na entrega.)
