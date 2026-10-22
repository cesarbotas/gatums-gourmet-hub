# Cadastro de Categorias + Migração de Contrato de Produtos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o CRUD de categorias no admin e migrar o contrato de produtos de `categoria:string` para `categoriaId:number` + `categoriaNome:string`, alinhando o front à API nova.

**Architecture:** Novo serviço `categorias.ts` espelhando o padrão de `produtos.ts` (`apiRequest` + map raw→tipo), expondo `list()` no formato `PaginatedResponse<Categoria>` com paginação client-side ("fake") por baixo e ponto único de troca para server-side futuro. Nova rota de arquivo `/_authenticated/admin/categorias`. Migração do contrato de produtos propaga para os consumidores (catálogo, home, admin de produtos).

**Tech Stack:** TanStack Start/Router (file-based routes), React 19, TypeScript, Vite, shadcn/ui, sonner (toast), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-22-cadastro-categorias-design.md`

## Global Constraints

- Node 22 + npm 11 no ambiente de build (via Docker; não há node/npm nativo nesta máquina).
- Projeto NÃO tem framework de testes unitários. Verificação = `npm run build` + typecheck (`tsc`) + `eslint` nos arquivos tocados + smoke test HTTP contra a API local (`http://localhost:5166/api/v1`, admin `admin@gatums.com`/`Admin@123`) + validação visual do usuário. Não introduzir framework de testes (YAGNI / fora de escopo).
- `GET /categorias` retorna array direto `{ id:number, nome:string, descricao:string|null, ativo:boolean }` (confirmado contra API local). Paginação da API é trabalho paralelo no backend.
- Contrato futuro de paginação (quando a API suportar): `GET /categorias?page=&pageSize=&apenasAtivas=` → `PaginatedResponse<CategoriaResponse>`.
- Enums/ids: `categoriaId` é number (long). Body de produto envia `categoriaId` (number).
- Rotas são file-based: o arquivo em `src/routes/_authenticated/admin/categorias.tsx` define a URL `/admin/categorias`.

## Review Focus

- **Produto sem categoria selecionada no form admin:** o submit deve bloquear com toast ("Selecione uma categoria."), não enviar `categoriaId: 0`. (Task 4)
- **Excluir categoria com produtos vinculados:** a API retorna erro de negócio; a tela deve exibir a `message` da `ApiError` no toast e não remover da lista. (Task 2)
- **Nome de categoria duplicado no criar/editar:** a API retorna erro; exibir `message` no toast e manter o form aberto. (Task 2)
- **`GET /categorias` já traz ~55 itens:** a paginação client-side deve fatiar corretamente (total real, páginas corretas, `search` local filtra antes de paginar). (Task 2)
- **Produto cujo `categoriaId` não está na lista de ativas:** o select do form deve ainda refletir a categoria atual ao editar (não apagar silenciosamente). (Task 4)

---

## Task 1: Serviço de API de categorias

**Files:**
- Create: `src/lib/api/categorias.ts`
- Modify: `src/lib/api/index.ts` (adicionar `export * from "./categorias"`)

**Interfaces:**
- Consumes: `apiRequest` de `./client`; `PaginatedResponse<T>` de `./config`.
- Produces:
  - `interface Categoria { id: number; nome: string; descricao: string | null; ativo: boolean }`
  - `categoriasService.list(params?: { page?: number; pageSize?: number; apenasAtivas?: boolean; search?: string }): Promise<PaginatedResponse<Categoria>>`
  - `categoriasService.getById(id: number): Promise<Categoria | null>`
  - `categoriasService.create(input: { nome: string; descricao?: string | null; ativo?: boolean }): Promise<{ id: number }>`
  - `categoriasService.update(id: number, input: { nome: string; descricao?: string | null; ativo: boolean }): Promise<void>`
  - `categoriasService.remove(id: number): Promise<void>`

- [ ] **Step 1: Criar `src/lib/api/categorias.ts`**

Implementar `Categoria` e `categoriasService` com as assinaturas acima, seguindo o estilo de `produtos.ts` (função `mapCategoria(raw): Categoria`; `apiRequest<any>`).
- `list`: `GET /categorias` com query `apenasAtivas` quando definido. Recebe o array, aplica `search` local (filtro case-insensitive em `nome`), e pagina client-side montando `{ items, total, page, pageSize }` (defaults page=1, pageSize=10). Marcar com comentário `// TODO[API-pagination]: quando /categorias aceitar page/pageSize, trocar fatiamento local por query server-side e repassar PaginatedResponse da API`.
- `create`: `POST /categorias` body `{ nome, descricao, ativo }`, retorna `{ id }`.
- `update`: `PUT /categorias/{id}` body `{ id, nome, descricao, ativo }`, resolve `void`.
- `remove`: `DELETE /categorias/{id}`, resolve `void`.
- `getById`: `GET /categorias/{id}`, try/catch → `null` em erro (padrão do `produtos.getById`).

- [ ] **Step 2: Exportar em `src/lib/api/index.ts`**

Adicionar `export * from "./categorias";` junto aos demais exports.

- [ ] **Step 3: Verificar typecheck**

Run (Docker): `docker run --rm -v "${PWD}:/app" -w /app node:22-alpine sh -c "cp -a /app /tmp/b && cd /tmp/b && npm i -g npm@11 >/dev/null 2>&1 && npm ci >/dev/null 2>&1 && npx tsc --noEmit"`
Expected: sem erros.

- [ ] **Step 4: Smoke test HTTP contra a API local**

Login admin e `GET /categorias`; confirmar formato array + campos. (GET já validado nesta sessão; reconfirmar após o serviço existir não é necessário — o serviço não é chamado por HTTP neste passo. Pular se a API não estiver no ar.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/categorias.ts src/lib/api/index.ts
git commit -m "feat(categorias): serviço de API com paginação client-side"
```

---

## Task 2: Tela admin de categorias + item no menu

**Files:**
- Create: `src/routes/_authenticated/admin/categorias.tsx`
- Modify: `src/routes/_authenticated/admin.tsx` (menu `adminLinks` + import do ícone `Tags`)

**Interfaces:**
- Consumes: `categoriasService`, `Categoria`, `PAGE_SIZE_OPTIONS` de `@/lib/api`; componentes shadcn (`Button`, `Input`, `Label`, `Textarea`, `Switch`, `Select*`); `toast` de sonner; ícones lucide (`Plus`, `Pencil`, `Trash2`, `ChevronLeft`, `ChevronRight`, `X`, `Tags`).
- Produces: rota `/_authenticated/admin/categorias` (componente `AdminCategoriasPage`).

- [ ] **Step 1: Criar `categorias.tsx`**

Espelhar a estrutura de `admin/produtos.tsx`: estado `items/total/page/pageSize/view/editing/form/saving`; `load()` chamando `categoriasService.list({ page, pageSize })`; `useEffect(load, [page, pageSize])`. Tabela com colunas Nome, Descrição, Status (badge Ativo/Inativo), Ações (editar/excluir). Form inline (toggle list/form) com `Input` Nome (required), `Textarea` Descrição, `Switch` Ativo. Reusar o componente `Pagination` (copiar o mesmo padrão local do arquivo de produtos). `empty = { nome: "", descricao: "", ativo: true }`.
- `submit`: se editing → `update(editing.id, form)`, senão `create(form)`; `toast.success`; em `catch`, `toast.error(err.message)` e mantém o form aberto (Review Focus: nome duplicado).
- `remove`: `confirm(...)` → `categoriasService.remove(id)`; em `catch`, `toast.error(err.message)` (Review Focus: vínculo com produtos) e NÃO recarrega como sucesso.

- [ ] **Step 2: Adicionar item no menu**

Em `admin.tsx`: importar `Tags` de `lucide-react`; adicionar `{ to: "/admin/categorias", label: "Categorias", icon: Tags }` em `adminLinks`, após o item Produtos.

- [ ] **Step 3: Verificar build + typecheck + lint**

Run (Docker): `... npm ci && npm run build && npx tsc --noEmit && npx eslint src/routes/_authenticated/admin/categorias.tsx src/routes/_authenticated/admin.tsx`
Expected: build OK, sem erros de tipo/lint. (A geração do route tree do TanStack reconhece o novo arquivo no build.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/admin/categorias.tsx src/routes/_authenticated/admin.tsx
git commit -m "feat(categorias): tela de admin CRUD + item no menu"
```

---

## Task 3: Migração do contrato em `produtos.ts`

**Files:**
- Modify: `src/lib/api/produtos.ts`

**Interfaces:**
- Consumes: `apiRequest`, `PaginatedResponse`.
- Produces (mudanças no tipo `Produto` e `produtosService`):
  - `Produto`: remover `categoria: string`; adicionar `categoriaId: number` e `categoriaNome: string`.
  - `produtosService.list(params)`: `params.categoriaId?: number` (remove `params.categoria`).
  - Remover `CATEGORIAS`, `type Categoria` e `produtosService.categorias()`.

- [ ] **Step 1: Atualizar tipos e mapeamento**

- `Produto`: trocar `categoria: string` por `categoriaId: number;` e `categoriaNome: string;`.
- `mapProduto`: `categoriaId: raw.categoriaId ?? 0`, `categoriaNome: raw.categoriaNome ?? ""`.
- Remover `export const CATEGORIAS`, `export type Categoria` e o método `categorias()`.

- [ ] **Step 2: Atualizar list/create/update**

- `list`: param `categoriaId?: number`; no querystring, `if (typeof params.categoriaId === "number") qs.set("categoriaId", String(params.categoriaId))`. Remover o `?categoria=`.
- `create`/`update`: no body, trocar `categoria: input.categoria` por `categoriaId: input.categoriaId`.
- `empty`/consumidores são tratados nas Tasks 4/5.

- [ ] **Step 3: Verificar typecheck (vai apontar os consumidores quebrados)**

Run (Docker): `... npx tsc --noEmit`
Expected: FALHA apenas nos consumidores que ainda usam `categoria` (catalogo.tsx, index.tsx, admin/produtos.tsx) — confirma o alcance da migração. Os erros de `produtos.ts` em si devem estar zerados.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/produtos.ts
git commit -m "feat(produtos): migrar contrato categoria->categoriaId/categoriaNome"
```

---

## Task 4: Admin de produtos usando categorias reais

**Files:**
- Modify: `src/routes/_authenticated/admin/produtos.tsx`

**Interfaces:**
- Consumes: `categoriasService`, `Categoria` (Task 1); `Produto` migrado (Task 3).

- [ ] **Step 1: Carregar categorias reais e ajustar o form**

- Trocar `const [categorias, setCategorias] = useState<string[]>([])` por `useState<Categoria[]>([])`.
- `useEffect`: `categoriasService.list({ apenasAtivas: true, pageSize: 500 }).then((r) => setCategorias(r.items))`.
- `empty`: trocar `categoria: ""` por `categoriaId: 0`.
- Select de categoria: `value={String(form.categoriaId)}`, `onValueChange={(v) => setForm({ ...form, categoriaId: Number(v) })}`, opções `categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)`.
- Coluna da tabela: mostrar `p.categoriaNome`.

- [ ] **Step 2: Validação de categoria no submit (Review Focus)**

No início do `submit`, após a checagem de combo: `if (!form.categoriaId) { toast.error("Selecione uma categoria."); return; }`.

- [ ] **Step 3: Preservar categoria ao editar (Review Focus)**

Garantir que `startEdit` mantém `categoriaId` do produto (vem do spread de `rest`). Se a categoria do produto não estiver entre as ativas, o `Select` ainda mostra o id atual — aceitável; não apagar.

- [ ] **Step 4: Verificar build + typecheck + lint**

Run (Docker): `... npm run build && npx tsc --noEmit && npx eslint src/routes/_authenticated/admin/produtos.tsx`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/admin/produtos.tsx
git commit -m "feat(produtos): admin usa categorias reais via categoriaId"
```

---

## Task 5: Catálogo e home exibindo categoria por entidade

**Files:**
- Modify: `src/routes/catalogo.tsx`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `categoriasService`, `Categoria` (Task 1); `Produto` migrado (Task 3).

- [ ] **Step 1: catalogo.tsx — filtro por categoria real**

- `categorias` state: `Categoria[]` (era `string[]`); carregar via `categoriasService.list({ apenasAtivas: true, pageSize: 500 }).then((r) => setCategorias(r.items))` (remover `produtosService.categorias()`).
- Estado do filtro: `categoriaId: number | "Todas"` (ou manter "Todas" + number). Filtro: `if (categoria !== "Todas" && p.categoriaId !== categoria) return false`.
- Select: value por id; options `categorias.map(c => <SelectItem value={String(c.id)}>{c.nome}</SelectItem>)`; "Todas as categorias" = sentinel.
- Busca textual: trocar `p.categoria.toLowerCase()` por `p.categoriaNome.toLowerCase()`.
- Card: exibir `p.categoriaNome`.

- [ ] **Step 2: index.tsx — exibir categoriaNome**

Trocar `{p.categoria}` por `{p.categoriaNome}`.

- [ ] **Step 3: Verificar build + typecheck + lint (projeto inteiro limpo)**

Run (Docker): `... npm run build && npx tsc --noEmit && npx eslint src`
Expected: build OK, zero erros de tipo/lint em todo o projeto (nenhum uso remanescente de `categoria`/`CATEGORIAS`/`produtosService.categorias`).

- [ ] **Step 4: Commit**

```bash
git add src/routes/catalogo.tsx src/routes/index.tsx
git commit -m "feat(catalogo): filtro e exibição por categoria (entidade)"
```

---

## Task 6: Verificação integrada contra a API local

**Files:** nenhum (verificação).

- [ ] **Step 1: Smoke test HTTP do CRUD de categorias**

Com a API local no ar: login admin; `POST /categorias` (nome único); `GET /categorias` (confirma presença); `PUT /categorias/{id}`; `DELETE /categorias/{id}`. Confirmar status 200/201 e mensagens de erro esperadas (nome duplicado, delete com vínculo). Usar arquivos de body temporários para evitar problemas de aspas no shell; limpar depois.

- [ ] **Step 2: Subir dev server apontando para a API local**

Via gerenciador de processos (background), bun, `VITE_API_BASE_URL=http://localhost:5166/api/v1`. Confirmar que compila e serve (ler saída do processo). Passar a URL local ao usuário para validação visual.

- [ ] **Step 3: Validação visual do usuário**

Usuário valida no navegador: `/admin/categorias` (criar/editar/excluir), `/admin/produtos` (select de categoria + coluna), `/catalogo` (filtro + exibição). Aguardar confirmação.

- [ ] **Step 4: Limpeza**

Parar o dev server; remover arquivos temporários de teste; `git checkout -- bun.lock` se tocado.
