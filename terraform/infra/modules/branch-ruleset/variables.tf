variable "repository" {
  type        = string
  description = "Nome do repositório alvo do ruleset."
}

variable "branch" {
  type        = string
  description = "Nome da branch protegida (ex.: \"develop\"), sem o prefixo refs/heads."
}

variable "approvals" {
  type        = number
  description = "Número de aprovações requeridas no pull request."
  default     = 1
}

variable "required_status_checks" {
  type        = list(string)
  description = "Status checks obrigatórios para merge na branch protegida."
  default     = []
}

variable "dismiss_stale_reviews" {
  type        = bool
  description = "Descarta aprovações quando novos commits são enviados ao PR."
  default     = false
}

variable "strict_status_checks" {
  type        = bool
  description = "Exige que a branch esteja atualizada com a base antes do merge (strict)."
  default     = false
}

variable "admin_bypass_actor_id" {
  type        = number
  description = "ID do ator de bypass do ruleset (papel Repository admin = 5)."
  default     = 5
}
