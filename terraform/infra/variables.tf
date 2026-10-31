variable "github_owner" {
  type        = string
  description = "Owner (org ou usuário) dono do repositório no GitHub."
  default     = "cesarbotas"
}

variable "github_token" {
  type        = string
  description = "PAT clássico do GitHub com escopo 'repo'. Definir via env TF_VAR_github_token; nunca versionar."
  sensitive   = true
}

variable "repository" {
  type        = string
  description = "Nome do repositório alvo dos rulesets."
  default     = "gatums-gourmet-hub"
}

variable "required_status_checks" {
  type        = list(string)
  description = "Status checks obrigatórios para merge na branch protegida."
  default     = ["build-test"]
}

variable "approvals" {
  type        = number
  description = "Número de aprovações requeridas no pull request."
  default     = 1
}
