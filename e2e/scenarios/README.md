# E2E Scenario Layout

The default benchmark reads YAML files directly from this directory. The existing committed scenarios stay here for backward compatibility.

Future scenario suites should use these subdirectories:

- `golden`: certified scenarios that affect release quality gates.
- `edge-cases`: unusual but valid inputs that should keep working.
- `adversarial`: intentionally broken or stress-test inputs.
- `custom`: local/private scenarios that should not become the default benchmark until promoted.

When a scenario graduates to the default benchmark, copy or move its YAML expectation pair into `e2e/scenarios` and `e2e/expectations`, then update `e2e/baselines/current.json`.
