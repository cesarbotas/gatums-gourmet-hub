resource "github_repository_ruleset" "this" {
  name        = "protect-${var.branch}"
  repository  = var.repository
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/${var.branch}"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = var.admin_bypass_actor_id
    actor_type  = "RepositoryRole"
    bypass_mode = "always"
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count   = var.approvals
      dismiss_stale_reviews_on_push     = var.dismiss_stale_reviews
      require_code_owner_review         = false
      required_review_thread_resolution = false
    }

    dynamic "required_status_checks" {
      for_each = length(var.required_status_checks) > 0 ? [1] : []
      content {
        strict_required_status_checks_policy = var.strict_status_checks

        dynamic "required_check" {
          for_each = var.required_status_checks
          content {
            context = required_check.value
          }
        }
      }
    }
  }
}
