# Agent Ops

Integration-first operating protocol for AI coding agents. Coordinate Codex,
OpenCode, Augment, OpenClaw, Hermes, and future MCP tools through repo-native
files — no daemon, no server, no new dependencies.

[📖 Case Study: How I Stopped AI Agents From Fighting My Repo](docs/case-study.md)

## 5-Minute Start

```bash
# Clone and seed
git clone https://github.com/hongphuc5497/agent-ops.git
cd agent-ops

# Check it works
./scripts/ao check

# Seed into another repo
./scripts/init-repo.sh /path/to/your-project
cd /path/to/your-project
./scripts/install-integration.sh codex
```

## The Protocol

Every agent reads the same repo-native state before editing:

```bash
ao status                           # Who owns the active task? What files are claimed?
ao start "fix auth bug" --owner Codex  # Lock a task (only one active at a time)
ao claim "src/auth/**"              # Claim files before editing
ao check                            # Verify protocol health
ao finish done --verification "..." # Complete with evidence
```

Human commands: `ao help`, `ao version`. Agents use the exact same surface.

## What It Coordinates

| Concern | File | Machine-Readable |
|---------|------|:---:|
| Active task owner | `.ai/state/active-task.json` | ✓ |
| File ownership claims | `.ai/state/file-claims.json` | ✓ |
| Agent handoffs | `.ai/state/handoffs.jsonl` | ✓ |
| Task records | `.ai/tasks/*.md` + archive JSON | ✓ |
| Routing rules | `ROUTING.md` | — |
| Architecture decisions | `DECISIONS.md` | — |
| Shared protocol | `.ai/protocol.md` | — |

## Agent Integrations

One command teaches each agent the protocol:

```bash
./scripts/install-integration.sh codex       # Appends to AGENTS.md
./scripts/install-integration.sh opencode    # Appends to instructions.md
./scripts/install-integration.sh augment     # Appends discovery guide
./scripts/install-integration.sh openclaw    # Appends review rules
./scripts/install-integration.sh hermes      # Appends monitor rules
```

Repo-local only — no global config mutated.

## CI & Notifications

GitHub Actions workflows run on every PR and daily:

| Workflow | Trigger | Failure Alert |
|----------|---------|:---:|
| `agent-ops-check.yml` | PR, push to main | Telegram |
| `stale-task-monitor.yml` | Daily 9AM UTC | Telegram |

Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets for notifications.
Slack via `SLACK_WEBHOOK_URL` (optional).

## What This Isn't

- ❌ Not a hosted service or dashboard
- ❌ Not an MCP server (gated on real-world usage)
- ❌ Not an agent framework or orchestration runtime
- ❌ No new dependencies beyond Python 3 and bash

## Dogfooded On

| Repo | Stack | Status |
|------|-------|--------|
| `personal-landing-page` | Next.js 16 / TS / Vercel | ✓ Active |
| `github-digest` | Python / Playwright | ✓ Active |

[Read the full dogfooding log](.ai/memory/phase3-dogfooding-log.md)

## Verify

```bash
./scripts/agent-ops-check.sh
```

## Milestones

[GitHub Milestones](https://github.com/hongphuc5497/agent-ops/milestones)

1. ✓ MVP — Agent Integration Protocol
2. ✓ Consolidate & Self-Bootstrap
3. ✓ Dogfood & Document
4. ○ Package & Distribute
