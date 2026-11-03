# Branch Rulesets como código (Terraform + GitHub)

Este documento explica, de forma didática, a stack Terraform que gerencia as
**regras de proteção de branch** (branch rulesets) do repositório
`gatums-gourmet-hub` diretamente no GitHub. Foi escrito pensando em quem está
começando com Terraform.

---

## 1. O que é e por quê

Normalmente você configura proteção de branch clicando no GitHub
(**Settings → Rules → Rulesets**): quem pode dar push, quantas aprovações um PR
precisa, se é obrigatório passar na CI etc.

O problema de fazer isso "na mão":

- Não fica versionado — ninguém sabe quem mudou o quê e quando.
- É fácil esquecer de replicar a mesma regra em outro branch ou repositório.
- Não dá para revisar a mudança em um PR antes de aplicar.

A ideia aqui é tratar essas regras como **código** (Infraestrutura como Código,
ou IaC): descrevemos as regras em arquivos `.tf`, versionamos no Git e o
Terraform aplica no GitHub. Mudou uma regra? Vira um PR, passa por revisão, e só
então entra em produção.

---

## 2. Conceitos em linguagem simples

- **Provider**: é o "plugin" que ensina o Terraform a conversar com um serviço.
  Aqui usamos o provider `integrations/github` (versão `~> 6.0`), que sabe criar
  rulesets no GitHub via API.

- **State (estado)**: o Terraform guarda um "mapa" do que ele já criou, para
  saber o que mudar na próxima vez. Esse mapa é o *state*. Se ele se perder, o
  Terraform acha que precisa criar tudo de novo.

- **State remoto (HCP Terraform)**: em vez de guardar o state num arquivo local
  (que pode sumir ou conflitar entre máquinas), guardamos no **HCP Terraform**
  (nuvem gratuita da HashiCorp). Assim o state fica central, com trava (*lock*)
  para evitar duas pessoas aplicando ao mesmo tempo, e o GitHub Actions também
  consegue usar o mesmo state.

- **Módulo reutilizável**: um módulo é um bloco de Terraform empacotado que você
  pode chamar várias vezes com parâmetros diferentes. Aqui temos o módulo
  `modules/branch-ruleset`, que cria **um** ruleset. O `main.tf` o chama **três
  vezes** — uma para `develop`, uma para `release`, uma para `main` — mudando só
  os parâmetros. Isso evita copiar e colar a mesma configuração três vezes.

- **Bypass actor**: é quem pode "furar" a regra. Configuramos o papel de
  administrador com `bypass_mode = "always"`. Isso é uma rede de segurança: se
  algo travar (ex.: CI quebrada bloqueando todo merge), um admin ainda consegue
  destravar o repositório sem precisar apagar a regra.

---

## 3. Estrutura dos arquivos

```
terraform/infra/
├── versions.tf      # versão do Terraform, provider github, backend HCP
├── variables.tf     # entradas: owner, token, repositório, status checks, aprovações
├── main.tf          # chama o módulo branch-ruleset 3x (develop/release/main)
├── outputs.tf       # output ruleset_ids (mapa branch -> id)
├── terraform.tfvars.example  # exemplo (NÃO contém token real)
└── modules/
    └── branch-ruleset/       # módulo reutilizável: 1 recurso github_repository_ruleset
```

Workflows de CI/CD:

```
.github/workflows/
├── ci.yml          # job "build-test": bun install -> build -> test em PR p/ develop/release/main
└── terraform.yml   # plan em PR; apply em push na main (+ workflow_dispatch)
```

---

## 4. Pré-requisitos

1. **Conta gratuita no HCP Terraform** — crie em
   [app.terraform.io](https://app.terraform.io).
2. **Organization**: `cesarbotas`.
3. **Workspace CLI-driven** chamado `gatums-gourmet-hub-rulesets`.
   - Ao criar o workspace no HCP, escolha o tipo **CLI-Driven Workflow**
     (dirigido pela linha de comando), não o modo conectado ao VCS.
4. **PAT clássico do GitHub** com escopo `repo`. Passo a passo:
   - No GitHub: **Settings → Developer settings → Personal access tokens →
     Tokens (classic) → Generate new token (classic)**.
   - Marque o escopo **`repo`** (acesso total a repositórios).
   - Gere e **guarde o token** (ele só aparece uma vez). Nunca o versione.

---

## 5. Secrets do GitHub Actions

Os workflows precisam de dois secrets. Cadastre em
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | O que é |
|---|---|
| `TF_API_TOKEN` | Token do HCP Terraform (autentica o Actions no state remoto). |
| `GH_RULESET_TOKEN` | O PAT clássico do GitHub com escopo `repo` (o provider usa para criar os rulesets). |

> O token do HCP você obtém com `terraform login` (gera um token de API) ou em
> **HCP Terraform → User Settings → Tokens**.

---

## 6. Bootstrap — o primeiro apply (LOCAL, Windows/PowerShell)

O primeiro `apply` é feito **na sua máquina**, não pelo Actions. Motivo: as
regras de proteção ainda não existem, e queremos criá-las uma primeira vez com
controle total antes de deixar a automação assumir.

No PowerShell, a partir da raiz do repositório:

```powershell
terraform login            # autentica no HCP (abre o browser, gera token local)

$env:TF_VAR_github_token = "<SEU_PAT>"   # NÃO comite isto; é só na sessão atual

terraform -chdir=terraform/infra init    # baixa provider e conecta ao state remoto
terraform -chdir=terraform/infra plan     # mostra o que será criado
terraform -chdir=terraform/infra apply    # cria os 3 rulesets (confirme com "yes")
```

O que cada passo faz:

- `terraform login`: abre o navegador, você autoriza, e ele grava um token local
  do HCP (em `%APPDATA%\terraform.rc`). Feito uma vez por máquina.
- `$env:TF_VAR_github_token`: injeta o PAT na variável `github_token` do Terraform
  via ambiente. Como é `sensitive`, nunca aparece em log. Vale só para a sessão
  atual do PowerShell.
- `init`: baixa o provider `github` e configura o backend HCP.
- `plan`: mostra o diff (vai dizer "3 to add").
- `apply`: aplica de fato (pede confirmação `yes`).

> **Importante:** o `init` gera o arquivo `.terraform.lock.hcl` (trava de versão
> dos providers). **Comite esse arquivo** — ele garante que o Actions use
> exatamente a mesma versão do provider que você usou localmente.

Depois desse primeiro apply, o **GitHub Actions assume** a aplicação das
mudanças seguintes (ver próxima seção).

---

## 7. Uso contínuo (depois do bootstrap)

- Abriu um PR que toca `terraform/infra/**` → o workflow `terraform.yml` roda
  **`terraform plan`** e publica o resultado no resumo do PR. Você revisa antes
  de aprovar.
- Fez merge na `main` → o mesmo workflow roda **`terraform apply`**
  automaticamente (gate: `github.ref == 'refs/heads/main'`).
- Precisa aplicar manualmente → use **workflow_dispatch** (Actions → Terraform →
  Run workflow). O apply manual **só funciona a partir da branch `main`**.

Resumindo: você edita os `.tf`, abre PR, confere o plan, faz merge na main, e o
apply acontece sozinho.

---

## 8. Tabela de regras por branch

| Regra | `develop` | `release` | `main` |
|---|:---:|:---:|:---:|
| Push direto bloqueado (só via PR) | ✅ | ✅ | ✅ |
| Aprovações | 1 | 1 | 1 |
| Dismiss stale approvals (descartar aprovação após novo push) | ❌ | ✅ | ✅ |
| Status check `build-test` obrigatório | ✅ | ✅ | ✅ |
| Strict (PR precisa estar atualizado com a branch) | ❌ | ✅ | ✅ |
| Bloquear deleção da branch | ✅ | ✅ | ✅ |
| Bloquear force-push | ✅ | ✅ | ✅ |
| Histórico linear exigido | ❌ | ❌ | ❌ |
| Bypass de admin (sempre) | ✅ | ✅ | ✅ |

Leitura rápida: `develop` é a mais "solta" (permite push desatualizado e não
descarta aprovações), enquanto `release` e `main` são mais rígidas.

---

## 9. Edge cases e troubleshooting

- **PAT sem o escopo `repo`**: o `plan`/`apply` falha com erro de permissão
  (404 ou 403 da API do GitHub). Gere um token novo marcando o escopo `repo`.

- **Nome do status check acoplado**: o nome `build-test` precisa ser **idêntico**
  em dois lugares: no job do `ci.yml` (o `name:` do job) e no valor de
  `required_status_checks` (variável/tfvars). Se ficarem diferentes, o GitHub
  espera um check que nunca chega e **o merge trava para sempre**. Mudou o nome
  do job? Mude também a variável, e vice-versa.

- **State travado (lock) no HCP**: se um apply travou no meio, o state pode ficar
  com *lock*. Destrave no HCP Terraform em **Workspace → Settings → Locking →
  Unlock**, ou via CLI com `terraform force-unlock <LOCK_ID>` (o ID aparece na
  mensagem de erro). Destrave só quando tiver certeza de que não há outro apply
  rodando.

- **Se trancar fora do repositório**: o `bypass_mode = "always"` para o papel de
  admin existe justamente para isso — um administrador sempre consegue mergear/
  destravar mesmo que uma regra esteja impedindo todo mundo.

---

## 10. Checklist pós-apply

- [ ] Em **GitHub → Settings → Rules → Rulesets**, confirmar que existem os três
      rulesets: `protect-develop`, `protect-release`, `protect-main`.
- [ ] Conferir que cada um tem as regras da tabela acima (aprovações, status
      check, bloqueio de force-push/deleção).
- [ ] Abrir um PR de teste para `develop` e confirmar que:
      - push direto está bloqueado;
      - o check `build-test` aparece como obrigatório;
      - só dá para mergear com 1 aprovação.
- [ ] Conferir que o `.terraform.lock.hcl` foi commitado.
