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

provider "github" {
  owner = var.github_owner
  token = var.github_token
}
