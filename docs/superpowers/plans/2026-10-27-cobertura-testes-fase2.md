# Cobertura de Testes — Fase 2 (Contratos de todos os endpoints) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrir com testes de contrato integrados TODOS os endpoints restantes da API (produtos, categorias, clientes, carrinho, pedidos, pagamentos, roles, permissions, usuarios), incluindo o ciclo de escrita POST→GET/PUT→DELETE em ordem, e a matriz de negação por papel (401/403).

**Architecture:** Um arquivo de contrato por recurso em `tests/integration/`, cada um com `assertAmbientePermitido()` + `apiOnline()` no topo (guardas da Fase 1). Usa `fetch` direto contra a API real (padrão de `auth.contract.test.ts`), com os bodies conforme OpenAPI. Escrita cria o recurso na hora e segue POST→GET/PUT→DELETE (opção C, auto-suficiente). Negação usa os tokens de Cliente/Gerente de `criarClienteEGerente()`.

**Tech Stack:** Vitest (config de integração, ambiente node). API local em `http://localhost:5166/api/v1`. Seed admin `admin@gatums.com`/`Admin@123`.

**Spec:** `docs/superpowers/specs/2026-10-27-cobertura-total-testes-design.md`

## Global Constraints

- Todos os contratos começam com `assertAmbientePermitido()` (bloqueia PROD) e pulam via `describe.skipIf(!online)` quando a API está offline. Padrão: espelhar `tests/integration/relatorios.contract.test.ts`.
- Bodies conforme OpenAPI (`docs/Site/openapi-v1.json`) e os shapes já implementados nos services (`src/lib/api/*.ts`). Enums inteiros: TipoProduto 0=simples/1=combo; MetodoPagamento/PedidoEtapa/EntregaTipo são integer (confirmar valores ao rodar).
- Escrita (opção C): cada teste CRIA o recurso que vai manipular (não depende de ids fixos); ordem POST→GET→PUT→DELETE dentro de um `describe` sequencial por recurso. Banco local/HML descartável.
- Query de paginação: `?pagina=&tamanho=` (obrigatórios em produtos/categorias/clientes/pedidos GET list).
- IDs: produtos/clientes/usuarios/pedidos/transações = uuid; categorias/roles/permissions = number.
- Validar SHAPE e STATUS, não regra de negócio.
- Negação representativa (não exaustiva): sem token → 401; Cliente em endpoint só-admin → 403.
- Rodar via `npm run test:integration` (nunca no `npm test`).

## Review Focus

- **Ordem de escrita quebrando entre si:** se um `describe` rodar DELETE antes do POST que cria o alvo, o teste falha espúrio. Cada recurso deve criar no `beforeAll`/primeiro teste e deletar no último, em ordem determinística. Tasks 1-3.
- **403 inferido errado:** o papel exigido por endpoint não está no OpenAPI; um 403 esperado pode vir 200/401. Os testes de negação assertam o comportamento REAL; se divergir, ajustar e anotar. Task 4.
- **Dado órfão ao falhar no meio:** opção C aceita lixo, mas um POST que cria e um DELETE que não roda (teste falhou antes) deixa resíduo — aceitável (banco descartável), mas usar `afterAll` best-effort para deletar quando possível. Tasks 1-3.
- **Enum inteiro errado no body:** ex.: `tipo` de produto como "simples" em vez de 0 quebraria o POST. Confirmar os inteiros ao rodar. Task 1.
- **Idempotency-Key em pagamentos:** `/pagamentos/iniciar` aceita o header; enviar um valor único evita colisão em reexecução. Task 3.

---

## File Structure

- `tests/integration/categorias.contract.test.ts` — CRUD completo (ids number, mais simples).
- `tests/integration/produtos.contract.test.ts` — CRUD (precisa de uma categoria; cria uma antes).
- `tests/integration/clientes.contract.test.ts` — CRUD (endereco obrigatório no POST).
- `tests/integration/carrinho.contract.test.ts` — GET, add item, patch qty, delete item, clear.
- `tests/integration/pedidos.contract.test.ts` — list, getById, checkout, etapas/avancar, pagamento/concluir.
- `tests/integration/pagamentos.contract.test.ts` — opcoes, iniciar, cartao, status, pix/confirmar, validar.
- `tests/integration/roles.contract.test.ts` — CRUD + setPermissions.
- `tests/integration/permissions.contract.test.ts` — CRUD.
- `tests/integration/usuarios.contract.test.ts` — list, create, getById, setRoles, setAtivo, delete.
- `tests/integration/autorizacao.contract.test.ts` — matriz de negação (401/403) com Cliente/Gerente.

As tarefas agrupam recursos por afinidade e dependência de dados.

---

### Task 1: Contratos de recursos de catálogo (categorias, produtos)

**Files:**
- Create: `tests/integration/categorias.contract.test.ts`, `tests/integration/produtos.contract.test.ts`

**Interfaces:**
- Consome: `assertAmbientePermitido`, `apiOnline`, `baseUrl`, `loginAdmin` de `./helpers`.
- Produz: padrão de ciclo CRUD reutilizável pelas Tasks 2-3.

- [ ] **Step 1 (categorias):** `describe.skipIf(!online)` + `assertAmbientePermitido()` no topo. Com Bearer admin, em ordem: `POST /categorias` `{nome:"Teste-"+ts, descricao:null, ativo:true}` → captura `id` (number) → `GET /categorias/{id}` 200 e shape `{id,nome,descricao,ativo}` → `GET /categorias?pagina=1&tamanho=10` 200 shape paginado (`itens`/`totalRegistros`) → `PUT /categorias/{id}` `{id,nome,descricao,ativo:false}` → `DELETE /categorias/{id}`. `afterAll` best-effort tenta deletar o id se ainda existir.
- [ ] **Step 2 (produtos):** cria uma categoria (reusa o fluxo) para ter `categoriaId`. Com admin: `POST /produtos` `{nome,descricao,categoriaId,preco,fotoUrl,disponivel:true,tipo:0,itens:null}` → `id` uuid → `GET /produtos/{id}` 200 shape → `GET /produtos?pagina=1&tamanho=10` 200 paginado → `PUT /produtos/{id}` `{id,nome,descricao,categoriaId,preco,fotoUrl,disponivel:false}` → `DELETE /produtos/{id}`. Limpar a categoria criada no `afterAll`.
- [ ] **Step 3:** `npm run test:integration` com API no ar → categorias + produtos verdes. Anotar no relatório os valores de enum/shape observados (ex.: confirmação de `tipo:0`).
- [ ] **Step 4:** Commit.

```bash
git add tests/integration/categorias.contract.test.ts tests/integration/produtos.contract.test.ts
git commit -m "test(integration): contrato CRUD de categorias e produtos"
```

---

### Task 2: Contratos de clientes, roles, permissions, usuarios

**Files:**
- Create: `clientes.contract.test.ts`, `roles.contract.test.ts`, `permissions.contract.test.ts`, `usuarios.contract.test.ts`

**Interfaces:**
- Consome: helpers + padrão da Task 1.

- [ ] **Step 1 (clientes):** `POST /clientes` com `endereco` obrigatório (shape `EnderecoRequest`: logradouro/numero/complemento/bairro/cidade/estado/cep) → `id` uuid → `PUT /clientes/{id}` `{id,nome,email,telefone}` (sem endereco) → `DELETE /clientes/{id}`. GET list paginado.
- [ ] **Step 2 (roles):** `POST /roles` `{nome:"Teste-"+ts,descricao:null}` → id number → `GET /roles/{id}` → `GET /roles` (array) → `PUT /roles/{id}` `{id,nome,descricao}` → `PUT /roles/{id}/permissions` `{roleId:id,permissionIds:[]}` → `DELETE /roles/{id}`.
- [ ] **Step 3 (permissions):** `POST /permissions` `{codigo:"teste:"+ts,descricao:null,recurso:"teste",acao:"ler"}` → id number → GET/{id} → GET list → `PUT /permissions/{id}` `{id,descricao,recurso,acao}` → DELETE.
- [ ] **Step 4 (usuarios):** `GET /roles` p/ achar um roleId válido → `POST /usuarios` `{nome,email:"u-"+ts+"@local.test",senha:"Teste@123",telefone:null,roleIds:[roleId]}` → id uuid → `GET /usuarios/{id}` → `GET /usuarios` → `PUT /usuarios/{id}/roles` `{usuarioId:id,roleIds:[roleId]}` → `PATCH /usuarios/{id}/ativo` `{usuarioId:id,ativo:false}` → `DELETE /usuarios/{id}`.
- [ ] **Step 5:** `npm run test:integration` → os 4 verdes. Anotar shapes.
- [ ] **Step 6:** Commit.

```bash
git add tests/integration/clientes.contract.test.ts tests/integration/roles.contract.test.ts tests/integration/permissions.contract.test.ts tests/integration/usuarios.contract.test.ts
git commit -m "test(integration): contrato CRUD de clientes, roles, permissions e usuarios"
```

---

### Task 3: Contratos de carrinho, pedidos, pagamentos (fluxo de compra)

**Files:**
- Create: `carrinho.contract.test.ts`, `pedidos.contract.test.ts`, `pagamentos.contract.test.ts`

**Interfaces:**
- Consome: helpers + padrão das Tasks 1-2. Precisa de um produto disponível (criar um no setup).

- [ ] **Step 1 (carrinho):** setup cria categoria+produto disponível. Com um token de cliente (via `criarClienteEGerente` ou um cliente dedicado): `GET /carrinho` 200 → `POST /carrinho/itens` `{produtoId,quantidade:1}` → `PATCH /carrinho/itens/{produtoId}` `{quantidade:2}` → `DELETE /carrinho/itens/{produtoId}` → `DELETE /carrinho` (limpar). Validar shape do carrinho.
- [ ] **Step 2 (pedidos):** com o carrinho montado, `POST /pedidos/checkout` `{clienteNome:"Teste"}` → pedido `id` uuid → `GET /pedidos/{id}` shape → `GET /pedidos?pagina=1&tamanho=10` paginado → `POST /pedidos/{id}/etapas/avancar` `{proximaEtapa:<int>,observacao:null,entregaTipo:<int>}` (confirmar os inteiros ao rodar; se a transição exigir sequência específica, anotar). Validar status/shape; tolerar 4xx documentado se a transição exigir estado que o teste não montou (anotar).
- [ ] **Step 3 (pagamentos):** `GET /pagamentos/opcoes` 200 (shape) → com um pedido, `POST /pagamentos/iniciar` com header `Idempotency-Key: <uuid único>` e `{pedidoId,metodo:<int>,valor:<number>}` → transacao `id` → `GET /pagamentos/{transacaoId}/status` → conforme o método: `POST /pagamentos/{transacaoId}/cartao` `{numero,nome,validade,cvv}` OU `POST /pagamentos/{transacaoId}/pix/confirmar` → `POST /pagamentos/{transacaoId}/validar`. Validar shape/status; anotar os enums de MetodoPagamento observados.
- [ ] **Step 4:** `npm run test:integration` → os 3 verdes (ou com 4xx documentados onde a máquina de estado exigir). Anotar no relatório os enums e qualquer transição que precisou de ordem específica.
- [ ] **Step 5:** Commit.

```bash
git add tests/integration/carrinho.contract.test.ts tests/integration/pedidos.contract.test.ts tests/integration/pagamentos.contract.test.ts
git commit -m "test(integration): contrato de carrinho, pedidos e pagamentos (fluxo de compra)"
```

---

### Task 4: Matriz de negação por papel (401/403)

**Files:**
- Create: `tests/integration/autorizacao.contract.test.ts`

**Interfaces:**
- Consome: `criarClienteEGerente()` (tokens de Cliente/Gerente), `loginAdmin`, helpers.

- [ ] **Step 1:** `assertAmbientePermitido()` + skip offline. `beforeAll` obtém `{ clienteToken, gerenteToken }` via `criarClienteEGerente()` e o admin via `loginAdmin()`.
- [ ] **Step 2: 401 (sem token).** Endpoints protegidos representativos sem `Authorization` → 401: `GET /usuarios`, `GET /roles`, `GET /permissions`, `GET /relatorios/vendas/resumo`.
- [ ] **Step 3: 403 (Cliente em endpoint só-admin).** Com `clienteToken`: `GET /usuarios` → espera 403; `GET /roles` → 403; `GET /permissions` → 403; `POST /permissions` → 403. **Assertar o comportamento REAL:** se algum vier diferente de 403 (ex.: 200 ou 401), ajustar a expectativa para o status real e ANOTAR no relatório qual papel a API realmente exige. Não forçar 403 se a API não retornar.
- [ ] **Step 4 (opcional, se o tempo permitir):** um caso com `gerenteToken` mostrando um acesso que o Gerente tem vs não tem, conforme observado.
- [ ] **Step 5:** `npm run test:integration` → verde. Anotar a matriz real observada (quem recebe o quê).
- [ ] **Step 6:** Commit.

```bash
git add tests/integration/autorizacao.contract.test.ts
git commit -m "test(integration): matriz de negacao por papel (401/403)"
```

---

## Self-Review

- **Spec coverage (Fase 2):** todos os recursos restantes com contrato (Tasks 1-3), ciclo POST→...→DELETE (Tasks 1-3), matriz de negação 401/403 (Task 4). Auth e relatorios já cobertos na Fase 1.
- **Review Focus:** ordem de escrita → Tasks 1-3 (criar antes, deletar depois, afterAll best-effort); 403 inferido → Task 4 (assere o real, ajusta e anota); dado órfão → aceito (banco descartável) + afterAll; enum inteiro → Task 1/3 (confirmar ao rodar); Idempotency-Key → Task 3.
- **Type/shape consistency:** bodies conforme OpenAPI e services existentes; IDs number vs uuid consistentes; enums inteiros confirmados em runtime.
- **Proportion:** o plano descreve o fluxo e os pontos de risco por recurso; não transcreve cada arquivo de teste (o implementador segue o padrão de relatorios.contract.test.ts da Fase 1).
- **Nota de realidade:** como os endpoints de pedidos/pagamentos têm máquina de estado, alguns passos podem retornar 4xx se a sequência exigir estado específico; o plano permite documentar esses casos em vez de forçar verde, mantendo o teste fiel ao comportamento real.
