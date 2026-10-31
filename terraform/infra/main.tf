module "develop" {
  source                 = "./modules/branch-ruleset"
  repository             = var.repository
  branch                 = "develop"
  approvals              = var.approvals
  required_status_checks = var.required_status_checks
  dismiss_stale_reviews  = false
  strict_status_checks   = false
}

module "release" {
  source                 = "./modules/branch-ruleset"
  repository             = var.repository
  branch                 = "release"
  approvals              = var.approvals
  required_status_checks = var.required_status_checks
  dismiss_stale_reviews  = true
  strict_status_checks   = true
}

module "main" {
  source                 = "./modules/branch-ruleset"
  repository             = var.repository
  branch                 = "main"
  approvals              = var.approvals
  required_status_checks = var.required_status_checks
  dismiss_stale_reviews  = true
  strict_status_checks   = true
}
