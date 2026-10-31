# Infraestrutura de Testes do Front — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Vitest + Testing Library ao front com dois conjuntos de teste — unitários/componentes (sempre, sem rede) e integrados de contrato (sob demanda, contra a API local) — mais testes-semente de cada tipo.

**Architecture:** Uma ferramenta (Vitest), dois targets por config: `vitest.config.ts` (happy-dom, `tests/unit`, exclui integração) e `vitest.integration.config.ts` (node, só `tests/integration`). Alias `@/` resolvido por `vite-tsconfig-paths`. Integrados pulam com mensagem quando a API está fora do ar.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, happy-dom. Vite 7 + React 19 + TS. Alias `@/* -> ./src/*`.

**Spec:** `docs/superpowers/specs/2026-10-27-testes-front-design.md`

## Global Constraints

- Ferramenta única: **Vitest**. Sem Jest, sem Playwright/E2E.
- Separação por config + pasta: `tests/unit/**` (padrão) e `tests/integration/**` (sob demanda). `npm test` NÃO acessa a rede.
- Contrato de auth atual (verbatim): login/refresh retornam `{ accessToken: string, refreshToken: string, expiresIn: number, user: { id, nome, email, roles: string[] } }`. Papéis PascalCase `"Admin"|"Cliente"|"Gerente"`. Storage: `localStorage["gg.session"] = { accessToken, refreshToken, user }`.
- API local: base `${VITE_API_BASE_URL}/api/${VITE_API_VERSION}`, default `http://localhost:5166` + `v1`. Seed admin: `admin@gatums.com` / `Admin@123`.
- Alias `@/` deve funcionar nos testes (via `vite-tsconfig-paths`, já dependência do projeto).
- Não alterar código de produção (só `package.json`, configs de teste e arquivos sob `tests/`).
- Versões de devDeps fixadas (pinned), compatíveis com Vite 7 / React 19.
- Integrados: `describe.skip` com mensagem quando a API não responde — nunca falhar por conexão.

## Review Focus

- **`npm test` acessa a rede sem querer:** o conjunto padrão deve excluir `tests/integration`; um integrado que vaze para o runner padrão deixaria o CI dependente da API. Verificado na Task 1 (config exclui) + Task 5 (integração só na config própria).
- **Single-flight do refresh sob 401 concorrente:** o teste de serviço deve provar UM só `/auth/refresh` para dois 401 simultâneos; um mock mal feito mascara regressão. Task 3.
- **Loop de refresh em `/auth/login`:** o 401 do próprio login não pode disparar refresh. Task 3.
- **`isAdmin` com `roles` ausente/vazio:** não pode lançar; deve ser `false`. Task 3.
- **Integrado quando API offline:** deve PULAR com mensagem, não falhar com ECONNREFUSED. Task 5.

---

## File Structure

- `package.json` — devDeps + scripts `test`, `test:watch`, `test:integration`.
- `vitest.config.ts` — unitários (happy-dom, setup, exclui integração).
- `vitest.integration.config.ts` — integrados (node, só `tests/integration`).
- `tests/setup.ts` — importa `@testing-library/jest-dom`.
- `tests/unit/config.test.ts` — lógica pura.
- `tests/unit/auth-service.test.ts` — serviço/apiRequest com fetch mockado.
- `tests/unit/login-form.test.tsx` — componente.
- `tests/integration/helpers.ts` — base URL, apiOnline, loginAdmin.
- `tests/integration/auth.contract.test.ts` — contrato dos endpoints.

---

### Task 1: Setup do Vitest (deps, configs, script unitário) + smoke test

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/unit/smoke.test.ts` (removido no fim da task, ver steps)

**Interfaces:**
- Produz: `npm test` funcional (Vitest, happy-dom, alias `@/`, exclui `tests/integration`), consumido por todas as tasks seguintes.

- [ ] **Step 1:** Instalar devDeps (versões fixas compatíveis com Vite 7 / React 19): `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `happy-dom`. Comando: `npm install -D <pacotes>`.
- [ ] **Step 2:** Criar `vitest.config.ts` com: plugin `vite-tsconfig-paths` (resolve `@/`), `test.environment: "happy-dom"`, `test.globals: true`, `test.setupFiles: ["tests/setup.ts"]`, `test.include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"]`, `test.exclude` incluindo `tests/integration/**` e os defaults.
- [ ] **Step 3:** Criar `tests/setup.ts` com `import "@testing-library/jest-dom";`.
- [ ] **Step 4:** Adicionar scripts no `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:integration": "vitest run --config vitest.integration.config.ts"`.
- [ ] **Step 5 (smoke):** Criar `tests/unit/smoke.test.ts` com um teste trivial (`expect(1 + 1).toBe(2)`).
- [ ] **Step 6:** Rodar `npm test`. Esperado: PASS (1 teste). Confirma Vitest + happy-dom + include funcionando.
- [ ] **Step 7:** Remover `tests/unit/smoke.test.ts` (era só prova de vida).
- [ ] **Step 8:** Commit.

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts
git commit -m "test: setup do Vitest + Testing Library (config unitaria)"
```

---

### Task 2: Teste unitário (A) — lógica pura de `config.ts`

**Files:**
- Create: `tests/unit/config.test.ts`

**Interfaces:**
- Consome: `npm test` (Task 1); `buildApiBaseUrl` (não exportada hoje — ver Step 1), `mapPaginated` e `appendPageParams` de `@/lib/api/config`.

- [ ] **Step 1:** Verificar se `buildApiBaseUrl` é exportada em `src/lib/api/config.ts`. Hoje NÃO é (é interna). Decisão: testar via as funções já exportadas — `mapPaginated` e `appendPageParams` são `export function`. Para `buildApiBaseUrl`, exportá-la é uma mudança mínima de produção (`export function buildApiBaseUrl`) que não altera comportamento; FAZER essa exportação é permitido (tornar testável). Alternativa se preferir não tocar produção: cobrir só `mapPaginated`/`appendPageParams`. **Ruling do plano:** exportar `buildApiBaseUrl` (uma palavra, sem efeito colateral) para cobrir a composição de URL, que é lógica de risco.
- [ ] **Step 2: Escrever os testes.**

```ts
import { describe, it, expect } from "vitest";
import { buildApiBaseUrl, mapPaginated, appendPageParams } from "@/lib/api/config";

describe("buildApiBaseUrl", () => {
  it("compoe /api/<versao> em raiz limpa", () => {
    expect(buildApiBaseUrl("http://localhost:5166", "v1")).toBe("http://localhost:5166/api/v1");
  });
  it("respeita raiz que ja inclui /api/vN", () => {
    expect(buildApiBaseUrl("http://x/api/v1", "v2")).toBe("http://x/api/v1");
  });
  it("anexa versao quando raiz termina em /api", () => {
    expect(buildApiBaseUrl("http://x/api", "v1")).toBe("http://x/api/v1");
  });
  it("remove barra final antes de compor", () => {
    expect(buildApiBaseUrl("http://x/", "v1")).toBe("http://x/api/v1");
  });
});

describe("appendPageParams", () => {
  it("usa defaults 1/10 e seta pagina/tamanho", () => {
    const qs = new URLSearchParams();
    const r = appendPageParams(qs);
    expect(qs.get("pagina")).toBe("1");
    expect(qs.get("tamanho")).toBe("10");
    expect(r).toEqual({ page: 1, pageSize: 10 });
  });
});

describe("mapPaginated", () => {
  it("traduz itens/totalRegistros e aplica mapItem", () => {
    const res = { itens: [{ n: 1 }], totalRegistros: 1, paginaAtual: 2, tamanhoPagina: 25 };
    const out = mapPaginated(res, (raw: any) => raw.n as number, { page: 1, pageSize: 10 });
    expect(out).toEqual({ items: [1], total: 1, page: 2, pageSize: 25 });
  });
});
```

- [ ] **Step 3:** Se o Step 1 decidiu exportar, aplicar `export` em `buildApiBaseUrl` no arquivo de produção.
- [ ] **Step 4:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit.

```bash
git add tests/unit/config.test.ts src/lib/api/config.ts
git commit -m "test(unit): logica pura de config (buildApiBaseUrl, mapPaginated, appendPageParams)"
```

---

### Task 3: Teste unitário (C) — `authService`/`apiRequest` com fetch mockado

**Files:**
- Create: `tests/unit/auth-service.test.ts`

**Interfaces:**
- Consome: `authService` de `@/lib/api/auth`; `apiRequest` de `@/lib/api/client`. Mock de `globalThis.fetch` e de `localStorage` (happy-dom já provê `localStorage`).

- [ ] **Step 1: Escrever os testes** cobrindo os pontos do Review Focus. Use `vi.fn()` para `fetch`, `beforeEach` limpando `localStorage` e os mocks. Casos:
  - `authService.login`: mock de `fetch` resolve `{ accessToken:"a", refreshToken:"r", expiresIn:900, user:{ id:"1", nome:"X", email:"e", roles:["Admin"] } }` → após `login`, `localStorage["gg.session"]` parseado tem `accessToken`/`refreshToken`/`user.roles`.
  - **Refresh no 401:** primeira chamada de `apiRequest("/algo")` → `fetch` responde 401; em seguida `/auth/refresh` responde 200 com novo par; a requisição original é refeita e resolve. Assert: `fetch` foi chamado para `/auth/refresh` e a chamada original repetiu.
  - **Single-flight:** disparar `apiRequest("/a")` e `apiRequest("/b")` concorrentes, ambas 401; assert que `/auth/refresh` foi chamado **uma só vez**.
  - **Anti-loop no login:** `apiRequest("/auth/login")` com 401 NÃO chama `/auth/refresh`.
  - **`isAdmin`:** gravar sessão com `roles:["Gerente"]` → `authService.isAdmin()` true; `["Cliente"]` → false; `user` sem `roles` → false (sem lançar).
- [ ] **Step 2:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 3:** Commit.

```bash
git add tests/unit/auth-service.test.ts
git commit -m "test(unit): authService/apiRequest (login, refresh 401, single-flight, isAdmin)"
```

---

### Task 4: Teste de componente (B) — tela de login

**Files:**
- Create: `tests/unit/login-form.test.tsx`

**Interfaces:**
- Consome: a rota/`componente` de login de `@/routes/login`; `@testing-library/react` + `user-event`. Mock de `@/lib/auth-context` (`useAuth`) e do router do TanStack conforme necessário.

- [ ] **Step 1: Investigar o export testável.** `src/routes/login.tsx` exporta `Route` (TanStack). Para testar o componente isolado, pode ser necessário extrair/renderizar `LoginPage`. Se `LoginPage` não for exportado, **Ruling:** exportar o componente `LoginPage` (named export, sem alterar comportamento) para permitir render isolado — mudança mínima de produção, permitida por testabilidade. Mockar `useAuth` (retornando um `login` mockado) e o `useRouter`/`navigate`.
- [ ] **Step 2: Escrever os testes:**
  - Renderiza a tela; há campo e-mail, campo senha e botão Entrar.
  - **Olhinho:** o input de senha começa `type="password"`; ao clicar no botão de mostrar, vira `type="text"`; ao clicar de novo, volta a `password`. (`aria-label` alterna "Mostrar senha"/"Ocultar senha".)
  - **Rota por role:** com `useAuth().login` mockado resolvendo `{ roles:["Admin"] }`, submeter o form chama `navigate` para `/admin`; com `{ roles:["Cliente"] }`, para `/minha-conta`.
- [ ] **Step 3:** Rodar `npm test`. Esperado: PASS.
- [ ] **Step 4:** Commit.

```bash
git add tests/unit/login-form.test.tsx src/routes/login.tsx
git commit -m "test(unit): componente de login (olhinho de senha + roteamento por role)"
```

---

### Task 5: Integrados de contrato — config + helpers + endpoints de auth

**Files:**
- Create: `vitest.integration.config.ts`
- Create: `tests/integration/helpers.ts`
- Create: `tests/integration/auth.contract.test.ts`

**Interfaces:**
- Consome: `npm run test:integration` (script da Task 1). Lê `VITE_API_BASE_URL`/`VITE_API_VERSION` do ambiente (ou usa defaults `http://localhost:5166`/`v1`).
- Produz: padrão de teste de contrato replicável para outros recursos.

- [ ] **Step 1:** Criar `vitest.integration.config.ts`: `vite-tsconfig-paths`, `test.environment: "node"`, `test.include: ["tests/integration/**/*.{test,spec}.ts"]`, sem `setupFiles` de DOM. Timeout de teste curto (ex. `testTimeout: 8000`).
- [ ] **Step 2:** Criar `tests/integration/helpers.ts`:
  - `baseUrl()`: compõe `${VITE_API_BASE_URL ?? "http://localhost:5166"}/api/${VITE_API_VERSION ?? "v1"}` (mesma regra do front).
  - `apiOnline(): Promise<boolean>`: faz `fetch(baseUrl())` com timeout curto; retorna true se obteve QUALQUER resposta HTTP (mesmo 404), false em erro de conexão.
  - `loginAdmin(): Promise<string>`: `POST /auth/login` com `admin@gatums.com`/`Admin@123`, retorna o `accessToken`.
- [ ] **Step 3:** Criar `tests/integration/auth.contract.test.ts`:
  - No topo: `const online = await apiOnline();` e usar `describe.skipIf(!online)` (ou checar e `it.skip`) com mensagem "API local fora do ar em <url> — suba a API (ver docs/Site/TESTE-auth-rbac-refresh-token.md)".
  - `POST /auth/login` (seed admin) → status 200; corpo com `accessToken` string, `refreshToken` string, `expiresIn` number, `user.roles` array.
  - `POST /auth/login` credenciais inválidas → status >= 400.
  - `GET /auth/me` com `Authorization: Bearer <loginAdmin()>` → 200 + `{ id, nome, email, roles }`; sem header → 401.
  - Comentário no fim mostrando o padrão para replicar em `/categorias`, `/produtos`, etc.
- [ ] **Step 4:** Rodar `npm run test:integration`. Se a API estiver no ar: PASS. Se não: os testes PULAM com a mensagem (não falham). Rodar também `npm test` e confirmar que os integrados NÃO entram no conjunto padrão.
- [ ] **Step 5:** Commit.

```bash
git add vitest.integration.config.ts tests/integration/
git commit -m "test(integration): contrato dos endpoints de auth contra API local (skip se offline)"
```

---

### Task 6: Documentar como rodar os testes

**Files:**
- Create: `docs/Site/TESTES-front.md`

**Interfaces:**
- Consome: scripts e estrutura das Tasks 1-5.

- [ ] **Step 1:** Escrever doc curto: os dois conjuntos (unitário vs integrado), os três scripts (`test`, `test:watch`, `test:integration`), que `npm test` não precisa de API, que os integrados precisam da API em `localhost:5166` (e pulam se offline), e como adicionar novos testes seguindo as sementes.
- [ ] **Step 2:** Commit.

```bash
git add docs/Site/TESTES-front.md
git commit -m "docs(site): como rodar os testes do front (unitarios + contrato)"
```

---

## Self-Review

- **Spec coverage:** Vitest+TL+happy-dom (T1), config unitária que exclui integração (T1), config integração (T5), sementes A/C/B (T2/T3/T4), contrato com skip offline (T5), scripts (T1), doc (T6). Não-objetivos respeitados (sem Playwright, sem CI, sem cobrir tudo). Coberto.
- **Step scan:** cada step produz uma coisa verificável; os testes trazem assertions concretas com os valores do contrato; as duas Rulings (exportar `buildApiBaseUrl` e `LoginPage`) são decisões reais de testabilidade, declaradas.
- **Type consistency:** shape do contrato (`accessToken`/`refreshToken`/`expiresIn`/`user.roles`) idêntico entre T3 (mock) e T5 (real) e igual ao `auth.ts` da develop. `gg.session` consistente.
- **Review Focus:** rede fora do `npm test` → T1+T5; single-flight → T3; anti-loop login → T3; `isAdmin` sem roles → T3; skip offline → T5. Cada um com teste/verificação na task dona.
- **Proportion:** plano proporcional; os blocos de código são os testes-semente (o entregável real), não transcrição de produção.
