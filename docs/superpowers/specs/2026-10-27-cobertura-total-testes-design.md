# Cobertura Total de Testes (Integrados + Unitários) — Design

Data: 2026-10-27
Status: Proposto (aguardando revisão)

## Propósito

Expandir a infraestrutura de testes do front `gatums-gourmet-hub` (já existente:
Vitest + Testing Library, com sementes) para cobrir **todos os endpoints** da API,
nos dois níveis:

1. **Integrados de contrato** — cobrir as ~55 operações do OpenAPI
   (`docs/Site/openapi-v1.json`), batendo na API real, validando shape e status,
   incluindo o ciclo de escrita (POST→GET/PUT→DELETE) e a matriz de autorização.
2. **Unitários** — cobrir TODOS os services do front (os existentes + 3 novos a
   criar) com `fetch` mockado: mapeamento raw→tipado, montagem de query, parse.

Para viabilizar os unitários de áreas ainda não consumidas, serão criados 3
**services novos de produção** no front: `roles.ts`, `permissions.ts`,
`usuarios.ts` (camada de dados do backoffice RBAC; sem UI nesta fase).

## Contexto atual

- Infra de teste já montada (Vitest, happy-dom, `tests/unit` + `tests/integration`,
  scripts `test`/`test:watch`/`test:integration`). Ver
  `docs/superpowers/specs/2026-10-27-testes-front-design.md`.
- Sementes existentes: `config.test.ts`, `auth-service.test.ts`,
  `login-form.test.tsx`, `auth.contract.test.ts` (+ `helpers.ts`).
- Services existentes em `src/lib/api/`: auth, carrinho, categorias, clientes,
  enderecos, pagamentos, pedidos, produtos, vendas. Padrão: tipo + `mapX(raw)` +
  objeto service (`list`/`getById`/`create`/`update`/`remove`), usando `apiRequest`
  e os helpers `appendPageParams`/`mapPaginated` de `config.ts`.
- OpenAPI salvo em `docs/Site/openapi-v1.json` (fonte da verdade dos endpoints).
- Seed admin confirmado: `admin@gatums.com` / `Admin@123` (todas as permissões).
- 3 perfis na API: Cliente, Gerente, Admin.

## Decisões de design (aprovadas)

1. **Cobrir todos os ~55 endpoints nos integrados.**
2. **Estratégia de escrita (opção C):** banco local/HML é descartável; não há
   teardown. Para robustez entre rodadas, cada teste que precisa de um id **cria
   o recurso na hora** (POST), usa o id retornado para GET/PUT/DELETE, nesta ordem.
   Testes auto-suficientes, sem depender de ids fixos pré-existentes.
3. **Ordem POST→...→DELETE por recurso:** o fluxo de escrita roda em sequência
   dentro de um `describe` ordenado por recurso, garantindo que o DELETE tenha
   alvo recém-criado.
4. **Matriz de autorização:** cobertura geral com token **admin**; setup cria um
   **Cliente** e um **Gerente** via API (admin `POST /usuarios` + `PUT
   /usuarios/{id}/roles`, login); testes de **negação**: sem token → 401; Cliente
   em endpoint só-admin → 403. (Papéis exigidos inferidos das permissões; o teste
   reflete o comportamento real da API — ajustar se divergir.)
5. **Services novos de produção:** `roles.ts`, `permissions.ts`, `usuarios.ts`
   seguindo o padrão de `categorias.ts`. Sem UI.
6. **Unitários para todos os services** (existentes + novos), com `fetch` mockado.
7. **Trava de ambiente (allowlist):** os integrados só rodam se `baseUrl()`
   apontar para **localhost/127.0.0.1** OU o host de HML
   (`gatums-gourmet-api.onrender.com`). Qualquer outra base (PROD
   `gatumsgourmet.com.br` ou desconhecida) → os integrados **abortam com erro
   explícito**, nunca criam registros. Esta trava é diferente do skip de
   "API offline".

## Não-objetivos

- Não construir UI de backoffice (Roles/Permissions/Usuarios) — só a camada de service.
- Não rodar integrados em CI/pipeline de deploy. `npm test` (unitários) é seguro
  para CI; `npm run test:integration` é manual e só local/HML.
- Não cobrir uma matriz 403 exaustiva por papel/endpoint — apenas casos
  representativos de negação. Matriz completa de autorização fica para fase futura.
- Não alterar o comportamento dos services existentes (só adicionar os 3 novos e
  os testes).

## Arquitetura / estrutura

### Services novos (produção) — `src/lib/api/`
Cada um no padrão de `categorias.ts`:
- `roles.ts` — `Role` (id:number, nome, permissions?); `rolesService` com `list`,
  `getById`, `create`, `update`, `remove`, `setPermissions(id, permissionIds)`.
- `permissions.ts` — `Permission` (id:number, nome/chave); `permissionsService`
  com `list`, `getById`, `create`, `update`, `remove`.
- `usuarios.ts` — `Usuario` (id:uuid, nome, email, roles, ativo); `usuariosService`
  com `list`, `getById`, `create`, `remove`, `setRoles(id, roleIds)`,
  `setAtivo(id, ativo)`.
Tipos/campos exatos derivados do OpenAPI (`CreateRoleRequest`,
`SetRolePermissionsRequest`, `CreateUsuarioRequest`, `SetUsuarioRolesRequest`,
`SetUsuarioAtivoRequest`, etc.). `src/lib/api/index.ts` reexporta os novos.

### Integrados — `tests/integration/`
- `helpers.ts` (estender): manter `baseUrl`/`apiOnline`/`loginAdmin`; adicionar
  `assertAmbientePermitido()` (allowlist local+HML; lança se PROD/desconhecido),
  `loginComo(email, senha)`, e um helper de setup que cria Cliente/Gerente via
  admin e devolve seus tokens (memoizado por run).
- Um arquivo de contrato por tag/recurso:
  `auth.contract.test.ts` (já existe, manter/expandir), `produtos.contract.test.ts`,
  `categorias.contract.test.ts`, `clientes.contract.test.ts`,
  `carrinho.contract.test.ts`, `pedidos.contract.test.ts`,
  `pagamentos.contract.test.ts`, `relatorios.contract.test.ts`,
  `roles.contract.test.ts`, `permissions.contract.test.ts`,
  `usuarios.contract.test.ts`.
- Cada arquivo: `beforeAll` chama `assertAmbientePermitido()` e `apiOnline()`
  (skip se offline); valida shape/status de cada operação da sua tag; recursos com
  escrita seguem POST→GET/PUT→DELETE.
- Negação: um bloco com 401 (sem token) e 403 (Cliente em endpoint só-admin).

### Unitários — `tests/unit/`
- Manter os existentes. Adicionar um arquivo por service:
  `produtos-service.test.ts`, `categorias-service.test.ts`,
  `clientes-service.test.ts`, `carrinho-service.test.ts`,
  `pedidos-service.test.ts`, `pagamentos-service.test.ts`,
  `enderecos-service.test.ts`, `vendas-service.test.ts`, e para os novos
  `roles-service.test.ts`, `permissions-service.test.ts`,
  `usuarios-service.test.ts`.
- Cada um com `fetch` mockado: confirma a URL/método/body montados e o
  mapeamento raw→tipado do retorno (incl. defaults e tradução de paginação).

## Fluxo de dados / de uso

- **Unitários:** `npm test` — sem rede, mockam `fetch`. Rodam em qualquer lugar.
- **Integrados:** `npm run test:integration` —
  1. `assertAmbientePermitido()` valida a base (local/HML) — aborta se PROD.
  2. `apiOnline()` — skip com mensagem se a API não responde.
  3. setup cria Cliente/Gerente (via admin), obtém tokens.
  4. cada recurso valida suas operações (shape/status), escrita em ordem.

## Tratamento de erros / riscos

- **Rodar contra PROD:** impedido pela allowlist (aborta antes de qualquer
  chamada de escrita). Risco mais crítico, mitigado na origem.
- **Estado mutável (opção C):** cada teste cria o que manipula → idempotente
  entre rodadas; sem dependência de ordem entre arquivos.
- **Papel exigido divergente:** os 403 inferidos podem não bater 1:1 com a regra
  real; o teste assere o comportamento real e é ajustado na validação. Casos de
  negação são representativos, não exaustivos.
- **Poluição de dados em HML:** aceita por decisão (ambiente de teste); re-seed
  quando quiser. PROD nunca é tocado.
- **Idempotency-Key em pagamentos:** o endpoint `/pagamentos/iniciar` aceita
  header opcional; os testes podem enviá-lo para evitar duplicidade.

## Testes / verificação

- `npm test` (unitários) verde, cobrindo todos os services (existentes + novos).
- `npm run test:integration` com API local no ar → todos os contratos verdes;
  com base PROD → aborta com erro de allowlist (verificável sem tocar PROD, só
  checando a mensagem); com API offline → skip.
- `npm run build` + `tsc` limpos (os 3 services novos tipados corretamente).
- Fonte de verdade dos endpoints/shapes: `docs/Site/openapi-v1.json`.

## Evolução futura (fora de escopo)

- UI do backoffice de RBAC consumindo os novos services.
- Matriz completa de autorização (todos os papéis × todos os endpoints).
- Integração dos unitários ao CI (GitHub Actions).
