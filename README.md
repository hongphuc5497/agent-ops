# Agent Ops

Markdown-first operating system for reliable AI-native developer workflows.

This repo is not an agent framework. It is the control plane for deciding what
work exists, who owns it, how tools hand off, how memory compounds, and when an
experiment earns more investment.

## Start Here

1. Read [ROUTING.md](/Users/hongphuc/repos/agent-ops/ROUTING.md).
2. Start one active task:

   ```bash
   ./scripts/task-start.sh "ship routing v1" Codex
   ```

3. Work from [TASK.md](/Users/hongphuc/repos/agent-ops/TASK.md).
4. Log durable decisions in [DECISIONS.md](/Users/hongphuc/repos/agent-ops/DECISIONS.md).
5. End or park the task before starting another:

   ```bash
   ./scripts/task-finish.sh done
   ```

## Core Rule

One task owner at a time. Other agents can advise, review, or handle bounded
sidecar work, but only the active owner edits the active concern.

## Repo Map

- `.ai/ARCHITECTURE.md` - full workflow architecture and 14-day plan.
- `.ai/workflows/` - daily, feature, debugging, CI, review, and experiment runbooks.
- `.ai/automation/` - automation rules and current gates.
- `.ai/prompts/` - reusable prompts for each tool role.
- `.ai/memory/` - durable project memory that should compound.
- `.ai/experiments/` - controlled experiment queue and kill criteria.
- `.ai/templates/` - task, decision, and scoring templates.
- `scripts/` - tiny local scripts for task ownership and reviews.

## What This Avoids

- No new orchestration server in v1.
- No agent swarm by default.
- No shared edit surface across agents.
- No experiments without a user pain hypothesis and kill date.

## Verify

```bash
./scripts/agent-ops-check.sh
```
