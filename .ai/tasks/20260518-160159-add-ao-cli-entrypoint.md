# add ao CLI entrypoint

Status: active
Owner: Hermes
Started: 2026-05-18T16:01:59.241108+00:00
Repo: /Users/hongphuc/repos/agent-ops
Workflow: .ai/workflows/experimentation.md
Verification: time box, kill date, continue evidence

## Objective

Add a thin `scripts/ao` shell entrypoint that delegates to `scripts/agent-ops-tool.py`. Provides `help`, `version`, and unknown-command handling. All other subcommands pass through directly.

## Acceptance Criteria

- `ao help` prints usage
- `ao version` prints version string
- `ao status`, `ao route`, `ao start`, `ao claim`, `ao handoff`, `ao finish`, `ao check` all forward to the bridge
- Unknown commands produce a friendly error
- `bash -n scripts/ao` passes
- Agent Ops checks pass

## Files In Scope

- `scripts/ao`

## Out Of Scope

- Installable packaging (pip, brew)
- MCP server
- Shell completion
- `ao` on PATH

## Result

Changed files:

- `scripts/ao`

Verification:

- `bash -n scripts/ao`
- `./scripts/ao help`
- `./scripts/ao version`
- `./scripts/ao status`
- `./scripts/ao check`
- `./scripts/ao route "debug failing test"`
- `./scripts/ao asdf` (exit 1, friendly message)
- `./scripts/agent-ops-check.sh`
- `python3 scripts/agent-ops-tool.py check`

Risks:

- None. The script is a thin passthrough with no state of its own.
