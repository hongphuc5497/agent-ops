# Agent Ops

Integration-first operating system for reliable AI-native developer workflows.

This repo is not an agent framework. It is a shared operating protocol that AI
coding agents can read or call before they edit: task ownership, file claims,
routing, handoffs, verification, and focus rules.

## Start Here

1. Read [.ai/protocol.md](/Users/hongphuc/repos/agent-ops/.ai/protocol.md).
2. Ask Agent Ops for current state:

   ```bash
   ./scripts/agent-ops-tool.py status
   ```

3. Start one active task:

   ```bash
   ./scripts/agent-ops-tool.py start "ship routing v1" --owner Codex
   ```

4. Claim files before editing:

   ```bash
   ./scripts/agent-ops-tool.py claim ".ai/protocol.md" "scripts/agent-ops-tool.py"
   ```

5. Finish or park the task before starting another:

   ```bash
   ./scripts/agent-ops-tool.py finish done --verification "./scripts/agent-ops-check.sh"
   ```

## Core Rule

One task owner at a time. Other agents can advise, review, or handle bounded
sidecar work, but only the active owner edits the active concern.

## Repo Map

- `.ai/ARCHITECTURE.md` - full workflow architecture and 14-day plan.
- `.ai/protocol.md` - shared protocol agents use to coordinate.
- `.ai/schema/` - JSON schemas for tasks, file claims, and handoffs.
- `.ai/workflows/` - daily, feature, debugging, CI, review, and experiment runbooks.
- `.ai/automation/` - automation rules and current gates.
- `.ai/prompts/` - reusable prompts for each tool role.
- `.ai/memory/` - durable project memory that should compound.
- `.ai/experiments/` - controlled experiment queue and kill criteria.
- `.ai/templates/` - task, decision, and scoring templates.
- `integrations/` - templates for Codex, OpenCode, Augment, OpenClaw, and Hermes.
- `scripts/` - tiny local scripts for task ownership and reviews.

## MVP Product Surface

Agents should call the JSON bridge:

```bash
./scripts/agent-ops-tool.py route "debug failing playwright test"
./scripts/agent-ops-tool.py start "fix CI failure" --repo /path/to/repo
./scripts/agent-ops-tool.py claim "src/auth/**" "tests/auth/**"
./scripts/agent-ops-tool.py handoff --to OpenCode --files "scripts/check.sh" --acceptance "passes bash -n"
./scripts/agent-ops-tool.py finish done --verification "pytest tests/auth"
```

Humans can use the shell scripts, but the product direction is agent
integration. The CLI is plumbing.

## Install Agent Instructions

Preview an integration:

```bash
./scripts/install-integration.sh codex --dry-run
```

Install repo-local instructions:

```bash
./scripts/install-integration.sh codex
./scripts/install-integration.sh opencode
./scripts/install-integration.sh augment
./scripts/install-integration.sh openclaw
./scripts/install-integration.sh hermes
```

This writes repo-local guidance only. It does not mutate global Codex,
OpenCode, Hermes, or Augment config.

## What This Avoids

- No new orchestration server in v1.
- No agent swarm by default.
- No shared edit surface across agents.
- No experiments without a user pain hypothesis and kill date.
- No full MCP server until the JSON bridge is useful in real repos.

## Verify

```bash
./scripts/agent-ops-check.sh
```
