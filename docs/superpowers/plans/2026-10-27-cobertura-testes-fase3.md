# Cobertura de Testes — Fase 3 (Unitários dos services existentes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrir com testes unitários (fetch mockado, sem rede) os 8 services existentes do front que ainda não têm teste: produtos, categorias, clientes, carrinho, pedidos, pagamentos, enderecos, vendas — validando mapeamento raw→tipado, montagem de query/body e normalizações.

**Architecture:** Um arquivo de teste por service em `tests/unit/`, espelhando `tests/unit/auth-service.test.ts` e os unitários da Fase 1 (fetch mockado via `vi.stubGlobal`, `API_BASE_URL` importado, inspeção de `fetchMock.mock.calls`). Ambiente happy-dom. Não toca a API nem produção.

**Tech Stack:** Vitest (config unitária, happy-dom). TypeScript. Sem rede.

**Spec:** `docs/superpowers/specs/2026-10-27-cobertura-total-testes-design.md`

## Global Constraints

- Testes unitários puros: `fetch` mockado; nenhum acesso à API real. Rodam no `npm test`.
- Espelhar o padrão de `tests/unit/auth-service.test.ts` (helpers `fakeResponse`, `vi.stubGlobal("fetch", ...)`, `API_BASE_URL` de `@/lib/api/config` para montar URLs esperadas).
- Testar o comportamento REAL dos services (ler cada arquivo antes); validar mapeamento (defaults, normalização), URL/método/body montados, e tradução de paginação onde aplicável.
- NÃO alterar código de produção. Se um service tiver dependência difícil de mockar (ex.: `qrcode`, `crypto.randomUUID`, `localStorage`, `viacep`), mockar no teste (setup), não mudar o service.
- `pagamentos.ts` tem `VITE_PAYMENTS_MOCK`; focar nas funções de normalização (`normalizeMetodo`/`normalizeStatus`) e no caminho REST com fetch mockado, não no mock interno.
- `enderecos.ts` tem fallback localStorage + ViaCEP; testar o caminho API (fetch mockado) e `consultarCep` (fetch do viacep mockado).

## Review Focus

- **Normalização de enums (pagamentos/pedidos):** `normalizeMetodo` (int, "cartao_credito", "cartaocredito") e `normalizeStatus` (int, "pendente"→aprovada etc.) e `normalizeEtapa` (pedidos) têm muitos ramos — um mapeamento errado passa despercebido sem teste. Tasks 2-3.
- **Default seguro no mapX:** campo ausente no raw não pode quebrar o map (cada service). Todas as tasks.
- **Query de paginação:** produtos/categorias/clientes montam `?pagina=&tamanho=` + filtros; um filtro omitido ou nome errado quebra a chamada. Task 1.
- **enderecos fallback:** se a API falhar, cai no localStorage — o teste deve cobrir o caminho API (sucesso) sem acionar o fallback por engano; e `consultarCep` deve mockar o fetch do viacep. Task 3.
- **vendas shape frouxo:** `list()` retorna `res.vendas ?? res.items ?? []` — testar que mapeia os três casos. Task 3.

---

## File Structure

- `tests/unit/produtos-service.test.ts`, `categorias-service.test.ts`, `clientes-service.test.ts` — Task 1 (CRUD + paginação + enums simples).
- `tests/unit/carrinho-service.test.ts`, `pedidos-service.test.ts` — Task 2 (mapItem, mapPedido, normalizeEtapa, checkout).
- `tests/unit/pagamentos-service.test.ts`, `enderecos-service.test.ts`, `vendas-service.test.ts` — Task 3 (normalizações, viacep, fallback, shape frouxo).

---

### Task 1: Unitários de produtos, categorias, clientes

**Files:**
- Create: `tests/unit/produtos-service.test.ts`, `tests/unit/categorias-service.test.ts`, `tests/unit/clientes-service.test.ts`

**Interfaces:**
- Consome: os services de `@/lib/api/{produtos,categorias,clientes}`; mock de `fetch`.

- [ ] **Step 1:** Ler os 3 services. Para cada, teste com `fetch` mockado:
  - **produtos:** `list({page,pageSize,search,categoriaId,tipo,disponivel})` monta `?pagina=&tamanho=` + filtros corretos; `mapProduto` traduz `fotoUrl`→`foto`, `tipo` int (0→simples,1→combo) via `toTipo`; `create` envia `fotoUrl` e `tipo` inteiro (`fromTipo`); `update` envia `{id,...}`; `getById` mapeia; list traduz paginação (`itens`→`items`).
  - **categorias:** `list` com `apenasAtivas`/`search`; `mapCategoria` defaults; `create`/`update`/`remove` métodos e body certos.
  - **clientes:** `create` envia `endereco` (via `toEnderecoInput`: `uf`→`estado`, cep só dígitos); `update` NÃO envia endereco; `mapCliente` lê endereco aninhado; `count` lê `totalRegistros`.
- [ ] **Step 2:** `npm test` → verdes.
- [ ] **Step 3:** Commit.

```bash
git add tests/unit/produtos-service.test.ts tests/unit/categorias-service.test.ts tests/unit/clientes-service.test.ts
git commit -m "test(unit): services de produtos, categorias e clientes"
```

---

### Task 2: Unitários de carrinho e pedidos

**Files:**
- Create: `tests/unit/carrinho-service.test.ts`, `tests/unit/pedidos-service.test.ts`

**Interfaces:**
- Consome: `@/lib/api/carrinho` (`cartService`), `@/lib/api/pedidos` (`pedidosService`); mock de `fetch`.

- [ ] **Step 1 (carrinho):** `cartService.getRemote()` mapeia `res.itens` via `mapItem` (produtoId de `raw.produtoId` ou `raw.produto.id`; defaults); `add` faz `POST /carrinho/itens {produtoId,quantidade}` e rebusca; `setQtyRemote(id,0)` faz DELETE, `>0` faz PATCH `{quantidade}`; `removeRemote` DELETE; `clearRemote` DELETE `/carrinho`; `checkout` faz `POST /pedidos/checkout {clienteNome}` e depois `getById` (mockar as duas respostas). `total(items)` soma preço*qtd.
- [ ] **Step 2 (pedidos):** `normalizeEtapa` (testar: "pagamentoaprovado"→"pagamento_aprovado", "criado", valor desconhecido→"criado"); `mapPedido` (timeline vazia gera 1 evento de statusAtual; timeline presente preserva; `statusAtual` divergente anexa evento); `listAll`/`listByUser` leem `res.itens`; `getById` mapeia e retorna null em erro; `concluirPagamentoCliente` lança se status != "aprovada" e faz `POST /pedidos/{id}/pagamento/concluir {transacaoId}` quando aprovada. (Não testar `avancar` em profundidade — depende de pedido-flow e pagamentos; cobrir que lança quando pedido não existe é suficiente.)
- [ ] **Step 3:** `npm test` → verdes.
- [ ] **Step 4:** Commit.

```bash
git add tests/unit/carrinho-service.test.ts tests/unit/pedidos-service.test.ts
git commit -m "test(unit): services de carrinho e pedidos (mapeamento, normalizeEtapa, checkout)"
```

---

### Task 3: Unitários de pagamentos, enderecos, vendas

**Files:**
- Create: `tests/unit/pagamentos-service.test.ts`, `tests/unit/enderecos-service.test.ts`, `tests/unit/vendas-service.test.ts`

**Interfaces:**
- Consome: `@/lib/api/{pagamentos,enderecos,vendas}`; mock de `fetch`; mock de `localStorage` (happy-dom provê).

- [ ] **Step 1 (pagamentos):** focar nas normalizações exportáveis. Se `normalizeMetodo`/`normalizeStatus` não forem exportadas, **Ruling:** exportá-las (sem alterar comportamento) para testar — são lógica de risco com muitos ramos. Testar: `normalizeMetodo` (0→cartao_debito, 1→cartao_credito, 2→pix, "cartaocredito"→cartao_credito, "cartao_credito"→cartao_credito, desconhecido→pix); `normalizeStatus` (int e strings incl. "pendente"→aguardando_pagamento, "aprovado"→aprovada). Se houver um método REST não-mock (`iniciar`/`status` etc.) acessível sem o mock interno, cobrir um com fetch mockado; senão, focar nas normalizações.
- [ ] **Step 2 (enderecos):** `consultarCep` — mockar `fetch` do viacep: cep inválido (≠8 dígitos) lança; resposta com `erro:true` lança; resposta ok mapeia `localidade`→`cidade`, `uf`. `enderecosService.save`/`listByCliente`/`remove` no caminho API: mockar `apiRequest` via `fetch` sucesso (não cair no fallback). `getPrincipal` retorna o `principal` ou o primeiro. (Testar o caminho API; o fallback localStorage pode ser coberto por um caso onde o fetch rejeita e cai no local — opcional.)
- [ ] **Step 3 (vendas):** `list()` mapeia `res.vendas`, `res.items`, e `[]` (os três ramos do `??`); `resumo()` retorna o objeto cru.
- [ ] **Step 4:** `npm test` → verdes. Se exportou normalizações, confirmar `tsc --noEmit`.
- [ ] **Step 5:** Commit.

```bash
git add tests/unit/pagamentos-service.test.ts tests/unit/enderecos-service.test.ts tests/unit/vendas-service.test.ts src/lib/api/pagamentos.ts
git commit -m "test(unit): services de pagamentos, enderecos e vendas (normalizacoes, viacep, shape)"
```

---

## Self-Review

- **Spec coverage (Fase 3):** os 8 services existentes cobertos (T1: produtos/categorias/clientes; T2: carrinho/pedidos; T3: pagamentos/enderecos/vendas). Com os unitários de auth/roles/permissions/usuarios das fases anteriores, fecha a cobertura unitária de TODOS os services.
- **Review Focus:** normalizações (T2 normalizeEtapa, T3 normalizeMetodo/Status); defaults do mapX (todas); query de paginação (T1); enderecos fallback+viacep (T3); vendas shape frouxo (T3).
- **Type consistency:** testes importam os tipos reais dos services; URLs via `API_BASE_URL`. Uma Ruling possível (exportar normalizeMetodo/Status de pagamentos) declarada na T3.
- **Proportion:** o plano aponta o que testar por service (os pontos de risco), não transcreve os testes — o implementador segue o padrão de auth-service.test.ts.
- **Nota:** `avancar` de pedidos e o mock interno de pagamentos têm lógica acoplada a `pedido-flow`/`qrcode`; o plano foca no que dá valor sem reescrever esses módulos (YAGNI) — cobertura profunda deles fica fora do escopo das sementes.
