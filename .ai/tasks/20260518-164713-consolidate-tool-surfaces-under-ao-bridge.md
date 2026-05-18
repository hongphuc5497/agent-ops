# consolidate tool surfaces under ao bridge

Status: active
Owner: Hermes
Started: 2026-05-18T16:47:13.164142+00:00
Repo: /Users/hongphuc/repos/agent-ops
Workflow: .ai/workflows/feature.md
Verification: bash -n, ao check, agent-ops-check.sh, init-repo.sh --dry-run smoke test, wrapper compat verified

## Objective

Consolidate two competing tool surfaces (old shell scripts and JSON bridge) by rewriting old scripts as thin wrappers over `agent-ops-tool.py`, committing `scripts/ao`, and updating all doc references.

## Acceptance Criteria

- `task-start.sh`, `task-status.sh`, `task-finish.sh` are thin wrappers
- `.ai/workflows/daily.md` references `ao` commands
- `scripts/ao` is committed and in all required-files lists
- `init-repo.sh` copies and chmod's `scripts/ao`
- All checks pass: `bash -n`, `agent-ops-check.sh`, `agent-ops-tool.py check`
- `init-repo.sh --dry-run` shows 31 files

## Files In Scope

- `scripts/task-start.sh`
- `scripts/task-status.sh`
- `scripts/task-finish.sh`
- `scripts/init-repo.sh`
- `scripts/agent-ops-check.sh`
- `scripts/agent-ops-tool.py`
- `.ai/workflows/daily.md`
- `AGENTS.md`
- `scripts/ao`

## Out Of Scope

- Deleting old scripts (preserved as wrappers for backward compat)
- Shell completion
- Installable packaging

## Result

Changed files:

- `scripts/task-start.sh` — rewritten as 13-line wrapper
- `scripts/task-status.sh` — rewritten as 6-line wrapper
- `scripts/task-finish.sh` — rewritten as 15-line wrapper
- `scripts/init-repo.sh` — added `scripts/ao` to copy list and chmod
- `scripts/agent-ops-check.sh` — added `scripts/ao` to required files
- `scripts/agent-ops-tool.py` — added `scripts/ao` to check required list
- `.ai/workflows/daily.md` — updated to reference `ao` commands
- `AGENTS.md` — updated verification step to `ao status`
- `scripts/ao` — committed (thin CLI entrypoint)

Verification:

- `bash -n scripts/*.sh` — passed
- `./scripts/agent-ops-check.sh` — passed
- `python3 scripts/agent-ops-tool.py check` — passed
- `./scripts/init-repo.sh $tmpdir --dry-run` — 31 files
- `./scripts/init-repo.sh $tmpdir && cd $tmpdir && ./scripts/agent-ops-check.sh` — passed
- `scripts/ao` present in target repo
- Old wrapper: `task-start.sh` correctly refuses when task active
- Old wrapper: `task-status.sh` prints correct JSON

Risks:

- Old scripts preserved as wrappers — no breaking changes to any muscle memory or aliases
