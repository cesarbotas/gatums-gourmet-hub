# Guia de Integração do Front — o que mudou na API

Documento consolidado para o time de front (site **gatums-gourmet-hub**, React +
TanStack + Vite). Reúne, num lugar só, tudo o que mudou na API nas últimas
entregas e o que o front precisa ajustar. Cada seção aponta para o guia detalhado
quando existe.

> **Leitura rápida:** se você só vai atualizar o front agora, vá direto para o
> [Checklist de migração](#checklist-de-migracao) no fim.

---

## Visão geral (estado atual)

| Item | Valor |
|------|-------|
| **Base URL** | `http://localhost:5166/api/v1` (dev) · HML/PRD conforme deploy |
| **Versionamento** | Todas as rotas sob **`/api/v1`** |
| **Autenticação** | JWT Bearer — **access token (15 min) + refresh token (7 dias)** |
| **Autorização** | Por **permissão** (RBAC); `user.roles` é um **array** |
| **JSON casing** | camelCase |
| **Paginação** | Envelope em português (`itens`, `paginaAtual`, ...) |
| **Erros** | `ProblemDetails` (`{ detail, status }`) |
| **CORS** | Restrito por ambiente (dev libera tudo; HML/PRD restringem) |

As mudanças recentes, em ordem:
1. [Versionamento das rotas (`/api/v1`)](#1-versionamento-das-rotas)
2. [Autenticação RBAC + refresh token](#2-autenticacao-rbac--refresh-token)
3. [Paginação (envelope em português)](#3-paginacao)
4. [Busca de endereço por CEP](#4-busca-de-cep)
5. [Upload de imagens de produto](#5-upload-de-imagens)
6. [CORS por ambiente](#6-cors-por-ambiente)
7. [Padrão de erros](#7-padrao-de-erros)

> **Estado no front (gatums-gourmet-hub):** auth RBAC + refresh, paginação,
> busca de CEP e padrão de erros já estão implementados (ver
> `docs/superpowers/specs/`). O **upload de imagens** é a feature desta branch.

---

## 1. Versionamento das rotas

Todas as rotas agora vivem sob o prefixo **`/api/v1`**. Se o seu
`VITE_API_BASE_URL` já termina em `/api/v1`, nada muda nos caminhos relativos
(`/produtos`, `/auth/login`, etc.).

```env
VITE_API_BASE_URL=http://localhost:5166/api/v1
```

Referência completa dos endpoints: `API-Reference.md`.

---

## 2. Autenticação RBAC + refresh token

**A maior mudança.** O login deixou de devolver um token único de 8h. Agora é um
par **access token (15 min)** + **refresh token (7 dias)**, e a autorização é por
permissão.

Resumo do contrato:

| O que | Antes | Agora |
|------|-------|-------|
| Login response | `{ token, user: { role } }` | `{ accessToken, refreshToken, expiresIn, user: { id, nome, email, roles: [] } }` |
| Campo do token | `token` | `accessToken` |
| Papel do usuário | `user.role` (string) | `user.roles` (array, **PascalCase**: `"Admin"`, `"Cliente"`, `"Gerente"`) |
| Renovação | não existia | `POST /auth/refresh` com `{ refreshToken }` (rotaciona: o refresh antigo é invalidado) |
| Logout | no-op | `POST /auth/logout` com `{ refreshToken }` (revoga a sessão) |
| Encerrar tudo | não existia | `POST /auth/logout-all` |

Endpoints:
- `POST /auth/login` → `{ email, senha }`
- `POST /auth/register` → `{ nome, email, senha, telefone? }` (sempre cria **Cliente**)
- `POST /auth/refresh` → `{ refreshToken }` → mesmo shape do login
- `POST /auth/logout` (Bearer) → `{ refreshToken }`
- `POST /auth/logout-all` (Bearer)
- `GET /auth/me` (Bearer) → `{ id, nome, email, roles: [] }`

O que o front precisa fazer:
- Ler `accessToken` (não mais `token`) e guardar também o `refreshToken`.
- Interceptor: no **401**, chamar `/auth/refresh` uma vez e repetir a requisição; se o refresh falhar, limpar tokens e mandar para o login.
- Trocar `user.role === "admin"` por `user.roles?.includes("Admin")` (atenção ao PascalCase).
- Após o deploy desta versão, **relogar** (tokens antigos não valem).

> No gatums-gourmet-hub isto já está implementado em `src/lib/api/client.ts`
> (refresh automático no 401), `src/lib/api/auth.ts` e `src/lib/auth-context.tsx`
> (`isAdmin` via `roles`, cobrindo `Admin` e `Gerente`). Spec:
> `docs/superpowers/specs/2026-10-23-auth-rbac-refresh-token-design.md`.

---

## 3. Paginação

As listagens (`GET /produtos`, `/categorias`, `/clientes`, `/pedidos`) aceitam os
query params `pagina` e `tamanho` — **ambos opcionais** (default `pagina=1`,
`tamanho=10`). Chamar sem eles é válido:

```
GET /api/v1/produtos                 → página 1, 10 itens
GET /api/v1/produtos?pagina=2&tamanho=20
```

A resposta é um envelope em **português**:

```json
{
  "itens": [ /* ... */ ],
  "paginaAtual": 1,
  "tamanhoPagina": 10,
  "totalRegistros": 42,
  "totalPaginas": 5,
  "temPaginaAnterior": false,
  "temProximaPagina": true
}
```

```ts
interface PaginatedResponse<T> {
  itens: T[];
  paginaAtual: number;
  tamanhoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  temPaginaAnterior: boolean;
  temProximaPagina: boolean;
}
```

Filtros adicionais por recurso (ex.: `/produtos` aceita `search`, `categoriaId`,
`tipo`, `disponivel`; `/categorias` aceita `apenasAtivas`).

> No front, a adaptação de borda vive em `src/lib/api/config.ts`
> (`appendPageParams`/`mapPaginated`): as telas usam `PaginatedResponse<T>`
> interno (`items`/`total`/`page`/`pageSize`) e os helpers traduzem do/para o
> envelope em português.

---

## 4. Busca de CEP

Endpoint público para autopreencher o formulário de endereço pelo CEP (via
ViaCEP). Read-only.

```
GET /api/v1/enderecos/cep/{cep}
```

- Público (sem Bearer). `{cep}` com ou sem máscara.
- 200 → `{ cep, logradouro, complemento, bairro, cidade, estado }` (`complemento` pode ser `null`; `numero` não vem).
- 400 → CEP inválido / não encontrado / serviço indisponível. Trate como "não foi possível preencher" e deixe o usuário digitar.

> No front já consumido por `consultarCep` em `src/lib/api/enderecos.ts`
> (mapeia `estado`→`uf`), usado pelo `EnderecoForm`.

---

## 5. Upload de imagens

Endpoint **separado** para subir a imagem do produto; o produto grava **apenas a
URL** em `fotoUrl`.

```
POST /api/v1/imagens      (multipart/form-data, campo "arquivo")
```

- Auth: Bearer com a permissão **`produtos:escrever`** (anônimo → 401; sem permissão → 403).
- Tipos: JPEG, PNG, WebP (validados por conteúdo, não pela extensão). Máx 5 MB.
- 201 → `{ "url": "..." }`. Use essa `url` como `fotoUrl` ao criar/atualizar o produto.
- Com `FormData`, **não** defina `Content-Type` manualmente (o browser monta o multipart).

Fluxo: subir a imagem → receber `url` → enviar o `POST /produtos` com `fotoUrl = url`.

---

## 6. CORS por ambiente

O CORS deixou de liberar qualquer origem e passou a ser restrito por ambiente:

| Ambiente | Origens permitidas |
|----------|--------------------|
| Dev local | qualquer origem (conveniência) |
| Homologação (HML) | `https://gatums-gourmet*.vercel.app` (cobre o deploy fixo e os previews) |
| Produção (PRD) | `https://app.gatumsgourmet.com.br` |

O que isso significa para o front:
- Em dev, nada muda.
- Em HML, os deploys da Vercel (`gatums-gourmet-*.vercel.app`) são aceitos automaticamente.
- Em PRD, só o domínio oficial. Se o front for publicado em um domínio novo, a API precisa incluí-lo na config (`Cors:AllowedOrigins` / `Cors:AllowedOriginPatterns`) — avise o time de back.
- A auth é por Bearer (não cookie), então **não** há `credentials: 'include'` nem necessidade de `AllowCredentials`.

---

## 7. Padrão de erros

Erros de negócio e validação retornam **ProblemDetails** (RFC 7807):

```json
{ "detail": "Mensagem legível do erro.", "status": 400 }
```

- **400** — erro de validação/negócio (a mensagem fica em `detail`).
- **401** — sem token ou token expirado/inválido → dispare o refresh; se falhar, mande para o login.
- **403** — autenticado, mas sem a permissão necessária → esconda/bloqueie a ação na UI.
- **500** — erro inesperado (a mensagem clara, quando aplicável, vem em `detail`).

> No front, `src/lib/api/client.ts` já relança os erros como `ApiError` lendo
> `detail`/`message`/`title`, e trata o 401 com refresh automático.

---

<a id="checklist-de-migracao"></a>
## Checklist de migração do front

**Auth (já implementado no gatums-gourmet-hub):**
- [x] Ler `accessToken` (não `token`) e guardar o `refreshToken`.
- [x] Interceptor 401 → `/auth/refresh` → repetir; falhou → login.
- [x] `user.role` (string) → `user.roles` (array, PascalCase).
- [x] Logout chama `POST /auth/logout` com `{ refreshToken }`.
- [ ] Relogar após o deploy (tokens antigos inválidos).

**Listagens (já implementado):**
- [x] Ler o envelope de paginação em português (`itens`, `paginaAtual`, ...).
- [x] `pagina`/`tamanho` são opcionais — pode chamar sem eles.

**Novas features:**
- [x] CEP: autopreenchimento do endereço (`GET /enderecos/cep/{cep}`).
- [ ] Imagem: subir via `POST /imagens` e usar a `url` como `fotoUrl` do produto. **(esta branch)**

**Deploy:**
- [ ] HML na Vercel já é aceito pelo CORS; PRD só no domínio oficial.

---

## Documentos de referência

| Documento | Conteúdo |
|-----------|----------|
| `Migracao-Front-Auth-RBAC.md` | Auth nova com código pronto (tokenStore, interceptor, login/logout) |
| `API-Reference.md` | Todos os endpoints (método, rota, body, auth) |
| `Busca-CEP.md` | Autopreenchimento de endereço por CEP |
| `Upload-Imagens.md` | Upload de imagem de produto |
| `Modelos-de-Dados.md` | DTOs com tipos e exemplos |
| `Erros-e-Padroes.md` | ProblemDetails, enums, convenções |
| `Fluxos-Integracao.md` | Fluxos ponta a ponta (catálogo, carrinho, checkout, admin) |
