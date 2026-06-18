# Agent Ops

Integration-first operating protocol for AI coding agents. Coordinate Codex,
OpenCode, Augment, OpenClaw, Hermes, and future MCP tools through repo-native
files. The default workflow is file-only; the optional kanban UI runs as a
localhost-only server when you ask for it.

[📖 Case Study: How I Stopped AI Agents From Fighting My Repo](docs/case-study.md)

## 5-Minute Start

```bash
# Optional: install globally so `agent-ops` / `ao` are on your PATH
npm install -g @hongphuc5497/agent-ops

# Seed into an existing repo (npx works without a global install too)
cd /path/to/your-project
npx @hongphuc5497/agent-ops init

# Check it works
agent-ops check

# Open the local task board
agent-ops kanban

# Teach Codex the protocol
agent-ops install codex
```

## The Protocol

Every agent reads the same repo-native state before editing:

```bash
agent-ops status                              # Who owns the active task?
agent-ops start "fix auth bug" --owner Codex # Lock a task
agent-ops claim "src/auth/**"                # Claim files before editing
agent-ops check                              # Verify protocol health
agent-ops finish done --verification "..."   # Complete with evidence
agent-ops kanban --no-open                   # Open a command-backed board
```

Human commands: `agent-ops help`, `agent-ops version`. Agents can also use the
repo-local `./scripts/ao` wrapper after initialization.

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
agent-ops install list        # Show supported integrations
agent-ops install codex       # Appends to AGENTS.md
agent-ops install opencode    # Appends to instructions.md
agent-ops install augment     # Appends discovery guide
agent-ops install openclaw    # Appends review rules
agent-ops install hermes      # Appends monitor rules
```

Repo-local only — no global config mutated.

Install support is different from live coordination. The install script writes
the files an agent reads; `ROUTING.md`, `TASK.md`, and `ao` define what that
agent may do once work starts. See the [supported integrations matrix](docs/supported-integrations.md).

## Kanban UI

```bash
agent-ops kanban
agent-ops kanban --no-open
agent-ops kanban --port 4783
```

The board reads the same protocol files as the CLI and writes only through
Agent Ops commands. It can create backlog or active tasks, update task metadata,
claim files for the active task, and finish or park the active task. V1 is
intentionally local-only and does not include drag-and-drop; Agent Ops still
allows exactly one active owner at a time.

## CI & Notifications

GitHub Actions workflows run on every PR and daily:

| Workflow | Trigger | Failure Alert |
|----------|---------|:---:|
| `agent-ops-check.yml` | PR, push to main | Telegram |
| `stale-task-monitor.yml` | Daily 9AM UTC | Telegram |

Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets for notifications.
Slack via `SLACK_WEBHOOK_URL` (optional).

## What This Isn't

- ❌ Not a hosted service or cloud dashboard
- ❌ Not an MCP server (gated on real-world usage)
- ❌ Not an agent framework or orchestration runtime
- ❌ No package dependencies beyond Node, Python 3, and bash

## Dogfooded On

| Repo | Stack | Status |
|------|-------|--------|
| `personal-landing-page` | Next.js 16 / TS / Vercel | ✓ Active |
| `github-digest` | Python / Playwright | ✓ Active |
| `AutoCreateVideo` | Node / TypeScript / Vitest | ✓ Active |
| `vite-virtual-cafe` | Remix / Vite / Playwright | ✓ Active |
| `skills` | Markdown / shell / Python validators | ✓ Active |
| `zsh-dotfiles` | Shell / dotfiles | ✓ Active |
| `vibe-coding-learning` | Static learning repo | ✓ Active |
| `prompt-enhancer` | Python / stdlib CLI | ✓ Active |
| `MiroFish` | Flask / Python + Node frontend | ✓ Active |
| `obsidian-wiki` | Markdown / Python scripts | ✓ Active |
| `TradingAgents` | Python / finance analysis | ✓ Active |

[Read the full dogfooding log](.ai/memory/phase3-dogfooding-log.md)

## Verify

```bash
agent-ops check
```

## Milestones

[GitHub Milestones](https://github.com/hongphuc5497/agent-ops/milestones)

1. ✓ MVP — Agent Integration Protocol
2. ✓ Consolidate & Self-Bootstrap
3. ✓ Dogfood & Document
4. ✓ Package & Distribute

## Demo

```bash
# Seed into your project
cd ~/my-project
npx @hongphuc5497/agent-ops init                              # install protocol files
npx @hongphuc5497/agent-ops install claude                    # teach Claude
npx @hongphuc5497/agent-ops install codex                     # teach Codex

# Start a task — any agent now checks this first
agent-ops start "add dark mode" --owner Claude
agent-ops claim "src/theme/**"
agent-ops delegate "review colors" --to OpenClaw
agent-ops finish done --verification "npm test"

# CI catches stale tasks daily, Telegram on failure
```

[Full Setup Guide](docs/SETUP.md) · [Plug-and-Play Guide](docs/plug-and-play.md) · [Supported Integrations](docs/supported-integrations.md) · [Case Study](docs/case-study.md)
