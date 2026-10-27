# Como rodar os testes do front

Guia prático dos testes automatizados do `gatums-gourmet-hub`. Stack: [Vitest](https://vitest.dev/) + Testing Library, com ambiente `happy-dom` para os unitários.

## Visão geral

Existem dois conjuntos de testes, com propósitos e pré-requisitos diferentes:

- **Unitários / de componentes** — rápidos e sem rede. Cobrem:
  - lógica pura (ex.: composição de configuração);
  - serviços/`apiRequest` com `fetch` mockado (sem bater em servidor);
  - componentes React (render + interação via Testing Library).

  Ficam em `tests/unit/`. Rodam em ambiente `happy-dom` e não precisam da API no ar.

- **Integrados de contrato** — batem na API local **real** e validam o _shape_ das respostas de cada endpoint (não a regra de negócio). Ficam em `tests/integration/`. Rodam em ambiente `node` e precisam da API no ar.

## Comandos

| Comando | O que faz | Precisa da API? |
| --- | --- | --- |
| `npm test` | Roda os unitários **uma vez** (`vitest run`). | Não |
| `npm run test:watch` | Unitários em modo _watch_ (`vitest`). | Não |
| `npm run test:integration` | Integrados de contrato (`vitest run --config vitest.integration.config.ts`). | Sim |

Os unitários usam `vitest.config.ts`, cujo `include` cobre apenas `tests/unit/**` e exclui `tests/integration/**`. Ou seja, `npm test` **nunca** roda os integrados — eles só rodam sob demanda via `npm run test:integration`.

## Integrados — pré-requisitos

Os testes de contrato falam com a API local real. Para rodá-los:

1. **Suba a API local.** Ela deve responder em `http://localhost:5166`, com os endpoints sob a base `/api/v1`. O passo a passo para subir a API está em [`docs/Site/TESTE-auth-rbac-refresh-token.md`](./TESTE-auth-rbac-refresh-token.md) (seção de subir a API).
2. **Seed admin.** Os testes autenticam com o usuário semente `admin@gatums.com` / `Admin@123`.
3. Rode `npm run test:integration`.

### Se a API estiver fora do ar

Os integrados **pulam** (skip) com uma mensagem clara — **não falham** por erro de conexão. A verificação é feita uma vez antes dos testes (`apiOnline()` em `tests/integration/helpers.ts`); se a API não responder, você verá no console algo como:

```
API local fora do ar em http://localhost:5166/api/v1 — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md). Testes de contrato de auth PULADOS.
```

### Apontar para outra API

A base é composta por `process.env.VITE_API_BASE_URL` + `/api/` + `process.env.VITE_API_VERSION`, com os mesmos defaults do app (`http://localhost:5166` e `v1`). Para apontar para outra base, defina as variáveis antes de rodar:

- `VITE_API_BASE_URL` — raiz da API (ex.: `https://hml.exemplo.com`).
- `VITE_API_VERSION` — versão da rota (ex.: `v1`).

## Estrutura de pastas

```
tests/
├─ setup.ts                      # setup dos unitários (jest-dom)
├─ unit/
│  ├─ config.test.ts             # lógica pura
│  ├─ auth-service.test.ts       # serviço com fetch mockado
│  └─ login-form.test.tsx        # componente React
└─ integration/
   ├─ helpers.ts                 # baseUrl(), apiOnline(), loginAdmin()
   └─ auth.contract.test.ts      # contrato dos endpoints de auth

vitest.config.ts                 # config dos unitários (happy-dom, só tests/unit)
vitest.integration.config.ts     # config dos integrados (node, só tests/integration)
```

## Como adicionar novos testes

Espelhe a semente mais próxima do que você quer testar:

- **Lógica pura** → copie o estilo de `tests/unit/config.test.ts`.
- **Serviço com `fetch` mockado** → `tests/unit/auth-service.test.ts`.
- **Componente React** → `tests/unit/login-form.test.tsx`.
- **Contrato de endpoint** → `tests/integration/auth.contract.test.ts`. O padrão é sempre: **login → GET com `Bearer` → validar o shape** da resposta (não a regra de negócio). O arquivo traz um comentário-padrão no final mostrando como replicar para outros recursos (ex.: `/categorias`, `/produtos`), reaproveitando `loginAdmin()` e `baseUrl()` de `helpers.ts`.
