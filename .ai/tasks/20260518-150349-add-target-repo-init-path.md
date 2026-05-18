# add target repo init path

Status: active
Owner: Codex
Started: 2026-05-18T15:03:49.400712+00:00
Repo: /Users/hongphuc/repos/agent-ops
Workflow: .ai/workflows/feature.md
Verification: targeted tests, lint, build, or browser check as appropriate

## Objective

Add a conservative setup path for seeding Agent Ops into another repository.

## Acceptance Criteria

- Target repo initialization has a dry-run mode.
- Existing target files are not overwritten unless `--force` is passed.
- A freshly initialized temporary repo passes Agent Ops checks.

## Files In Scope

- `scripts/init-repo.sh`
- `README.md`
- `scripts/agent-ops-check.sh`
- `.ai/ARCHITECTURE.md`

## Out Of Scope

- Live Hermes daemon integration.
- A full MCP server.

## Result

Changed files:

- `scripts/init-repo.sh`
- `scripts/agent-ops-check.sh`
- `scripts/agent-ops-tool.py`
- `README.md`
- `.ai/ARCHITECTURE.md`

Verification:

- `bash -n scripts/*.sh`
- `python3 -m py_compile scripts/agent-ops-tool.py`
- `./scripts/agent-ops-check.sh`
- `python3 scripts/agent-ops-tool.py check`
- Fresh temp repo: `init-repo.sh --dry-run`, `init-repo.sh`, `agent-ops-check.sh`, `agent-ops-tool.py status`, `install-integration.sh codex --dry-run`

Risks:

- The setup script seeds the repo-native protocol and templates only. Specific agent instructions still require an explicit `install-integration.sh <agent>` step.
