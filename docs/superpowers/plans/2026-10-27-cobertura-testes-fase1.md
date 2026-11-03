# Cobertura de Testes — Fase 1 (Fundação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação da cobertura total de testes: a trava de ambiente (allowlist local/HML), os helpers de integração estendidos (criar Cliente/Gerente, loginComo), os 3 services novos de produção (roles/permissions/usuarios) e os contratos dos recursos de leitura simples (relatorios).

**Architecture:** Services novos seguem o padrão de `src/lib/api/categorias.ts` (tipo + `mapX(raw)` + objeto service via `apiRequest`). Helpers de integração em `tests/integration/helpers.ts`. Allowlist recusa qualquer base que não seja localhost/127.0.0.1 ou o host de HML.

**Tech Stack:** Vitest (unitários happy-dom; integração node), TypeScript, Vite 7. API local em `http://localhost:5166/api/v1`.

**Spec:** `docs/superpowers/specs/2026-10-27-cobertura-total-testes-design.md`

## Global Constraints

- OpenAPI é a fonte da verdade: `docs/Site/openapi-v1.json`.
- Allowlist (verbatim): integrados só rodam se `baseUrl()` contiver host `localhost`, `127.0.0.1` ou `gatums-gourmet-api.onrender.com` (HML). Qualquer outra base (PROD `gatumsgourmet.com.br` ou desconhecida) → **lançar erro** antes de qualquer requisição.
- Services novos seguem EXATAMENTE o padrão de `categorias.ts` (tipo exportado, `mapX` com defaults, objeto service, uso de `apiRequest` e `appendPageParams`/`mapPaginated`).
- Shapes dos requests (verbatim do OpenAPI):
  - `CreateRoleRequest { nome: string; descricao: string|null }`; `UpdateRoleRequest { id, nome, descricao }`; `SetRolePermissionsRequest { roleId: number; permissionIds: number[] }`.
  - `CreatePermissionRequest { codigo, descricao, recurso, acao }`; `UpdatePermissionRequest { id, descricao, recurso, acao }`.
  - `CreateUsuarioRequest { nome, email, senha, telefone, roleIds: number[] }`; `SetUsuarioRolesRequest { usuarioId: uuid; roleIds: number[] }`; `SetUsuarioAtivoRequest { usuarioId: uuid; ativo: boolean }`.
- Endpoints: `/roles` (GET list, POST), `/roles/{id}` (GET, PUT, DELETE), `/roles/{id}/permissions` (PUT); `/permissions` (GET, POST), `/permissions/{id}` (GET, PUT, DELETE); `/usuarios` (GET, POST), `/usuarios/{id}` (GET, DELETE), `/usuarios/{id}/roles` (PUT), `/usuarios/{id}/ativo` (PATCH); `/relatorios/vendas/resumo` (GET).
- IDs: roles/permissions são `number` (int32); usuarios são `uuid` (string).
- Não alterar services existentes nem o comportamento de produção além de adicionar os 3 services e reexportá-los em `index.ts`.
- `npm test` (unitários) não pode depender de rede.

## Review Focus

- **Allowlist falha-aberto:** se a checagem de ambiente tiver um furo (ex.: regex que casa PROD por engano, ou não roda antes das requisições), testes destrutivos tocariam PROD. Teste pino na Task 1 (casos: localhost→ok, onrender→ok, gatumsgourmet.com.br→lança, domínio aleatório→lança).
- **Service novo com shape errado de request:** um `roleIds`/`permissionIds` como string em vez de number[] quebraria a API. Unitários dos services (Task 3) exercem o body montado.
- **`mapX` sem defaults seguros:** retorno da API com campo ausente não pode quebrar o map. Unitários cobrem (Task 3).
- **loginComo/criação de usuário vaza credencial fixa:** os usuários Cliente/Gerente criados em setup devem usar emails únicos por run (evitar colisão "email já existe" entre rodadas). Task 2.
- **Reexport em index.ts quebrar imports existentes:** adicionar os 3 services não pode colidir com nomes já exportados. Task 1.

---

## File Structure

- `src/lib/api/roles.ts`, `src/lib/api/permissions.ts`, `src/lib/api/usuarios.ts` — services novos.
- `src/lib/api/index.ts` — reexporta os 3 novos.
- `tests/integration/helpers.ts` — estender: `assertAmbientePermitido()`, `loginComo()`, `criarUsuarioComPapel()`.
- `tests/integration/relatorios.contract.test.ts` — contrato de leitura (valida o fluxo end-to-end com admin).
- `tests/unit/roles-service.test.ts`, `permissions-service.test.ts`, `usuarios-service.test.ts` — unitários dos novos services.

---

### Task 1: Services novos (roles, permissions, usuarios) + reexport

**Files:**
- Create: `src/lib/api/roles.ts`, `src/lib/api/permissions.ts`, `src/lib/api/usuarios.ts`
- Modify: `src/lib/api/index.ts`

**Interfaces:**
- Consome: `apiRequest` de `./client`; `appendPageParams`/`mapPaginated`/`PaginatedResponse` de `./config`.
- Produz (consumido pelas Tasks 2-3):
  - `rolesService`: `list()`, `getById(id:number)`, `create({nome,descricao})→{id:number}`, `update(id,{nome,descricao})`, `remove(id:number)`, `setPermissions(id:number, permissionIds:number[])`. Tipo `Role { id:number; nome:string; descricao:string|null }`.
  - `permissionsService`: `list()`, `getById(id:number)`, `create({codigo,descricao,recurso,acao})→{id:number}`, `update(id,{descricao,recurso,acao})`, `remove(id:number)`. Tipo `Permission { id:number; codigo:string; descricao:string|null; recurso:string; acao:string }`.
  - `usuariosService`: `list()`, `getById(id:string)`, `create({nome,email,senha,telefone?,roleIds})→{id:string}`, `remove(id:string)`, `setRoles(id:string, roleIds:number[])`, `setAtivo(id:string, ativo:boolean)`. Tipo `Usuario { id:string; nome:string; email:string; roles?:string[]; ativo?:boolean }`.

- [ ] **Step 1:** Ler `src/lib/api/categorias.ts` (padrão) e `src/lib/api/index.ts` (o que já é reexportado).
- [ ] **Step 2:** Criar `roles.ts` no padrão: tipo `Role`, `mapRole(raw)` com defaults, `rolesService` com os métodos acima. `/roles` list usa paginação se a API paginar (checar OpenAPI: `/roles` GET não tem params de página → retornar array mapeado direto, como o fallback de `mapPaginated`/array). `setPermissions` → `PUT /roles/{id}/permissions` com `{ roleId:id, permissionIds }`.
- [ ] **Step 3:** Criar `permissions.ts` análogo. `/permissions` GET sem params → array direto. `update` → `PUT /permissions/{id}` com `{ id, descricao, recurso, acao }`.
- [ ] **Step 4:** Criar `usuarios.ts`. `create` → `POST /usuarios` com `{ nome,email,senha,telefone,roleIds }`; `setRoles` → `PUT /usuarios/{id}/roles` `{ usuarioId:id, roleIds }`; `setAtivo` → `PATCH /usuarios/{id}/ativo` `{ usuarioId:id, ativo }`.
- [ ] **Step 5:** Reexportar os 3 em `src/lib/api/index.ts` (seguir o estilo das reexportações existentes; não colidir nomes).
- [ ] **Step 6:** `node ./node_modules/typescript/bin/tsc --noEmit` → sem erros.
- [ ] **Step 7:** Commit.

```bash
git add src/lib/api/roles.ts src/lib/api/permissions.ts src/lib/api/usuarios.ts src/lib/api/index.ts
git commit -m "feat(api): services de roles, permissions e usuarios (camada de dados RBAC)"
```

---

### Task 2: Helpers de integração — allowlist + setup de perfis

**Files:**
- Modify: `tests/integration/helpers.ts`

**Interfaces:**
- Consome: `baseUrl` existente.
- Produz (consumido por todos os contratos futuros):
  - `assertAmbientePermitido(): void` — lança `Error` se o host de `baseUrl()` não for `localhost`/`127.0.0.1`/`gatums-gourmet-api.onrender.com`.
  - `loginComo(email:string, senha:string): Promise<string>` — retorna accessToken.
  - `criarClienteEGerente(): Promise<{ clienteToken:string; gerenteToken:string }>` — via admin: cria 2 usuários com emails únicos (timestamp), atribui papéis, loga; memoizado por processo.

- [ ] **Step 1: Escrever `assertAmbientePermitido`.** Parsear o host de `baseUrl()` com `new URL(baseUrl()).hostname`; allowlist `["localhost","127.0.0.1","gatums-gourmet-api.onrender.com"]`; se não estiver na lista, `throw new Error("Testes de contrato recusados: base '<url>' nao e local nem HML. (PROD/desconhecido bloqueado.)")`.
- [ ] **Step 2: Teste da allowlist (unitário rápido do helper).** Como este helper é lógica pura testável sem rede, criar `tests/unit/allowlist.test.ts` que importa `assertAmbientePermitido` mockando `baseUrl` (via `vi.stubEnv` de `VITE_API_BASE_URL`, ou extrair a lógica para uma função pura `hostPermitido(host)` e testar essa). Casos: `localhost`→ok; `127.0.0.1`→ok; `gatums-gourmet-api.onrender.com`→ok; `gatumsgourmet.com.br`→lança; `evil.com`→lança. **Decisão:** extrair `export function hostPermitido(host: string): boolean` em helpers e testá-la diretamente (mais simples que stubar env).
- [ ] **Step 3: `loginComo` e `criarClienteEGerente`.** `loginComo` faz POST `/auth/login`. `criarClienteEGerente`: com `loginAdmin()`, descobrir os roleIds de Cliente/Gerente (GET `/roles`, achar por nome), criar 2 usuarios (`POST /usuarios` com email `teste-cliente-<ts>@local.test` / `teste-gerente-<ts>@local.test`, senha fixa de teste, roleIds correspondentes), logar com cada um, retornar os tokens. Memoizar o resultado em variável de módulo.
- [ ] **Step 4:** `node ./node_modules/typescript/bin/tsc --noEmit` → sem erros. Rodar `npm test` → `allowlist.test.ts` verde.
- [ ] **Step 5:** Commit.

```bash
git add tests/integration/helpers.ts tests/unit/allowlist.test.ts
git commit -m "test(integration): allowlist local/HML + helpers de setup de perfis (Cliente/Gerente)"
```

---

### Task 3: Unitários dos 3 services novos

**Files:**
- Create: `tests/unit/roles-service.test.ts`, `tests/unit/permissions-service.test.ts`, `tests/unit/usuarios-service.test.ts`

**Interfaces:**
- Consome: `rolesService`/`permissionsService`/`usuariosService` da Task 1. Mock de `fetch`.

- [ ] **Step 1:** Para cada service, teste com `fetch` mockado (mesmo padrão de `auth-service.test.ts`): 
  - `create` monta o body correto (ex.: `usuariosService.create` envia `roleIds` como array de number; `rolesService.setPermissions` envia `{ roleId, permissionIds }`).
  - `list`/`getById` mapeiam o raw com defaults (campo ausente não quebra).
  - `setAtivo`/`setRoles` chamam o método/URL certos (PATCH/PUT) com o body certo.
  - Assertar via inspeção do 1º arg (URL) e do body (parse do `options.body`/`json`).
- [ ] **Step 2:** `npm test` → todos verdes.
- [ ] **Step 3:** Commit.

```bash
git add tests/unit/roles-service.test.ts tests/unit/permissions-service.test.ts tests/unit/usuarios-service.test.ts
git commit -m "test(unit): services de roles, permissions e usuarios (mapeamento + body)"
```

---

### Task 4: Contrato de relatorios + verificação da allowlist em runtime

**Files:**
- Create: `tests/integration/relatorios.contract.test.ts`

**Interfaces:**
- Consome: `assertAmbientePermitido`, `apiOnline`, `loginAdmin` dos helpers.

- [ ] **Step 1:** `beforeAll`: `assertAmbientePermitido()` (recusa PROD); checar `apiOnline()` → `describe.skipIf(!online)`.
- [ ] **Step 2:** Caso: `GET /relatorios/vendas/resumo` com Bearer admin → 200; validar que o corpo é um objeto (shape mínimo; ajustar aos campos reais ao rodar — anotar o shape observado no relatório). Caso de negação: sem token → 401.
- [ ] **Step 3:** Rodar `npm run test:integration` com a API local no ar. Esperado: relatorios + auth (já existente) verdes. Anotar no relatório o shape real de `/relatorios/vendas/resumo`. Confirmar que `npm test` (unitários) NÃO inclui integração.
- [ ] **Step 4:** Commit.

```bash
git add tests/integration/relatorios.contract.test.ts
git commit -m "test(integration): contrato de relatorios + guarda de allowlist em runtime"
```

---

## Self-Review

- **Spec coverage (Fase 1):** allowlist (Task 2+4), services novos (Task 1), unitários dos novos (Task 3), setup de perfis (Task 2), contrato de leitura exemplar (Task 4). As Fases 2-3 cobrem o resto (contratos de escrita + unitários dos services existentes).
- **Review Focus:** allowlist falha-aberto → Task 2 step 2 (pino com PROD/desconhecido); shape de request → Task 3; mapX defaults → Task 3; emails únicos por run → Task 2 step 3; reexport sem colisão → Task 1 step 5.
- **Type consistency:** `Role.id`/`Permission.id` number, `Usuario.id` string; `roleIds`/`permissionIds` number[] — iguais entre Task 1 (service) e Task 3 (teste). Allowlist host list idêntica entre `hostPermitido` e a constraint.
- **Proportion:** plano proporcional; os blocos descrevem assinaturas e os pontos de risco, não transcrevem os services inteiros (o implementador segue o padrão de categorias.ts).
