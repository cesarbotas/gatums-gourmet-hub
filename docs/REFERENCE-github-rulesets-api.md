# REFERÊNCIA — Branch Rulesets como código para o repo `gatums-gourmet-api`

> **Para que serve este documento.** Ele é uma **referência** de como replicar,
> no repositório `gatums-gourmet-api`, a mesma solução de branch protection como
> código (Terraform + GitHub Rulesets) já implementada no front
> `gatums-gourmet-hub`.
>
> **Atenção:** os valores específicos da API (nomes reais de branches, nome do
> job de CI .NET, workspace do HCP) **precisam ser validados no contexto daquele
> projeto** — **não copie cegamente** o que está no front. Este doc existe para
> dar o mapa da arquitetura e as decisões, não para ser copiado literalmente.

---

## 1. Resumo da arquitetura (como está no front)

```
terraform/infra/
├── versions.tf      # Terraform >= 1.6, provider integrations/github ~> 6.0, backend HCP (cloud)
├── variables.tf     # github_owner, github_token (sensitive), repository, required_status_checks, approvals
├── main.tf          # chama o módulo branch-ruleset 3x (develop/release/main)
├── outputs.tf       # output ruleset_ids (mapa branch -> id)
└── modules/
    └── branch-ruleset/   # módulo reutilizável: 1 recurso github_repository_ruleset

.github/workflows/
├── ci.yml          # job que roda build + test (status check obrigatório)
└── terraform.yml   # plan em PR; apply em push na main (gate refs/heads/main) + workflow_dispatch
```

Componentes-chave:

- **Backend HCP Terraform** (state remoto, com lock) — organization `cesarbotas`,
  workspace **CLI-driven**.
- **Módulo `branch-ruleset`** — cria um `github_repository_ruleset` parametrizável
  (branch, aprovações, dismiss stale, strict, status checks). Chamado uma vez por
  branch protegido.
- **Dois workflows** — um de CI (gera o status check obrigatório) e um de
  Terraform (plan em PR, apply na main).

---

## 2. Tabela de regras por branch (modelo do front)

| Regra | `develop` | `release` | `main` |
|---|:---:|:---:|:---:|
| Push direto bloqueado (só via PR) | ✅ | ✅ | ✅ |
| Aprovações | 1 | 1 | 1 |
| Dismiss stale approvals | ❌ | ✅ | ✅ |
| Status check de CI obrigatório | ✅ | ✅ | ✅ |
| Strict (PR atualizado com a branch) | ❌ | ✅ | ✅ |
| Bloquear deleção | ✅ | ✅ | ✅ |
| Bloquear force-push | ✅ | ✅ | ✅ |
| Histórico linear | ❌ | ❌ | ❌ |
| Bypass de admin (sempre) | ✅ | ✅ | ✅ |

---

## 3. Decisões de design (herdáveis, mas revisáveis)

- **1 aprovação** obrigatória por PR em todas as branches protegidas.
- **Histórico linear desligado** (permite merge commit; não força rebase/squash).
- **Bypass de admin `always`** — rede de segurança para não se trancar fora.
- **Status check obrigatório** — o nome do check é **acoplado** ao nome do job de
  CI; precisa bater exatamente entre o workflow e a variável do Terraform.
- **`develop` mais solta** (sem dismiss stale, sem strict); **`release`/`main`
  mais rígidas**.

---

## 4. Diferenças esperadas no repo da API

Estes pontos quase certamente **mudam** em relação ao front:

- **Job de CI é .NET** (build/test com `dotnet`), não Node. O **nome do status
  check provavelmente NÃO é `build-test`** — precisa ser confirmado no workflow
  real da API.
- **Workspace do HCP deve ser próprio** da API (ex.: `gatums-gourmet-api-rulesets`),
  nunca reutilizar o workspace do front (`gatums-gourmet-hub-rulesets`).
- **Modelo de branches pode diferir** — confirmar quais branches a API realmente
  usa (develop/release/main? outra convenção?).
- **Deploy da API é diferente**: Render (homologação) / VPS (produção). Isso não
  afeta os rulesets diretamente, mas pode influenciar quais branches existem e
  quais checks são relevantes.

---

## 5. PROMPT PRONTO para o agente do repo `gatums-gourmet-api`

Copie o bloco abaixo e cole no agente que for trabalhar no repositório da API:

```
Você vai implementar, no repositório gatums-gourmet-api, uma stack de branch
protection como código (Terraform + GitHub Rulesets), ESPELHANDO a referência do
repositório gatums-gourmet-hub (doc: docs/REFERENCE-github-rulesets-api.md), mas
AJUSTANDO todos os valores ao contexto real da API. NÃO copie cegamente o front.

Siga exatamente estas etapas, nesta ordem:

1) LER O CONTEXTO DO PROJETO antes de escrever qualquer código:
   - Todos os workflows em .github/workflows/ (como a CI .NET roda, nomes dos
     jobs, em quais branches dispara).
   - O(s) arquivo(s) .csproj / .sln e a estrutura da solução (para entender o
     build/test .NET).
   - O modelo de branches real do repo (git branch -a; convenções usadas;
     develop/release/main existem? há outras?).
   - Como é feito o deploy (Render em homologação, VPS em produção) e se isso
     implica branches específicas.

2) CONDUZIR SEU PRÓPRIO BRAINSTORM e VALIDAR, não assumir:
   - Quais branches realmente precisam de proteção.
   - O NOME EXATO do status check de CI .NET (o name: do job no workflow). NÃO
     assuma que é "build-test" — esse é o nome do front (Node). Confirme olhando
     o workflow de CI da API. O nome no Terraform precisa bater exatamente com o
     nome do job, senão o merge trava para sempre.
   - As decisões de política (nº de aprovações, dismiss stale, strict, histórico
     linear, bypass admin) — herde da referência, mas confirme que fazem sentido
     para a API.

3) DEFINIR A INFRAESTRUTURA HCP própria da API:
   - Workspace HCP exclusivo (ex.: gatums-gourmet-api-rulesets), NUNCA o workspace
     do front (gatums-gourmet-hub-rulesets).
   - Organization conforme o contexto (confirmar).

4) SÓ ENTÃO IMPLEMENTAR a stack terraform/infra espelhando a referência:
   - versions.tf (provider integrations/github ~> 6.0, backend HCP com o workspace
     da API), variables.tf, main.tf (chamando o módulo uma vez por branch
     protegido), outputs.tf.
   - Módulo reutilizável modules/branch-ruleset (um github_repository_ruleset),
     parametrizando branch, aprovações, dismiss stale, strict e status checks.
   - Dois workflows: o de CI .NET (que gera o status check) e o de Terraform
     (plan em PR; apply em push na main com gate github.ref == refs/heads/main;
     workflow_dispatch para apply manual só a partir da main).

5) SEGURANÇA E HIGIENE:
   - NUNCA versionar tokens. O PAT entra via TF_VAR_github_token (env) localmente
     e via secret GH_RULESET_TOKEN no Actions; o token do HCP via secret
     TF_API_TOKEN. Fornecer um terraform.tfvars.example SEM valores reais.
   - Commitar o .terraform.lock.hcl gerado no init.
   - O primeiro apply é LOCAL (bootstrap), pois as regras ainda não existem;
     depois o Actions assume.

6) VERIFICAR antes de concluir:
   - Confirmar que os rulesets criados batem com a política definida.
   - Conferir em GitHub → Settings → Rules → Rulesets.
   - Testar com um PR real que o status check correto é exigido e que push direto
     está bloqueado.

Entregue a stack completa e um README didático próprio da API (equivalente ao
docs/terraform-github-rulesets.md do front), com o bootstrap em PowerShell e a
tabela de regras por branch — já com os valores reais da API, não os do front.
```

---

## 6. Checklist de validação no repo da API

- [ ] Workspace HCP próprio criado (não reaproveitar o do front).
- [ ] Nome do status check de CI .NET confirmado no workflow e idêntico no Terraform.
- [ ] Branches protegidas correspondem ao modelo real da API.
- [ ] `terraform.tfvars.example` sem tokens reais; `.terraform.lock.hcl` commitado.
- [ ] Bootstrap local executado; Actions assumindo os applies seguintes.
- [ ] Rulesets conferidos em GitHub → Settings → Rules → Rulesets.
