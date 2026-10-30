# Terraform GitHub Rulesets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerenciar as regras de proteção (GitHub rulesets) das branches `develop`, `release` e `main` do repo `gatums-gourmet-hub` via Terraform, com state remoto no HCP Terraform e apply automatizado por GitHub Actions.

**Architecture:** Uma stack Terraform em `terraform/infra/` com um módulo reutilizável `branch-ruleset` chamado três vezes (uma por branch) com parâmetros de rigor crescente. State remoto no HCP Terraform (org `cesarbotas`, workspace `gatums-gourmet-hub-rulesets`). Dois workflows novos: `ci.yml` (job `build-test`, gate de PR) e `terraform.yml` (plan em PR, apply no merge para `main` + disparo manual). A API recebe só um documento de referência.

**Tech Stack:** Terraform >= 1.6, provider `integrations/github` ~> 6.0, HCP Terraform (cloud backend), GitHub Actions, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-23-terraform-github-rulesets-design.md`

## Global Constraints

- Pasta raiz da stack: `terraform/infra/`.
- Backend: HCP Terraform, `organization = "cesarbotas"`, workspace `gatums-gourmet-hub-rulesets` (CLI-driven).
- Provider: `integrations/github` versão `~> 6.0`; `required_version = ">= 1.6.0"`.
- Autenticação GitHub: PAT clássico (escopo `repo`) via env var / secret — **nunca** em arquivo versionado.
- Secrets do Actions: `TF_API_TOKEN` (HCP), `GH_RULESET_TOKEN` (PAT GitHub). Não usar o nome `GITHUB_TOKEN` para o PAT.
- Repositório alvo dos rulesets: `gatums-gourmet-hub` (owner `cesarbotas`).
- Nome do status check obrigatório: exatamente `build-test` (igual ao nome do job em `ci.yml`).
- Aprovações no PR: 1 em todas as branches. Histórico linear: desligado. Resolução de conversas: não exigida.
- Bypass: papel Repository admin (`actor_type = "RepositoryRole"`, `actor_id = 5`, `bypass_mode = "always"`) em todas as branches.
- Rigor por branch (dismiss stale + strict status checks): `develop` = off; `release` e `main` = on.
- `.terraform.lock.hcl` versionado; `*.tfvars` reais, `.terraform/`, `*.tfstate*` ignorados.

## Review Focus

- **Nome do status check divergente** — se o job em `ci.yml` não se chamar exatamente `build-test`, o check nunca fica verde e o merge trava para sempre (menos para o admin). Coberto na verificação da Task 5 (grep do nome em ambos os arquivos).
- **PAT vazando em commit** — um `terraform.tfvars` com token real commitado expõe credencial. Coberto na Task 1 (gitignore) + verificação `git status` na Task 6.
- **Bypass ausente/errado** — se o `actor_id`/`bypass_mode` estiver errado, o dono se tranca fora do próprio repo. Coberto na Task 3 (valor fixado no módulo) e na checklist pós-apply da doc (Task 6).
- **Branch condition errada** — `ref_name.include` sem o prefixo `refs/heads/` não casa a branch e a regra não protege nada. Coberto na Task 3 (valor explícito) e Task 4 (`terraform validate`/`plan`).
- **Apply disparando em push de branch errada** — se o filtro de `terraform.yml` não limitar a `main` + paths `terraform/infra/**`, um push qualquer pode aplicar. Coberto na Task 5 (revisão do gatilho).

---

### Task 1: Scaffold da stack (backend, provider, gitignore)

**Files:**
- Create: `terraform/infra/versions.tf`
- Create: `terraform/infra/variables.tf`
- Create: `terraform/infra/terraform.tfvars.example`
- Modify: `.gitignore` (append bloco Terraform)

**Interfaces:**
- Produces: variáveis raiz `github_owner` (string), `github_token` (string, sensitive), `repository` (string), `required_status_checks` (list(string)), `approvals` (number, default 1). Backend cloud `cesarbotas` / `gatums-gourmet-hub-rulesets`. Provider `github` aliasado por default.

- [ ] **Step 1: Criar `terraform/infra/versions.tf`** com `terraform { required_version = ">= 1.6.0"; required_providers { github = { source = "integrations/github", version = "~> 6.0" } }; cloud { organization = "cesarbotas"; workspaces { name = "gatums-gourmet-hub-rulesets" } } }` e o `provider "github" { owner = var.github_owner; token = var.github_token }`.

- [ ] **Step 2: Criar `terraform/infra/variables.tf`** declarando `github_owner` (default `"cesarbotas"`), `github_token` (sensitive, sem default), `repository` (default `"gatums-gourmet-hub"`), `required_status_checks` (list(string), default `["build-test"]`), `approvals` (number, default `1`).

- [ ] **Step 3: Criar `terraform/infra/terraform.tfvars.example`** com placeholders (ex.: `github_owner = "cesarbotas"`, `# github_token via env TF_VAR_github_token`, `repository = "gatums-gourmet-hub"`). Sem token real.

- [ ] **Step 4: Append no `.gitignore`** bloco com `.terraform/`, `*.tfstate`, `*.tfstate.*`, `crash.log`, `*.tfvars`, `!*.tfvars.example`, `.terraformrc`, `terraform.rc`. (Garantir que `.terraform.lock.hcl` NÃO seja ignorado.)

- [ ] **Step 5: Verificar formatação** — Run: `terraform -chdir=terraform/infra fmt -check`. Expected: sem diffs (exit 0). Se o binário terraform não estiver disponível no ambiente, registrar isso e seguir (validação fica para o dono).

- [ ] **Step 6: Commit**

```bash
git add terraform/infra/versions.tf terraform/infra/variables.tf terraform/infra/terraform.tfvars.example .gitignore
git commit -m "feat(infra): scaffold terraform (backend HCP, provider github, gitignore)"
```

---

### Task 2: Módulo `branch-ruleset` — variáveis e outputs

**Files:**
- Create: `terraform/infra/modules/branch-ruleset/variables.tf`
- Create: `terraform/infra/modules/branch-ruleset/outputs.tf`

**Interfaces:**
- Produces (variáveis de entrada do módulo): `repository` (string), `branch` (string), `approvals` (number, default 1), `required_status_checks` (list(string), default []), `dismiss_stale_reviews` (bool, default false), `strict_status_checks` (bool, default false), `admin_bypass_actor_id` (number, default 5). Outputs: `ruleset_id` (string), `ruleset_name` (string).

- [ ] **Step 1: Criar `variables.tf` do módulo** com as variáveis listadas em Interfaces, cada uma com `type` e `description` explícitos.

- [ ] **Step 2: Criar `outputs.tf` do módulo** com `ruleset_id = github_repository_ruleset.this.id` e `ruleset_name = github_repository_ruleset.this.name` (o recurso será criado na Task 3; o output referencia o nome `this`).

- [ ] **Step 3: Verificar formatação** — Run: `terraform -chdir=terraform/infra fmt -check`. Expected: exit 0 (ou registrar ausência do binário).

- [ ] **Step 4: Commit**

```bash
git add terraform/infra/modules/branch-ruleset/variables.tf terraform/infra/modules/branch-ruleset/outputs.tf
git commit -m "feat(infra): variaveis e outputs do modulo branch-ruleset"
```

---

### Task 3: Módulo `branch-ruleset` — recurso do ruleset

**Files:**
- Create: `terraform/infra/modules/branch-ruleset/main.tf`

**Interfaces:**
- Consumes: variáveis da Task 2.
- Produces: recurso `github_repository_ruleset.this`.

- [ ] **Step 1: Criar `main.tf` do módulo** com `resource "github_repository_ruleset" "this"`:
  - `name = "protect-${var.branch}"`, `repository = var.repository`, `target = "branch"`, `enforcement = "active"`.
  - `conditions { ref_name { include = ["refs/heads/${var.branch}"], exclude = [] } }`.
  - `bypass_actors { actor_id = var.admin_bypass_actor_id, actor_type = "RepositoryRole", bypass_mode = "always" }`.
  - `rules` contendo:
    - `deletion = true` (ou bloco conforme sintaxe v6 — bloquear deleção).
    - `non_fast_forward = true` (bloquear force-push).
    - `pull_request { required_approving_review_count = var.approvals, dismiss_stale_reviews_on_push = var.dismiss_stale_reviews, require_code_owner_reviews = false, required_review_thread_resolution = false }`.
    - `dynamic "required_status_checks"` quando `length(var.required_status_checks) > 0`: `required_check { context = <cada item> }` + `strict_required_status_checks_policy = var.strict_status_checks`.

  Abordagem: usar a sintaxe do provider `integrations/github` v6 para `github_repository_ruleset`. Onde a sintaxe exata de `deletion`/`non_fast_forward` (atributo booleano vs bloco) deixar escolha, seguir a documentação da v6; o objetivo é bloquear deleção e force-push.

- [ ] **Step 2: Verificar formatação e sintaxe** — Run: `terraform -chdir=terraform/infra fmt -check`. Expected: exit 0 (ou registrar ausência do binário).

- [ ] **Step 3: Commit**

```bash
git add terraform/infra/modules/branch-ruleset/main.tf
git commit -m "feat(infra): recurso github_repository_ruleset no modulo branch-ruleset"
```

---

### Task 4: Composição raiz (chamar o módulo 3x) + outputs

**Files:**
- Create: `terraform/infra/main.tf`
- Create: `terraform/infra/outputs.tf`

**Interfaces:**
- Consumes: módulo `./modules/branch-ruleset` (Tasks 2–3), variáveis raiz (Task 1).
- Produces: módulos `module.develop`, `module.release`, `module.main`; outputs `ruleset_ids` (map).

- [ ] **Step 1: Criar `terraform/infra/main.tf`** com três blocos `module` apontando para `./modules/branch-ruleset`:
  - `module "develop"` → `branch = "develop"`, `dismiss_stale_reviews = false`, `strict_status_checks = false`.
  - `module "release"` → `branch = "release"`, `dismiss_stale_reviews = true`, `strict_status_checks = true`.
  - `module "main"` → `branch = "main"`, `dismiss_stale_reviews = true`, `strict_status_checks = true`.
  - Todos passam `repository = var.repository`, `approvals = var.approvals`, `required_status_checks = var.required_status_checks`.

- [ ] **Step 2: Criar `terraform/infra/outputs.tf`** com `output "ruleset_ids"` = map de `{ develop = module.develop.ruleset_id, release = module.release.ruleset_id, main = module.main.ruleset_id }`.

- [ ] **Step 3: Verificar** — Run: `terraform -chdir=terraform/infra fmt -check` e, se houver credenciais/binário, `terraform -chdir=terraform/infra init -backend=false && terraform -chdir=terraform/infra validate`. Expected: `Success! The configuration is valid.` Se binário/credenciais ausentes, registrar e deixar para o dono (documentado na Task 6).

- [ ] **Step 4: Commit**

```bash
git add terraform/infra/main.tf terraform/infra/outputs.tf
git commit -m "feat(infra): composicao raiz chamando branch-ruleset para develop/release/main"
```

---

### Task 5: Workflows de CI e Terraform

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/terraform.yml`

**Interfaces:**
- Produces: job de status check `build-test` (consumido pelo ruleset como `context`).

- [ ] **Step 1: Criar `.github/workflows/ci.yml`** — `on: pull_request: branches: [develop, release, main]`. Job `build-test` (runs-on ubuntu-latest, Node 22 via actions/setup-node@v4): `npm ci` → `npm run build` → `npm test`.

- [ ] **Step 2: Criar `.github/workflows/terraform.yml`** — gatilhos: `pull_request` com `paths: [terraform/infra/**]`; `push: branches: [main]` com `paths: [terraform/infra/**]`; `workflow_dispatch`. Dois jobs (ou um com condicionais):
  - PR → `fmt -check`, `init`, `validate`, `plan` (publicar no `$GITHUB_STEP_SUMMARY`).
  - push main / dispatch → `init`, `apply -auto-approve`.
  - env: `TF_API_TOKEN: ${{ secrets.TF_API_TOKEN }}`, `TF_VAR_github_token: ${{ secrets.GH_RULESET_TOKEN }}`. Setup via `hashicorp/setup-terraform@v3`.

- [ ] **Step 3: Verificar acoplamento do status check** — Run: `grep -rn "build-test" .github/workflows/ci.yml terraform/infra/`. Expected: o nome `build-test` aparece como nome do job em `ci.yml` e como default de `required_status_checks` nas variáveis. Confirmar que batem exatamente.

- [ ] **Step 4: Verificar gatilho do apply** — ler `terraform.yml` e confirmar que `apply` só roda em `push` na `main` (paths `terraform/infra/**`) ou `workflow_dispatch`, nunca em PR.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/terraform.yml
git commit -m "feat(ci): workflow build-test de PR e workflow terraform (plan/apply)"
```

---

### Task 6: Documentação (README da stack + referência para a API)

**Files:**
- Create: `docs/terraform-github-rulesets.md`
- Create: `docs/REFERENCE-github-rulesets-api.md`

**Interfaces:** nenhuma (documentação).

- [ ] **Step 1: Criar `docs/terraform-github-rulesets.md`** — README didático: o que é (IaC para branch protection), pré-requisitos (conta HCP, org `cesarbotas`, workspace CLI-driven `gatums-gourmet-hub-rulesets`, PAT clássico escopo `repo`), setup de secrets (`TF_API_TOKEN`, `GH_RULESET_TOKEN`), **bootstrap** (primeiro apply local: `terraform login` → `export TF_VAR_github_token=...` → `terraform -chdir=terraform/infra init` → `plan` → `apply`), uso contínuo via Actions, tabela de regras por branch, explicação dos conceitos (provider, state remoto, módulo, bypass), edge cases (token sem escopo, nome do status check acoplado, lock do state, lockout evitado pelo bypass) e **checklist pós-apply** (conferir em Settings → Rules que os 3 rulesets existem com as regras certas).

- [ ] **Step 2: Criar `docs/REFERENCE-github-rulesets-api.md`** — documento para levar ao repo `gatums-gourmet-api`: objetivo, modelo de branches/deploy esperado, tabela de regras, estrutura Terraform de referência, e um **prompt pronto** (bloco copiável) instruindo o agente da API a: ler todo o contexto do projeto, conduzir brainstorm próprio, validar nomes reais de branches e o nome do job de CI .NET, e só então implementar. Deixar explícito que os valores (status check, workspace HCP) devem ser os da API, não os deste front.

- [ ] **Step 3: Verificar estado do working tree** — Run: `git status --short`. Expected: nenhum `*.tfvars` real nem token exposto; apenas os arquivos previstos.

- [ ] **Step 4: Commit**

```bash
git add docs/terraform-github-rulesets.md docs/REFERENCE-github-rulesets-api.md
git commit -m "docs(infra): README da stack terraform e referencia para o repo da API"
```

---

## Notas de verificação (limite honesto)

O agente não possui as credenciais HCP (`TF_API_TOKEN`) nem o PAT do GitHub, e o binário `terraform` pode não estar instalado no ambiente. Onde possível, rodar `terraform fmt -check` e `terraform validate` (com `-backend=false`). O `terraform plan`/`apply` real contra o HCP e o GitHub fica a cargo do dono, seguindo o bootstrap documentado na Task 6. Isso está refletido no spec (Seção 5) e deve ser dito claramente ao usuário ao concluir.
