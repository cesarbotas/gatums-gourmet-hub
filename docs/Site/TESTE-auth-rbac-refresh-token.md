# Referência de Testes — Autenticação RBAC + Refresh Token

Guia para validar a migração de autenticação do front `gatums-gourmet-hub`
rodando junto da API (os dois projetos na mesma rede local). Cobre as variáveis
de ambiente, os endpoints, o que inspecionar no `localStorage`, e um roteiro de
testes manuais dos pontos críticos.

> Branch: `feature/auth-rbac-refresh-token`. Spec:
> `docs/superpowers/specs/2026-10-23-auth-rbac-refresh-token-design.md`.

---

## 1. Variáveis de ambiente

O front compõe a base da API como `${VITE_API_BASE_URL}/api/${VITE_API_VERSION}`
(ver `src/lib/api/config.ts`). **`VITE_API_BASE_URL` é a raiz SEM a versão** — não
inclua `/api/v1`.

> As variáveis `VITE_*` são embutidas no bundle em **build time**. Ao mudar o
> `.env`, **reinicie o `npm run dev`** (ou refaça o build) — não basta recarregar
> a página.

### Front na mesma máquina da API

| Variável | Valor |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:<porta-da-API>` |
| `VITE_API_VERSION` | `v1` |

### Front e API em máquinas diferentes (teste cross-máquina)

Em `.env.development`, aponte para o IP da máquina onde a API roda:

| Variável | Valor | Observação |
|---|---|---|
| `VITE_API_BASE_URL` | `http://<IP-da-maquina-da-API>:<porta>` | ex.: `http://192.168.0.10:8080` |
| `VITE_API_VERSION` | `v1` | anexado automaticamente como `/api/v1` |

Exemplo de `.env.development`:

```
VITE_API_BASE_URL=http://192.168.0.10:8080
VITE_API_VERSION=v1
```

Base efetiva resultante: `http://192.168.0.10:8080/api/v1`.

### Pré-requisitos do lado da API (cross-máquina)

- API escutando em `0.0.0.0` (não só `localhost`), para aceitar conexões da rede.
- Porta liberada no **firewall** da máquina da API.
- **CORS** permitindo a origem do front (ex.: `http://192.168.0.11:3000`). Se o
  navegador bloquear com erro de CORS, é sinal de priorizar a configuração de CORS
  por ambiente (Fase 2 — ver `docs/Auth/Guia-de-Uso.md`).
- Descobrir o IP local da máquina da API: `ipconfig` (Windows) / `ip addr` (Linux).

---

## 2. Endpoints de auth

Base: `${VITE_API_BASE_URL}/api/${VITE_API_VERSION}` (ex.: `/api/v1`).

| Método | Caminho | Body | Auth | Retorno |
|---|---|---|---|---|
| POST | `/auth/login` | `{ email, senha }` | — | `{ accessToken, refreshToken, expiresIn, user }` |
| POST | `/auth/register` | `{ nome, email, senha, telefone? }` | — | 201 (cria Cliente; sem token) |
| POST | `/auth/refresh` | `{ refreshToken }` | — | mesmo shape do login (rotação) |
| POST | `/auth/logout` | `{ refreshToken }` | Bearer | revoga a sessão |
| GET | `/auth/me` | — | Bearer | `{ id, nome, email, roles: [] }` |

`user` = `{ id, nome, email, roles: string[] }`. Papéis em **PascalCase**:
`"Admin"`, `"Cliente"`, `"Gerente"`.

---

## 3. O que o front guarda (localStorage)

Chave única: **`gg.session`**. Shape:

```json
{
  "accessToken": "<jwt 15 min>",
  "refreshToken": "<token 7 dias>",
  "user": { "id": "...", "nome": "...", "email": "...", "roles": ["Admin"] }
}
```

Para inspecionar: DevTools → Application → Local Storage → chave `gg.session`.

- O header `Authorization: Bearer <accessToken>` é injetado em toda requisição por
  `src/lib/api/apiRequest` (`client.ts`).
- No **401**, o front tenta `POST /auth/refresh` uma vez e repete a requisição; só
  desloga (limpa `gg.session` + redireciona `/login`) se o refresh falhar.

---

## 4. Roteiro de testes manuais

> Antes de tudo: suba a API, ajuste o `.env.development`, **reinicie o `npm run dev`**,
> e abra o DevTools (abas Network e Application/Local Storage).

### 4.1. Login — Cliente

- [ ] Logar com um usuário de `roles: ["Cliente"]`.
- [ ] **Esperado:** redireciona para `/minha-conta`.
- [ ] `gg.session` contém `accessToken`, `refreshToken` e `user.roles` com `"Cliente"`.
- [ ] A Navigation NÃO mostra o link de Administração.

### 4.2. Login — Admin e Gerente

- [ ] Logar com `roles: ["Admin"]`.
- [ ] **Esperado:** redireciona para `/admin`; área administrativa acessível.
- [ ] Repetir com `roles: ["Gerente"]` → **também** deve ir para `/admin` e acessar a gestão.
- [ ] (Negativo) Com `roles: ["Cliente"]`, acessar `/admin` manualmente pela URL deve
      redirecionar para `/` (guard de rota).

### 4.3. Refresh automático do access token (ponto crítico)

O access token dura ~15 min. Para validar sem esperar:

- [ ] Logar normalmente.
- [ ] Em DevTools → Application → Local Storage, editar `gg.session` e **corromper só
      o `accessToken`** (troque alguns caracteres), mantendo o `refreshToken` válido.
- [ ] Navegar para uma tela que chama a API (ex.: catálogo, pedidos, `/admin`).
- [ ] **Esperado:** na aba Network aparece a requisição → `401` → `POST /auth/refresh`
      (`200`) → a requisição original é **repetida** e tem sucesso. O usuário **NÃO** é
      deslogado. O `gg.session` passa a ter um `accessToken` novo.

### 4.4. Refresh concorrente (single-flight)

- [ ] Com o `accessToken` corrompido (como em 4.3), abrir uma tela que dispara **várias**
      chamadas à API ao mesmo tempo (ex.: um dashboard/admin com múltiplos fetchs).
- [ ] **Esperado:** na aba Network há **apenas UM** `POST /auth/refresh`, e todas as
      chamadas que receberam 401 são repetidas depois dele. (Não deve haver vários
      refresh em paralelo.)

### 4.5. Refresh expirado / revogado → logout

- [ ] Em `gg.session`, corromper **também** o `refreshToken` (ou usar um já revogado).
- [ ] Disparar uma chamada à API.
- [ ] **Esperado:** `401` → `/auth/refresh` falha → `gg.session` é limpo → redireciona
      para `/login`. Sem loop de requisições.

### 4.6. Logout

- [ ] Logado, clicar em Sair (Navigation) ou em Minha Conta.
- [ ] **Esperado:** dispara `POST /auth/logout` com `{ refreshToken }` (ver Network),
      `gg.session` é removido do localStorage, e o usuário volta para a home.
- [ ] (Confirmação de revogação) Tentar usar o `refreshToken` antigo em um `POST
      /auth/refresh` manual (via DevTools/console ou outra ferramenta) deve falhar.

### 4.7. Anti-loop nos endpoints de auth

- [ ] Fazer login com **senha errada**.
- [ ] **Esperado:** `POST /auth/login` retorna `401` e a tela mostra "Credenciais
      inválidas" (toast de erro). **NÃO** deve haver tentativa de `/auth/refresh` a
      partir desse 401 (o login é um 401 terminal).

### 4.8. Registro

- [ ] Criar conta em `/register` (`nome`, `email`, `senha`, `telefone?`).
- [ ] **Esperado:** cria o Cliente (`201`) e em seguida faz login automático,
      redirecionando para `/minha-conta`; `gg.session` populado.

### 4.9. Sessão do esquema antigo (pós-deploy)

- [ ] Simular sessão antiga: em `gg.session`, gravar manualmente `{ "token": "x",
      "user": { "role": "admin" } }` (formato velho) e recarregar.
- [ ] **Esperado:** o front não quebra; como não há `accessToken`, a primeira chamada
      protegida resulta em 401 sem refresh válido → vai para `/login`. Depois de
      **relogar**, tudo volta ao normal.

---

## 5. Checklist rápido de aprovação

- [ ] Login roteia por papel (Cliente→conta; Admin/Gerente→admin).
- [ ] `gg.session` guarda `accessToken` + `refreshToken` + `user.roles`.
- [ ] 401 renova o token e repete a requisição sem deslogar (4.3).
- [ ] Só um `/auth/refresh` sob concorrência (4.4).
- [ ] Refresh inválido desloga para `/login` sem loop (4.5).
- [ ] Logout revoga a sessão na API (4.6).
- [ ] Login com senha errada não dispara refresh (4.7).
- [ ] CORS liberado para a origem do front (cross-máquina).

---

## 6. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Toda chamada dá erro de CORS | API não libera a origem do front | Configurar CORS na API (Fase 2) |
| `Failed to fetch` / timeout | IP/porta errados, firewall, API não escuta em `0.0.0.0` | Conferir `VITE_API_BASE_URL`, firewall e bind da API |
| Mudei o `.env` e nada mudou | `VITE_*` é build-time | Reiniciar `npm run dev` |
| Deslogado logo após login | `accessToken`/`refreshToken` não vieram no login, ou refresh falhando | Conferir shape da resposta de `/auth/login` e `/auth/refresh` |
| Loop de requisições no 401 | refresh devolvendo 401 e sendo retentado | Confirmar que `/auth/refresh` e `/auth/login` estão fora do retry (já tratado no front) |
| Base da API com `/api/v1` duplicado | `VITE_API_BASE_URL` incluiu a versão | Deixar só a raiz; a versão é anexada por `config.ts` |
