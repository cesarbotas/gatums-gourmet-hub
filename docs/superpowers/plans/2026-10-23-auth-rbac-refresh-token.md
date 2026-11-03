# Migração de Auth — RBAC + Refresh Token (Front) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o front para access token (15min) + refresh token (7 dias) com renovação automática no 401, e `user.role` (string) → `user.roles` (array PascalCase), mantendo `isAdmin` como fachada do contexto.

**Architecture:** Storage único `gg.session = { accessToken, refreshToken, user }`. Refresh automático dentro do `apiRequest` existente (fila compartilhada para 401 concorrentes; nunca refresha em `/auth/refresh` ou `/auth/login`). `isAdmin` deriva de `roles` incluir `"Admin"` ou `"Gerente"`. Sem React Query para auth.

**Tech Stack:** React 19, TanStack Router/Query, Vite, TypeScript. Sem suíte de testes (verificação por `tsc --noEmit` + `npm run build`).

**Spec:** `docs/superpowers/specs/2026-10-23-auth-rbac-refresh-token-design.md`

## Global Constraints

- Storage: chave única `gg.session`, shape `{ accessToken: string; refreshToken: string; user: User }`.
- `UserRole = "Admin" | "Cliente" | "Gerente"` (PascalCase, verbatim).
- Acesso admin = `roles` inclui `"Admin"` OU `"Gerente"`.
- Endpoints (base `API_BASE_URL` de `config.ts`): `POST /auth/login` `{ email, senha }`; `POST /auth/register` `{ nome, email, senha, telefone? }`; `POST /auth/refresh` `{ refreshToken }`; `POST /auth/logout` `{ refreshToken }` (Bearer); `GET /auth/me` (Bearer).
- Login/refresh response shape: `{ accessToken, refreshToken, expiresIn, user: { id, nome, email, roles: [] } }`.
- Refresh nunca recursa em `apiRequest` (usa `fetch` direto); nunca tenta refresh para os paths `/auth/refresh` e `/auth/login`.
- Não tocar nos `"admin"` de `PedidoActor` em `src/lib/api/pedidos.ts` e `src/lib/pedido-flow.ts`.
- Nenhuma mudança em React Query; auth permanece imperativa via contexto/serviço.

## Review Focus

- **401 concorrente dispara múltiplos refresh:** várias chamadas com access expirado ao mesmo tempo devem compartilhar UM refresh em voo. Teste pino na Task 2.
- **Loop de refresh em `/auth/refresh`:** um 401 vindo do próprio refresh/login não pode acionar outro refresh. Teste pino na Task 2.
- **Sessão do esquema antigo (`gg.session` sem `accessToken`):** usuário logado no formato velho — `getToken` deve retornar null e degradar para login, não quebrar. Teste pino na Task 2.
- **Roteamento pós-login para Gerente:** `roles: ["Gerente"]` deve ir para `/admin`, não `/minha-conta`. Teste pino na Task 3.
- **`isAdmin` com `roles` ausente/vazio:** `user` sem `roles` (undefined) não pode lançar; `isAdmin` deve ser `false`. Teste pino na Task 3.

---

## File Structure

- `src/lib/api/auth.ts` — tipos (`UserRole`, `User`, `Session`, `LoginResponse`), `authService` com `login`/`register`/`logout`/`refresh`/`me`/`getSession`/`isAdmin`/`getAuthHeaders`.
- `src/lib/api/client.ts` — `getToken` (lê `accessToken`), `apiRequest` com refresh automático no 401.
- `src/lib/auth-context.tsx` — tipo consumido, derivação `isAdmin`.
- `src/routes/login.tsx` — roteamento pós-login por `roles`.
- `.env.development` — `VITE_API_BASE_URL` documentado para a API da máquina de teste.

As Tasks 1 e 2 tocam o mesmo arquivo (`auth.ts` então `client.ts`), com dependência de interface entre elas; por isso são sequenciais e separadas (uma define o shape do storage, a outra o consome).

---

### Task 1: Tipos e serviço de auth (novo contrato)

**Files:**
- Modify: `src/lib/api/auth.ts`

**Interfaces:**
- Consome: `apiRequest` de `./client` (assinatura atual, ainda sem refresh), `readStore`/`writeStore` de `./storage`, `API_BASE_URL` não necessário aqui.
- Produz (consumido pelas Tasks 2-4):
  - `type UserRole = "Admin" | "Cliente" | "Gerente"`
  - `interface User { id: string; nome: string; email: string; telefone?: string; roles: UserRole[] }`
  - `interface Session { accessToken: string; refreshToken: string; user: User }`
  - `SESSION_KEY = "gg.session"`
  - `authService.login(email, password): Promise<Session>`
  - `authService.register(input): Promise<Session>`
  - `authService.logout(): Promise<void>`
  - `authService.refresh(): Promise<string | null>` (novo access token, ou null)
  - `authService.getSession(): Session | null`
  - `authService.isAdmin(): boolean`

- [ ] **Step 1: Atualizar tipos.** Em `src/lib/api/auth.ts`, trocar `UserRole` para `"Admin" | "Cliente" | "Gerente"`; `User.role` → `roles: UserRole[]`; `Session` → `{ accessToken, refreshToken, user }`; `LoginResponse` → `{ accessToken: string; refreshToken: string; expiresIn: number; user: User }`.

- [ ] **Step 2: `login`.** `POST /auth/login` `{ email, senha: password }`; montar `Session = { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user }`; `writeStore(SESSION_KEY, session)`; retornar session.

- [ ] **Step 3: `register`.** Manter: `POST /auth/register` `{ nome, email, senha: input.password, telefone }`, depois `return authService.login(input.email, input.password)`.

- [ ] **Step 4: `logout`.** Ler `refreshToken` da sessão; se existir, `POST /auth/logout` `{ json: { refreshToken } }`; no `finally`, `window.localStorage.removeItem(SESSION_KEY)`.

- [ ] **Step 5: `refresh`.** Novo método `refresh(): Promise<string | null>`: ler `refreshToken` da sessão (null → retorna null); `POST /auth/refresh` `{ json: { refreshToken } }` via `apiRequest` NÃO — usar `fetch` direto em `` `${API_BASE_URL}/auth/refresh` `` (importar `API_BASE_URL` de `./config`) para evitar recursão; em falha limpar sessão e retornar null; em sucesso, preservar o `user` atual e gravar `{ accessToken, refreshToken, user }` com o novo par, retornar o novo `accessToken`. (Observação: este método será chamado pelo `client.ts` na Task 2; aqui ele só precisa existir e estar correto isoladamente.)

- [ ] **Step 6: `getSession`/`isAuthenticated`/`isAdmin`/`getAuthHeaders`.** `getSession` lê `Session` novo; `isAuthenticated` = `!!getSession()`; `isAdmin()` = `(getSession()?.user.roles ?? []).some(r => r === "Admin" || r === "Gerente")`; `getAuthHeaders()` usa `session.accessToken`.

- [ ] **Step 7: Verificar tipos.** Run: `node ./node_modules/typescript/bin/tsc --noEmit`. Expected: pode acusar erros em `client.ts`/`auth-context.tsx`/`login.tsx` (que ainda usam `role`/`token`) — esses são resolvidos nas Tasks 2-4. NÃO deve haver erro dentro de `auth.ts` em si.

- [ ] **Step 8: Commit.**

```bash
git add src/lib/api/auth.ts
git commit -m "feat(auth): novo contrato de tokens e roles[] no authService"
```

---

### Task 2: Refresh automático no `apiRequest`

**Files:**
- Modify: `src/lib/api/client.ts`

**Interfaces:**
- Consome: `Session`/`SESSION_KEY` conceitualmente (lê `gg.session.accessToken`); `authService.refresh` NÃO é importado para evitar ciclo — o refresh é feito localmente via `fetch` em `API_BASE_URL + "/auth/refresh"`, lendo/gravando `gg.session` diretamente (mesmo shape da Task 1).
- Produz: `apiRequest` com refresh transparente (consumido por todos os services, sem mudança neles).

- [ ] **Step 1: `getToken` lê accessToken.** Em `getToken()`, parsear `gg.session` como `{ accessToken?: string }` e retornar `session.accessToken ?? null`. (Sessão do esquema antigo sem `accessToken` → null.)

- [ ] **Step 2: Helper de refresh compartilhado.** Adicionar no módulo: `let refreshing: Promise<boolean> | null = null;` e `async function doRefresh(): Promise<boolean>` que: lê `refreshToken` de `gg.session` (ausente → `false`); faz `fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ refreshToken }) })`; se `!resp.ok` → `localStorage.removeItem("gg.session")` e `false`; senão lê `{ accessToken, refreshToken }`, preserva o `user` do `gg.session` atual, regrava `gg.session` com o novo par, retorna `true`. Guardar por `typeof window`.

- [ ] **Step 3: 401 aciona refresh.** Em `apiRequest`, após obter `res`, se `res.status === 401` E `typeof window !== "undefined"` E o `path` não começa com `/auth/refresh` nem `/auth/login` E há `refreshToken` em `gg.session`: `refreshing ??= doRefresh().finally(() => { refreshing = null; })`; `const ok = await refreshing;` se `ok`, refazer a requisição uma vez com o novo token (reconstruir headers com o `accessToken` novo) e usar essa resposta daqui pra frente; se `!ok`, manter o comportamento atual (limpar `gg.session` + hard-redirect `/login`).

- [ ] **Step 4: Preservar erro terminal.** Se após o retry a resposta ainda não for `ok`, ou se não houve refresh, manter o fluxo de erro existente (incluindo o redirect no 401 terminal) e lançar `ApiError`.

- [ ] **Step 5: Verificar.** Run: `node ./node_modules/typescript/bin/tsc --noEmit`. Expected: sem erros em `client.ts`. (Erros remanescentes só em `auth-context.tsx`/`login.tsx`, resolvidos nas Tasks 3-4.)

- [ ] **Step 6: Commit.**

```bash
git add src/lib/api/client.ts
git commit -m "feat(auth): refresh automatico de access token no 401 (fila compartilhada)"
```

---

### Task 3: Contexto e roteamento pós-login

**Files:**
- Modify: `src/lib/auth-context.tsx`
- Modify: `src/routes/login.tsx`

**Interfaces:**
- Consome: `User` (com `roles`) e `authService` da Task 1.
- Produz: `isAdmin` no contexto (fachada estável) derivado de `roles`; `useAuth` inalterado na assinatura pública.

- [ ] **Step 1: Derivação de `isAdmin` no contexto.** Em `src/lib/auth-context.tsx`, trocar `isAdmin: user?.role === "admin"` por `isAdmin: (user?.roles ?? []).some((r) => r === "Admin" || r === "Gerente")`. O resto do provider (hidratação via `authService.getSession()?.user`, `login`/`register`/`logout`) permanece.

- [ ] **Step 2: Roteamento pós-login.** Em `src/routes/login.tsx`, trocar `router.navigate({ to: u.role === "admin" ? "/admin" : "/minha-conta" })` por checagem em `u.roles`: `const admin = (u.roles ?? []).some((r) => r === "Admin" || r === "Gerente"); router.navigate({ to: admin ? "/admin" : "/minha-conta" });`.

- [ ] **Step 3: Verificar.** Run: `node ./node_modules/typescript/bin/tsc --noEmit`. Expected: PASS (zero erros em todo o projeto) — todos os `role`/`token` antigos resolvidos.

- [ ] **Step 4: Build.** Run: `npm run build`. Expected: build conclui sem erro.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/auth-context.tsx src/routes/login.tsx
git commit -m "feat(auth): isAdmin via roles[] (Admin/Gerente) e roteamento pos-login"
```

---

### Task 4: Ambiente para teste entre máquinas

**Files:**
- Modify: `.env.development`

**Interfaces:**
- Consome: nada de código.
- Produz: configuração documentada para apontar o front à API local de outra máquina.

- [ ] **Step 1: Documentar/ajustar `.env.development`.** Adicionar um comentário explicando que, para rodar contra a API de outra máquina na rede local, defina `VITE_API_BASE_URL` para `http://<IP-da-maquina-da-API>:<porta>` (a versão é anexada por `config.ts` como `/api/v1`). Manter o valor atual como default comentado, para não quebrar quem roda contra produção. (Ex.: deixar o default existente e um exemplo comentado de IP local.)

- [ ] **Step 2: Commit.**

```bash
git add .env.development
git commit -m "chore(env): documenta VITE_API_BASE_URL para teste contra API em outra maquina"
```

---

## Self-Review

- **Spec coverage:** contrato de tokens (Tasks 1-2), refresh automático + concorrência + anti-loop (Task 2), `role`→`roles` e `isAdmin` fachada + Gerente (Tasks 1,3), roteamento pós-login (Task 3), ambiente de teste (Task 4), não-objetivos respeitados (nenhuma task toca React Query, PedidoActor, cookie/CORS, telas opcionais). Coberto.
- **Review Focus:** 401 concorrente e anti-loop → Task 2 (pino nos steps 2-3); sessão antiga → Task 2 step 1; Gerente no roteamento e `roles` ausente → Task 3 steps 1-2. Como não há suíte de testes, os "testes pino" são verificações manuais descritas na seção de verificação do spec + checagem de tipos; os pontos estão endereçados no código das tasks.
- **Type consistency:** `User.roles`, `Session.{accessToken,refreshToken}`, `SESSION_KEY` iguais entre Tasks 1-3; `client.ts` (Task 2) lê o mesmo shape sem importar `auth.ts` (evita ciclo).
- **Proportion:** plano proporcional ao spec; steps descrevem a decisão (onde ler/gravar, anti-loop, derivação), não transcrevem o corpo inteiro.
