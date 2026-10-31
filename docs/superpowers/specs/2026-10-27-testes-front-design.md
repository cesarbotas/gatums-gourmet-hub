# Infraestrutura de Testes do Front — Design

Data: 2026-10-27
Status: Proposto (aguardando revisão)

## Propósito

Introduzir testes automatizados no front `gatums-gourmet-hub`, que hoje não tem
nenhum. Dois conjuntos:

1. **Unitários/componentes** — rápidos, isolados, sem rede. Cobrem lógica pura,
   a camada de serviço/`apiRequest` com `fetch` mockado, e componentes React.
   Rodam sempre (dia a dia e CI).
2. **Integrados de contrato** — batem na API local real (`localhost:5166`) e
   validam que o shape da resposta de cada endpoint corresponde ao que o front
   espera. Rodam sob demanda (precisam da API no ar).

Objetivo do usuário: ao alterar a API, rodar os testes de contrato no front e
validar rapidamente se a integração continua de pé; e, ao mexer no front, ter
testes unitários/componentes para pegar regressões — inclusive em componentes.

## Contexto atual

- Projeto Vite v7 + React 19 + TanStack Router/Query + TypeScript.
- **Zero** dependências ou config de teste hoje.
- A branch sai de `develop`, que **já contém** a migração de auth (contrato novo:
  `accessToken`/`refreshToken`, `user.roles: UserRole[]` com `"Admin"`/`"Cliente"`/
  `"Gerente"`). Confirmado em `src/lib/api/auth.ts`.
- API local sobe em `http://localhost:5166`, base `/api/v1`. Seed admin:
  `admin@gatums.com` / `Admin@123` (ver docs do projeto). Login real já validado
  retornando `{ accessToken, refreshToken, expiresIn: 900, user: { roles: ["Admin"] } }`.

## Decisões de design (aprovadas)

1. **Ferramenta única: Vitest** + React Testing Library + happy-dom. Reaproveita
   a config/aliases do Vite (`@/`). Cobre os três tipos de teste.
2. **Separação por config + pasta**, não por ferramenta: um conjunto unitário
   (padrão) e um conjunto integrado (sob demanda).
3. **Testes-semente representativos**, não exaustivos: um exemplo de cada tipo,
   servindo de modelo. A cobertura cresce conforme o código é alterado.
4. **Integrados pulam (skip) com mensagem clara** quando a API não está no ar —
   não falham com erro de conexão, para não confundir "API desligada" com
   "contrato quebrado".

## Não-objetivos

- Não escrever teste para todos os componentes/serviços agora (só as sementes).
- Não usar navegador headless / E2E (Playwright) — fora de escopo.
- Não configurar pipeline de CI nesta fase (os scripts ficam prontos; integrar
  ao GitHub Actions é trabalho futuro).
- Não alterar código de produção (só adicionar testes e config; ajustes mínimos
  só se um alvo não for testável sem refatorar — nenhum previsto).

## Estrutura

```
gatums-gourmet-hub/
├── vitest.config.ts                 # unitários: ambiente happy-dom; exclui tests/integration
├── vitest.integration.config.ts     # integração: ambiente node; só tests/integration
├── tests/
│   ├── setup.ts                     # matchers do @testing-library/jest-dom
│   ├── unit/
│   │   ├── config.test.ts           # (A) lógica pura: buildApiBaseUrl, mapPaginated
│   │   ├── auth-service.test.ts     # (C) authService/apiRequest com fetch mockado
│   │   └── login-form.test.tsx      # (B) componente: login + olhinho + rota por role
│   └── integration/
│       ├── helpers.ts               # base URL, "API no ar?", login helper
│       └── auth.contract.test.ts    # (A integrado) contrato dos endpoints de auth
```

Ambas as configs reutilizam `vite-tsconfig-paths` (ou equivalente) para resolver
o alias `@/`. A config unitária usa `environment: "happy-dom"` e `setupFiles:
["tests/setup.ts"]`; a de integração usa `environment: "node"`, `include:
["tests/integration/**"]`, sem setup de DOM.

## Scripts (package.json)

```
"test"              → vitest run
"test:watch"        → vitest
"test:integration"  → vitest run --config vitest.integration.config.ts
```

`test`/`test:watch` rodam apenas os unitários (a config padrão exclui
`tests/integration`). `test:integration` roda só os contratos.

## Dependências novas (devDependencies)

`vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
`@testing-library/user-event`, `happy-dom`. Versões fixadas (pinned) compatíveis
com React 19 e Vite 7.

## Testes-semente

### Unitários

- **(A) `config.test.ts`** — `buildApiBaseUrl`: raiz limpa compõe `/api/v1`; raiz
  já com `/api/vN` é respeitada; raiz com `/api` só anexa a versão. `mapPaginated`:
  traduz `itens`/`totalRegistros` → `items`/`total` e aplica `mapItem`.
- **(C) `auth-service.test.ts`** — com `fetch` e `localStorage` mockados:
  - `authService.login` grava `gg.session` com `{ accessToken, refreshToken, user }`.
  - `apiRequest`: em 401, chama `/auth/refresh` uma vez e repete a requisição com o
    novo token.
  - Single-flight: dois 401 concorrentes disparam **um só** `/auth/refresh`.
  - Não tenta refresh quando o próprio path é `/auth/login` (401 terminal).
  - `isAdmin`: `roles` com `"Admin"` ou `"Gerente"` → true; só `"Cliente"` → false;
    `roles` ausente → false (não lança).
- **(B) `login-form.test.tsx`** — renderiza a tela de login; o botão de olhinho
  alterna o `type` do input entre `password`/`text`; um `login` mockado que retorna
  `roles: ["Admin"]` leva à navegação para `/admin` (mock do router).

### Integrados (contra `localhost:5166`)

- **`helpers.ts`** — resolve a base da API do mesmo jeito que o front
  (`VITE_API_BASE_URL` + `/api/v1`); função `apiOnline()` que pinga a API; função
  `loginAdmin()` que obtém um accessToken real para endpoints protegidos.
- **`auth.contract.test.ts`** — para os endpoints de auth, valida shape (não regra
  de negócio):
  - `POST /auth/login` (seed admin) → 200, corpo tem `accessToken: string`,
    `refreshToken: string`, `expiresIn: number`, `user.roles: string[]`.
  - `POST /auth/login` com credenciais inválidas → 4xx (não 200).
  - `GET /auth/me` com Bearer válido → 200 + `{ id, nome, email, roles: [] }`;
    sem token → 401.
  - Comentário no arquivo mostrando o **padrão** para replicar em outros recursos
    (`/categorias`, `/produtos`, etc.).
  - Todo o suite faz `skip` com mensagem se `apiOnline()` for falso.

## Fluxo de uso

- **Dia a dia / CI:** `npm test` (unitários, sem rede, rápido).
- **Validar integração após mexer na API:** subir a API em `localhost:5166`, então
  `npm run test:integration`. Se a API estiver fora, os testes pulam avisando.

## Tratamento de erros / riscos

- **API fora do ar nos integrados:** `apiOnline()` → `describe.skip` com mensagem;
  não quebra o comando.
- **Seed/dados da API:** os contratos dependem do seed admin existir. Se o seed
  mudar, o `loginAdmin()` helper centraliza o ajuste num só lugar.
- **Flakiness de rede:** os integrados usam timeout curto e são sob demanda; não
  entram no `npm test` padrão, então não tornam o CI instável.
- **happy-dom vs jsdom:** happy-dom é mais leve e suficiente para os componentes
  deste projeto; se algum componente usar API de DOM não suportada, trocar para
  jsdom é só mudar o `environment`.

## Testes / verificação

- `npm test` roda e passa (os 3 testes-semente unitários verdes).
- `npm run test:integration` com a API no ar: contratos verdes; com a API fora:
  pulam com mensagem.
- `npm run build` continua passando (a adição de devDeps/config não afeta o build
  de produção).

## Evolução futura (fora de escopo)

- Cobertura crescente: um teste por componente/serviço conforme forem alterados.
- Integração com CI (rodar `npm test` no GitHub Actions; os integrados num job
  separado com a API disponível).
- E2E de navegador (Playwright), se um dia quiser testar a UI ponta a ponta.
