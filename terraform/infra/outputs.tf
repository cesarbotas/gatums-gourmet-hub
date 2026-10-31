output "ruleset_ids" {
  description = "IDs dos rulesets criados por branch."
  value = {
    develop = module.develop.ruleset_id
    release = module.release.ruleset_id
    main    = module.main.ruleset_id
  }
}
