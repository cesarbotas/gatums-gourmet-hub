# Design — Proteção de branches via Terraform (GitHub Rulesets)

Data: 2026-10-23
Repositório alvo desta implementação: `gatums-gourmet-hub` (front)
Branch de trabalho: `feature/terraform-github-rulesets`

## Objetivo

Gerenciar, como Infraestrutura como Código (IaC) com Terraform, as regras de
proteção (GitHub **rulesets**) das branches `develop`, `release` e `main` do
repositório `gatums-gourmet-hub`. O state do Terraform fica remoto no **HCP
Terraform** (plano gratuito), permitindo rodar de várias máquinas e do GitHub
Actions. O `apply` é automatizado via Actions (no merge para `main` e via
disparo manual).

Objetivo secundário: servir de material de aprendizado de Terraform para o
dono do repositório (iniciante), priorizando clareza, um módulo reutilizável e
documentação didática.

Para o outro repositório (`gatums-gourmet-api`) **não há implementação neste
ciclo**: entregamos apenas um documento de referência (na pasta `docs` deste
repo) com contexto + prompt, para que lá um agente conduza o próprio
brainstorm e validações no contexto real da API.

## Entendimento (design brief)

- Fluxo gitflow: `feature/*` → PR → `develop` → `release` → `main`.
- Deploy: push em `main` → produção (VPS Locaweb); PR aprovado com base
  `release` → homologação (Vercel neste front / Render na API).
- Ambos os repos têm build + unit tests; neste front o CI de PR ainda **não
  existe** e será criado (`ci.yml`, job `build-test`).
- O dono trabalha sozinho com frequência e precisa de **bypass de admin**
  (papel Repository admin) em todas as branches, em modo `always`.
- Backend de state: HCP Terraform (grátis, leve). Autenticação GitHub via PAT
  **clássico** com escopo `repo`.

## Decisões confirmadas

| Tema | Decisão |
|---|---|
| Backend de state | HCP Terraform, workspace **CLI-driven** |
| Provider GitHub | `integrations/github`, autenticado por PAT clássico (escopo `repo`) |
| Pasta raiz da stack | `terraform/infra/` |
| Reuso | Um módulo `branch-ruleset` chamado 1x por branch |
| Aprovações no PR | 1 (nas três branches) |
| Histórico linear | Desligado (nas três) |
| Resolução de conversas | Não exigida (removida do escopo) |
| Status check obrigatório | Job `build-test` (nas três) |
| Bypass | Repository admin (actor_id 5), `bypass_mode = "always"`, nas três |
| Apply automatizado | push em `main` (paths `terraform/infra/**`) + `workflow_dispatch` manual |
| API (`gatums-gourmet-api`) | Somente documento de referência + prompt neste ciclo |

## Seção 1 — Arquitetura e estrutura de pastas

```
terraform/infra/
├── main.tf                     # provider github + chamadas do módulo (develop/release/main)
├── variables.tf                # github_owner, github_token, repository, status_checks...
├── outputs.tf                  # ids/nós dos rulesets criados
├── versions.tf                 # required_version, required_providers, backend cloud (HCP)
├── terraform.tfvars.example    # placeholders (sem segredo real)
└── modules/
    └── branch-ruleset/
        ├── main.tf             # recurso github_repository_ruleset (1 por branch)
        ├── variables.tf        # branch, approvals, status_checks, flags de rigor, bypass
        └── outputs.tf          # id/node_id do ruleset
```

**Por que módulo:** as três branches compartilham a mesma "forma" de ruleset,
variando só o rigor. O módulo é escrito uma vez e chamado três vezes com
parâmetros diferentes. Fica pronto para, no futuro, atender também a API.

## Seção 2 — Backend de state (HCP) e autenticação

### versions.tf (conceito)

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  cloud {
    organization = "cesarbotas"
    workspaces {
      name = "gatums-gourmet-hub-rulesets"
    }
  }
}
```

### Setup manual único (fora do Terraform)

1. Criar conta grátis no HCP Terraform (app.terraform.io).
2. Criar uma **organization** chamada `cesarbotas`.
3. Criar um **workspace CLI-driven** chamado `gatums-gourmet-hub-rulesets`
   (CLI-driven é o que permite `apply` da máquina local e do Actions).

### Autenticação

- **Com o HCP (state):** `terraform login` localmente (gera token em
  `~/.terraform.d/credentials.tfrc.json`); no Actions via secret `TF_API_TOKEN`.
- **Com o GitHub (criar rulesets):** PAT clássico com escopo `repo`. Localmente
  via env var `GITHUB_TOKEN` + `GITHUB_OWNER`; no Actions via secret
  `GH_RULESET_TOKEN` (não usamos o nome `GITHUB_TOKEN` em Actions porque é
  reservado pela plataforma).

### Segurança

- Token nunca em arquivo versionado — só env var / secret.
- `terraform.tfvars.example` contém apenas placeholders.
- `.gitignore` cobre `*.tfvars` (reais), `.terraform/`, `*.tfstate*`,
  `crash.log` e `.terraform.lock.hcl` fica **versionado** (boa prática: trava
  versões de provider).

## Seção 3 — Regras por branch

| Regra | `develop` | `release` | `main` |
|---|:---:|:---:|:---:|
| Push direto bloqueado (só via PR) | ✅ | ✅ | ✅ |
| Aprovações necessárias | 1 | 1 | 1 |
| Dismiss stale approvals (novo push descarta aprovação) | ❌ | ✅ | ✅ |
| Status check obrigatório `build-test` | ✅ | ✅ | ✅ |
| Strict (branch atualizada com a base antes do merge) | ❌ | ✅ | ✅ |
| Bloquear deleção da branch | ✅ | ✅ | ✅ |
| Bloquear force-push (non_fast_forward) | ✅ | ✅ | ✅ |
| Histórico linear | ❌ | ❌ | ❌ |
| Bypass: Repository admin (always) | ✅ | ✅ | ✅ |

### Mapeamento para o recurso `github_repository_ruleset`

- `enforcement = "active"`, `target = "branch"`.
- `conditions { ref_name { include = ["refs/heads/<branch>"] exclude = [] } }`.
- `bypass_actors { actor_type = "RepositoryRole", actor_id = 5, bypass_mode = "always" }`
  (id 5 = papel Repository admin).
- `rules`:
  - `pull_request { required_approving_review_count = 1, dismiss_stale_reviews_on_push = <flag>, require_code_owner_review = false, required_review_thread_resolution = false }`
  - `required_status_checks { required_check { context = "build-test" } strict_required_status_checks_policy = <flag strict> }`
  - `deletion {}`  (bloqueia deleção)
  - `non_fast_forward {}`  (bloqueia force-push)

Observação: no provider `integrations/github` v6, "bloquear push direto e
exigir PR" é efeito da regra `pull_request` combinada com a ausência de bypass
para não-admins; ninguém sem bypass consegue empurrar sem PR aprovado.

## Seção 4 — Workflows (CI de PR e Terraform)

### `.github/workflows/ci.yml`

- Dispara em `pull_request` com base `develop`, `release`, `main`.
- Job único **`build-test`** (nome idêntico ao status check do ruleset):
  `npm ci` → `npm run build` → `npm test`.
- Node 22 (alinhado aos workflows existentes).

### `.github/workflows/terraform.yml`

- Em **PR** que toca `terraform/infra/**`: `fmt -check` → `init` → `validate`
  → `plan` (sem aplicar); resultado publicado no job summary.
- Em **push em `main`** que toca `terraform/infra/**`: `apply -auto-approve`.
- `workflow_dispatch`: disparo manual do `apply`.
- Secrets: `TF_API_TOKEN` (HCP) e `GH_RULESET_TOKEN` (PAT GitHub).

**Auto-proteção do IaC:** como `apply` só ocorre no merge para `main`, as
próprias regras de branch mudam via PR + merge, com `plan` visível antes.

## Seção 5 — Documentação, edge cases e verificação

### Documentos (pasta `docs`)

1. `docs/terraform-github-rulesets.md` — README didático da stack: pré-requisitos
   (HCP, workspace CLI-driven, PAT clássico), setup de secrets, bootstrap
   (primeiro apply local), uso de `plan`/`apply`, e explicação dos conceitos
   (provider, state, módulo, bypass).
2. `docs/REFERENCE-github-rulesets-api.md` — referência para levar ao repo da
   API: objetivo, modelo de branches/deploy esperado, tabela de regras,
   estrutura Terraform e um **prompt pronto** instruindo o agente da API a ler
   o contexto do projeto, conduzir o próprio brainstorm e validar os pontos
   específicos (nomes de branches reais, nome do job de CI .NET) antes de
   implementar.

### Edge cases tratados (documentados)

- Token ausente/sem escopo → `plan`/`apply` falham com erro claro.
- Nome do status check acoplado: job `build-test` no `ci.yml` == `context` no
  tfvars. Divergência trava merge para sempre. Documentar o acoplamento.
- Bootstrap (ovo-galinha): primeiro `apply` é local; depois o Actions assume.
- Lock de state: HCP faz lock automático; documentar como destravar.
- Lockout do próprio dono: evitado pelo bypass admin `always`.

### Verificação (o que é possível automatizar aqui)

- `terraform fmt -check` e `terraform validate` → sintaxe e consistência.
- `terraform plan` → confirmar 3 rulesets com as regras da tabela.
- **Limite honesto:** o agente não possui as credenciais HCP/PAT do dono, então
  **não executa `apply` real** nem, possivelmente, o `plan` (que exige
  credenciais). A validação ponta-a-ponta (apply + conferência em Settings →
  Rules) fica a cargo do dono, com checklist fornecido na doc.

## Fora de escopo

- Implementar a stack no repo `gatums-gourmet-api` (só referência neste ciclo).
- Rulesets de tags, proteção de outras branches, CODEOWNERS.
- Histórico linear, exigência de assinatura de commits, required deployments.
- Qualquer provisionamento em nuvem além do workspace HCP.
