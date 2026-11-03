# Migração de Autenticação — RBAC + Refresh Token (Front) — Design

Data: 2026-10-23
Status: Proposto (aguardando revisão)

## Propósito

Adaptar o front `gatums-gourmet-hub` ao novo esquema de autenticação da API:
par **access token (15 min)** + **refresh token (7 dias)** com renovação
automática, e autorização por **papéis em array** (`user.roles`, PascalCase)
em vez de um papel único em string (`user.role`). O token único de ~8h deixa de
existir.

Referências do contrato: `docs/Auth/Guia-de-Uso.md` e `docs/Site/API-Reference.md`.

## Contexto da arquitetura atual

(Confirmado por investigação do código.)

- Sessão única em `localStorage["gg.session"]` = `{ token, user }`.
- `src/lib/api/auth.ts` (`authService`): `login`/`register`/`logout`/`me`,
  `getSession`, `isAdmin`, `getAuthHeaders`. `User` tem `role: "admin"|"cliente"`.
- `src/lib/api/client.ts` (`apiRequest`): injeta `Authorization: Bearer <token>`
  lido de `gg.session`; no 401, limpa a sessão e faz hard-redirect para `/login`.
  Todos os services usam `apiRequest`.
- `src/lib/auth-context.tsx`: `AuthProvider`/`useAuth`; deriva
  `isAdmin = user?.role === "admin"`; expõe `user`, `isAuthenticated`, `isAdmin`,
  `ready`, `login`, `register`, `logout`.
- Guards: `_authenticated.tsx` (só autenticação); `_authenticated/admin.tsx`
  (checa `isAdmin`).
- `login.tsx` é o único que lê `u.role` direto (roteia admin vs minha-conta).
- Sem React Query para auth; tudo imperativo via contexto/serviço.
- `me()` existe mas não é chamado hoje.

## Decisões de design (aprovadas)

1. **Storage unificado.** Guardar `gg.session = { accessToken, refreshToken, user }`
   em `localStorage`. Mantém uma fonte única e alinha as duas leituras existentes.
   (Dívida registrada: `localStorage` é vulnerável a XSS; cookie HttpOnly fica
   para fase futura com mudança de CORS na API.)
2. **Refresh dentro do `apiRequest` existente.** Não criar `http.ts` paralelo.
   Adaptar `client.ts` para, no 401, tentar `POST /auth/refresh` uma vez,
   compartilhando um único refresh em voo entre chamadas concorrentes, e repetir
   a requisição original. Só redireciona para `/login` se o refresh falhar.
3. **`isAdmin` como fachada.** Manter a propriedade `isAdmin` no contexto;
   mudar só a derivação interna para `roles.includes("Admin") ||
   roles.includes("Gerente")`. Admin e Gerente acessam a área administrativa.
   Isso evita tocar os ~7 consumidores de `isAdmin`.
4. **UI por roles (simples).** Nada de decodificar claims `perm` do JWT agora.
   Permissões finas ficam como evolução futura.

## Não-objetivos

- Não migrar a auth para React Query (mantém imperativo via contexto).
- Não implementar permissões finas via claims `perm`.
- Não mexer em cookie HttpOnly / CORS (fase 2 da API).
- Não tocar nos `"admin"` de `PedidoActor` (`pedidos.ts`, `pedido-flow.ts`) —
  são ator do fluxo de pedido, não papel de usuário.
- Não adicionar telas opcionais (logout-all, backoffice RBAC) nesta fase.

## Mudanças por arquivo

### `src/lib/api/auth.ts`
- `UserRole` passa a `"Admin" | "Cliente" | "Gerente"` (PascalCase).
- `User`: trocar `role: UserRole` por `roles: UserRole[]`.
- `Session`: `{ accessToken, refreshToken, user }`.
- `LoginResponse`: `{ accessToken, refreshToken, expiresIn, user }`.
- `login`: ler `accessToken`/`refreshToken` da resposta e gravar o novo shape.
- `register`: inalterado no fluxo (cria e loga em seguida).
- `logout`: enviar `POST /auth/logout` com `{ refreshToken }` antes de limpar.
- novo `refresh()`: `POST /auth/refresh` com `{ refreshToken }`, grava o novo par
  (rotação), retorna o novo `accessToken` (ou lança em falha).
- `getSession`/`isAuthenticated`: adaptados ao novo shape.
- `isAdmin()`/`getAuthHeaders()`: `isAdmin` via `roles`; `getAuthHeaders` lê
  `accessToken`. (Mantidos por consistência, ainda que `getAuthHeaders` seja
  redundante com o `client.ts`.)

### `src/lib/api/client.ts`
- `getToken()` lê `session.accessToken`.
- `apiRequest`: no 401 (e se houver refreshToken, e o path não for
  `/auth/refresh` nem `/auth/login`), aciona um refresh compartilhado:
  - `let refreshing: Promise<boolean> | null`; a primeira chamada cria a promise,
    as concorrentes aguardam a mesma; ao terminar, zera a variável.
  - Se o refresh deu certo, re-emite a requisição original com o novo access
    token e retorna seu resultado.
  - Se falhou, limpa a sessão e faz o hard-redirect para `/login` (comportamento
    atual), e lança `ApiError`.
- Guardas contra loop: nunca tentar refresh para as rotas `/auth/refresh` e
  `/auth/login` (um 401 nelas é terminal).
- O refresh usa `fetch` direto em `API_BASE_URL + "/auth/refresh"` para não
  recursar em `apiRequest`.

### `src/lib/auth-context.tsx`
- Tipo `User` passa a ter `roles`.
- `isAdmin: (user?.roles ?? []).some(r => r === "Admin" || r === "Gerente")`.
- Hidratação inicial inalterada (lê `getSession()?.user`).

### `src/routes/login.tsx`
- Roteamento pós-login: trocar `u.role === "admin"` por
  `u.roles?.some(r => r === "Admin" || r === "Gerente")` → `/admin`, senão
  `/minha-conta`.

### `src/routes/_authenticated/admin.tsx`
- Nenhuma mudança: continua usando `isAdmin` do contexto (já cobre Gerente).

### Ambiente (teste entre máquinas)
- `.env.development`: deixar `VITE_API_BASE_URL` apontável para a API local da
  outra máquina (ex. `http://<IP-da-API>:<porta>`), documentando como ajustar.
  `VITE_API_VERSION=v1` compõe `/api/v1` via `config.ts`.

## Fluxo de dados

**Login:** tela → `useAuth().login` → `authService.login` → `POST /auth/login`
`{ email, senha }` → grava `{ accessToken, refreshToken, user }` → contexto seta
`user` → `login.tsx` roteia por `roles`.

**Requisição autenticada:** service → `apiRequest` injeta `Bearer accessToken`.
Se 401 → refresh compartilhado → repete com novo access → sucesso; ou falha →
limpa sessão + `/login`.

**Logout:** `useAuth().logout` → `authService.logout` → `POST /auth/logout`
`{ refreshToken }` → limpa storage → contexto zera `user`.

## Tratamento de erros / riscos

- **Loop de refresh:** mitigado por (a) tentar refresh só uma vez por requisição,
  (b) nunca refreshar em `/auth/refresh` ou `/auth/login`, (c) refresh via fetch
  direto (não recursa em `apiRequest`).
- **Concorrência:** várias requisições com 401 ao mesmo tempo compartilham um
  único refresh em voo; todas repetem após ele resolver.
- **Refresh expirado/revogado:** `/auth/refresh` falha → sessão encerrada →
  `/login`.
- **Tokens antigos pós-deploy:** usuários logados no esquema velho precisam
  relogar (o `gg.session` antigo não terá `accessToken`; `getToken` retorna null
  → 401 → refresh sem `refreshToken` → login). Comportamento aceitável.
- **SSR:** leituras de `localStorage` já são guardadas por `typeof window`.

## Testes / verificação

Sem suíte de testes no projeto (verificação por tipos/build é o padrão aqui).

- `tsc --noEmit` limpo após as mudanças de tipo (`role` → `roles`).
- `npm run build` passa.
- Verificação manual (quando a API estiver disponível na máquina de teste):
  login (Admin/Gerente → /admin; Cliente → /minha-conta), expiração do access
  (esperar/forçar 401 e ver o refresh automático sem deslogar), logout revogando
  a sessão, e relogin após refresh expirado.

## Evolução futura (fora do escopo)

- Permissões finas via claims `perm` do JWT (ou `/auth/me` estendido).
- Tela "encerrar todas as sessões" (`/auth/logout-all`).
- Backoffice de RBAC (`/roles`, `/permissions`, `/usuarios`).
- Refresh em cookie HttpOnly + CORS por ambiente (fase 2 da API).
