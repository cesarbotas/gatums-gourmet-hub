output "ruleset_id" {
  description = "ID do ruleset criado."
  value       = github_repository_ruleset.this.id
}

output "ruleset_name" {
  description = "Nome do ruleset criado."
  value       = github_repository_ruleset.this.name
}
