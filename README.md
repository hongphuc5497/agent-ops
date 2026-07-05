# Agent Ops

Integration-first operating protocol for AI coding agents. Coordinate Codex,
OpenCode, Augment, OpenClaw, Hermes, and future MCP tools through repo-native
files. The default workflow is file-only; the optional kanban UI runs as a
localhost-only server when you ask for it.

[📖 Case Study: How I Stopped AI Agents From Fighting My Repo](docs/case-study.md)

## 60-Second Start

```bash
# One command: install, pick your agents, learn the protocol via a guided task
npx @hongphuc5497/agent-ops@latest init --interactive
```

Or step by step:

```bash
# Optional: install globally so `agent-ops` / `ao` are on your PATH
npm install -g @hongphuc5497/agent-ops@latest

# Seed into an existing repo (npx works without a global install too)
cd /path/to/your-project
npx @hongphuc5497/agent-ops@latest init

# Check it works
agent-ops check

# Drop a guided demo task to learn claim / delegate / finish
agent-ops tutorial

# Open the local task board
agent-ops kanban

# Teach Codex the protocol
agent-ops install codex
```

### Coordinate two agents (the whole point)

```bash
# In your repo, once:
npx @hongphuc5497/agent-ops@latest init
agent-ops hook install                 # blocks commits that touch another agent's claims

# Wire each agent in natively over MCP (no CLI shelling needed):
claude mcp add agent-ops -- npx -y @hongphuc5497/agent-ops@latest mcp
# codex: add to ~/.codex/config.toml —
#   [mcp_servers.agent-ops]
#   command = "npx"
#   args = ["-y", "@hongphuc5497/agent-ops@latest", "mcp", "--repo", "/abs/path/to/repo"]

# Give each agent an identity (per-process, so a shared checkout stays safe):
AGENT_OPS_OWNER=claude claude    # or: git config agent-ops.owner <name> as human fallback
AGENT_OPS_OWNER=codex codex
```

From there both agents see the same `status`, claim files as native tools,
and the pre-commit hook enforces claims instead of trusting etiquette.

**Why not git worktrees?** Worktrees isolate agents by copying the checkout —
you pay branch juggling, merge conflicts at the end, and lose the shared dev
server. Agent Ops keeps one checkout with visible ownership and blocked
conflicting commits. See `.ai/DECISIONS.md` for the full rationale.

## The Protocol

Every agent reads the same repo-native state before editing:

```bash
agent-ops status                              # Who owns the active task?
agent-ops start "fix auth bug" --owner Codex # Lock a task
agent-ops claim "src/auth/**"                # Claim files before editing
agent-ops check                              # Verify protocol health
agent-ops doctor                             # Diagnostics for bug reports
agent-ops finish done --verification "..."   # Complete with evidence
agent-ops kanban --no-open                   # Open a command-backed board
```

Human commands: `agent-ops help`, `agent-ops version`, `agent-ops tutorial`.
Agents can also use the repo-local `./scripts/ao` wrapper after initialization.

## What It Coordinates

| Concern | File | Machine-Readable |
|---------|------|:---:|
| Active task owner | `.ai/state/active-task.json` | ✓ |
| File ownership claims | `.ai/state/file-claims.json` | ✓ |
| Agent handoffs | `.ai/state/handoffs.jsonl` | ✓ |
| Task records | `.ai/tasks/*.md` + archive JSON | ✓ |
| Routing rules | `.ai/ROUTING.md` | — |
| Architecture decisions | `.ai/DECISIONS.md` | — |
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
the files an agent reads; `.ai/ROUTING.md`, `.ai/TASK.md`, and `ao` define what that
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

The server binds `127.0.0.1`, rejects non-loopback `Host` headers, and (since
0.2.0) requires a per-process CSRF token on every mutating request — a
drive-by POST from any other page the user has open is rejected even on
loopback.

## Reliability

Since 0.2.0, every state mutation is safe for concurrent agents:

- **State locking** — `claim`, `start`, `finish`, `handoff`, `delegate` all
  hold an exclusive POSIX advisory lock. Two agents racing the same path
  produce exactly one winner; the other gets a structured `claim conflict`.
  Where locking is unavailable (Windows), mutations are refused with a clear
  error instead of silently racing — `AGENT_OPS_UNSAFE_NO_LOCK=1` overrides
  for single-agent use; read-only commands always work.
- **Crash recovery** — a crashed agent's claims are surfaced by
  `agent-ops doctor` (stale + orphan detection) and dropped with
  `agent-ops claim --release <paths>`; releasing another agent's claims
  requires `--force --reason` and is audited to the handoff log.
- **Enforcement** — `agent-ops hook install` adds a pre-commit hook that
  blocks commits touching files claimed by a different agent, turning claims
  from etiquette into a guarantee. Identity comes from `AGENT_OPS_OWNER`
  (per-process) or `git config agent-ops.owner` (human fallback).
- **Atomic writes** — `.ai/state/*.json` is written via temp file + `fsync`
  + `os.replace`. A crash mid-write cannot leave a half-written claim.
- **Structural validation** — corrupt state files surface a typed `problems`
  list with a `remedy` hint instead of a stack trace.
- **`agent-ops doctor`** — paste-it-into-a-bug-report diagnostic.

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
- ❌ Not an agent framework or orchestration runtime
- ❌ No package dependencies beyond Node, Python 3, and bash — the MCP
  server is hand-rolled stdio JSON-RPC, zero runtime deps

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

[GitHub Milestones](https://github.com/hongphuc5497/agent-ops/milestones) · [CHANGELOG](CHANGELOG.md)

1. ✓ MVP — Agent Integration Protocol
2. ✓ Consolidate & Self-Bootstrap
3. ✓ Dogfood & Document
4. ✓ Package & Distribute (v0.1.0)
5. ✓ Reliability hardening — locking, atomic writes, CSRF, doctor (v0.2.0)
6. ✓ Onboarding velocity — interactive init, tutorial, reads/writes matrix (v0.3.0)
7. ✓ Smarter routing — per-repo `.ai/routing.json` overrides (v0.4.0) — see [docs/routing.md](docs/routing.md)
8. ✓ Consolidated layout — `TASK.md` / `ROUTING.md` / `DECISIONS.md` and `integrations/` moved into `.ai/`; `agent-ops upgrade` auto-migrates (v0.5.0)
9. ✓ Adoption release — MCP server, pre-commit claim enforcement, crash recovery, honest cross-platform locking (v0.6.0)

## Demo

```bash
# One command: install, pick agents, seed a tutorial task
cd ~/my-project
npx @hongphuc5497/agent-ops@latest init --interactive

# Or do it step by step
npx @hongphuc5497/agent-ops@latest init                              # install protocol files
npx @hongphuc5497/agent-ops@latest install claude                    # teach Claude
npx @hongphuc5497/agent-ops@latest install codex                     # teach Codex
npx @hongphuc5497/agent-ops@latest tutorial                          # learn the loop

# Start a real task — any agent now checks this first
agent-ops start "add dark mode" --owner Claude
agent-ops claim "src/theme/**"
agent-ops delegate "review colors" --to OpenClaw
agent-ops finish done --verification "npm test"

# CI catches stale tasks daily, Telegram on failure
```

[Full Setup Guide](docs/SETUP.md) · [Plug-and-Play Guide](docs/plug-and-play.md) · [Supported Integrations](docs/supported-integrations.md) · [Case Study](docs/case-study.md)
