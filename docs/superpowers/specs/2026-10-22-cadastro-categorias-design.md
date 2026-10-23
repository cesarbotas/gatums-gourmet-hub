# Cadastro de Categorias + Migração de Contrato de Produtos — Design

Data: 2026-10-22
Status: aprovado em brainstorming, aguardando revisão do spec

## 1. Objetivo e escopo

Alinhar o front à API nova (categoria virou entidade própria com `id` numérico)
e adicionar o CRUD de categorias no painel admin.

Contrato confirmado contra a API local (`http://localhost:5166/api/v1`):
`GET /categorias` retorna **array direto** de `{ id:number, nome:string,
descricao:string|null, ativo:boolean }` (não paginado).

### Entregas
1. Serviço `src/lib/api/categorias.ts` — CRUD completo.
2. Tela admin `/admin/categorias` — listar (com paginação), criar, editar, excluir.
3. Item "Categorias" no menu lateral do admin.
4. Migração do contrato de produtos: `categoria:string` -> `categoriaId:number`
   + `categoriaNome:string`.

### Fora de escopo (trabalhos futuros, separados)
- Reorganização de pastas por fluxo.
- Deploy na Vercel (pausado).
- Paginação server-side real de `/categorias` (feita na API em paralelo).

## 2. Serviço de categorias (`src/lib/api/categorias.ts`)

```ts
export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}
```

Métodos (seguindo o padrão de `produtos.ts` — `apiRequest`, map raw->tipo):

- `list(params?: { page?; pageSize?; apenasAtivas?; search? }): Promise<PaginatedResponse<Categoria>>`
- `getById(id: number): Promise<Categoria | null>`
- `create(input: { nome; descricao?; ativo? }): Promise<{ id: number }>`
- `update(id: number, input: { nome; descricao?; ativo }): Promise<void>`
- `remove(id: number): Promise<void>`

### Paginação em transição (fake agora, real depois)
`list()` devolve `PaginatedResponse<Categoria>` — o MESMO formato de `/produtos`,
para a tela não precisar mudar quando a API passar a paginar.

- **Agora:** busca o array completo de `GET /categorias?apenasAtivas=` e aplica
  paginação client-side (fatiamento + filtro `search` local), montando
  `{ items, total, page, pageSize }`.
- **Depois (API pronta):** trocar o fatiamento local por
  `GET /categorias?page=&pageSize=&apenasAtivas=` repassando o
  `PaginatedResponse` da API. Ponto único de troca, marcado com
  `// TODO[API-pagination]`. A tela não muda.

Contrato futuro combinado (espelha `/produtos`):
`GET /categorias?page=1&pageSize=10&apenasAtivas=true` ->
`PaginatedResponse<CategoriaResponse>`.

### Erros
`client.ts` já extrai `detail/message` em `ApiError`. A tela mostra
`toast.error(err.message)`. Casos tratados pela API:
- nome duplicado (`"Já existe uma categoria com este nome."`)
- delete com vínculo (`"Não é possível excluir: categoria possui produtos vinculados."`)
- não encontrada.

Export em `src/lib/api/index.ts`: `export * from "./categorias"`.

## 3. Tela admin `/admin/categorias`

Arquivo `src/routes/_authenticated/admin/categorias.tsx`, espelhando o padrão de
`admin/produtos.tsx`:
- Tabela: Nome, Descrição, Status (Ativo/Inativo), Ações.
- Paginação (mesmo componente/UX de produtos; opera sobre o `PaginatedResponse`).
- Form inline (toggle list/form): campos Nome (obrigatório), Descrição, Switch Ativo.
- Criar / Editar / Excluir com `toast` de sucesso/erro.
- Delete pede confirmação; erro de vínculo aparece no toast.

Menu admin (`src/routes/_authenticated/admin.tsx`): adicionar
`{ to: "/admin/categorias", label: "Categorias", icon: Tags }` após Produtos.

## 4. Migração do contrato de produtos

`src/lib/api/produtos.ts`:
- `Produto`: remover `categoria:string`; adicionar `categoriaId:number` e
  `categoriaNome:string` (read-only, vem da API).
- `mapProduto`: ler `categoriaId` e `categoriaNome`.
- `create`/`update`: enviar `categoriaId` (number) no body.
- `list`: filtro `?categoriaId=` (era `?categoria=`).
- Remover `CATEGORIAS` hardcoded e o método `categorias()` (batia no
  `/produtos/categorias`, endpoint REMOVIDO).

Consumidores:
- `src/routes/_authenticated/admin/produtos.tsx`: select de categoria carrega de
  `categoriasService.list({ apenasAtivas: true })`, grava `categoriaId`; coluna
  da tabela mostra `categoriaNome`; `empty` usa `categoriaId: 0`.
- `src/routes/catalogo.tsx`: filtro carrega categorias reais, filtra por
  `categoriaId`; exibe `categoriaNome`.
- `src/routes/index.tsx`: exibe `categoriaNome`.

## 5. Verificação

Com a API local rodando em `http://localhost:5166` (confirmada no ar; seed admin
`admin@gatums.com`/`Admin@123`):

Automatizável (eu):
- `npm run build` (Node 22 + npm 11, Docker) + typecheck + eslint nos arquivos tocados.
- Dev server via bun apontando `VITE_API_BASE_URL=http://localhost:5166/api/v1`,
  confirmar compila/serve.
- Smoke test HTTP contra a API local: login admin + `GET/POST/PUT/DELETE
  /categorias` confirmando o contrato (GET já validado: array direto, campos ok).

Usuário (você):
- Validação visual no navegador em `/admin/categorias` (criar/editar/excluir) e
  no catálogo/admin de produtos (filtro e select por categoria).

## 6. Riscos

- Trocar `categoria`->`categoriaId` quebra tipos em todos os consumidores;
  mitigação: typecheck obrigatório caça todos antes de concluir.
- `empty.categoriaId` precisa de um valor inicial sem categoria (0) + validação
  no submit para exigir categoria escolhida.
