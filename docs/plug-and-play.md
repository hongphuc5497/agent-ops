# Plug-and-Play: Agent Ops on Any Agent

Agent Ops is a repo-native protocol. An agent only needs to read files and run
shell commands. Here's how to wire it into each agent in 30 seconds.

## The Pattern (Same for All)

```
1. Seed the protocol     →  npx @hongphuc5497/agent-ops@latest init
2. Teach your agent      →  agent-ops install <agent>
3. Agent reads state     →  agent-ops status
4. Agent locks a task    →  agent-ops start "task" --owner <agent>
5. Agent claims files    →  agent-ops claim "src/**"
6. Agent finishes        →  agent-ops finish done --verification "..."
7. Human opens board     →  agent-ops kanban
```

To see the current supported agents:

```bash
agent-ops install list
```

Already installed on an older release? Refresh the tooling in place without
touching your `.ai/TASK.md`/`.ai/DECISIONS.md`:

```bash
npx @hongphuc5497/agent-ops@latest upgrade            # re-copies scripts, integrations, protocol, workflows
npx @hongphuc5497/agent-ops@latest upgrade --dry-run  # preview first
```

Use `upgrade` rather than `init --force` — `--force` regenerates `.ai/TASK.md` and
`.ai/DECISIONS.md` from defaults and would overwrite your real content.

Agent Ops keeps install setup and live coordination separate. The install
template teaches an agent the protocol; `.ai/TASK.md`, file claims, handoffs, and
verification decide what the agent may do during active work.

The optional board is just another command-backed view:

```bash
agent-ops kanban
agent-ops kanban --no-open
agent-ops kanban --port 4783
```

It runs on `127.0.0.1`, reads the same repo files, and writes through Agent Ops
commands. V1 lets users create and update tasks, claim files for the active
task, and finish or park the active task. It does not support drag-and-drop.

---

## Claude Code

**Config file:** `CLAUDE.md` (repo root)

```bash
# Install in your repo
agent-ops install claude
```

**What it does:** Appends Agent Ops rules to `CLAUDE.md`. Claude Code reads this
file on every session start and follows the protocol automatically.

**What Claude sees:**
```markdown
# Agent Ops Rules for Claude Code

Before editing:
1. Read .ai/protocol.md, .ai/TASK.md, and .ai/ROUTING.md.
2. Run scripts/agent-ops-tool.py status
3. If no task is active, start one
4. Claim files before editing
...
```

**Verify:**
```bash
cat CLAUDE.md | grep "Agent Ops Rules for Claude"
```

---

## Codex

**Config file:** `AGENTS.md` (repo root)

```bash
agent-ops install codex
```

**What it does:** Appends Agent Ops rules to `AGENTS.md`. Codex reads this file
as its instruction set for the repo.

**Verify:**
```bash
cat AGENTS.md | grep "Agent Ops Rules for Codex"
```

---

## Hermes

**Config file:** `.ai/integrations/hermes-monitor.md`

```bash
agent-ops install hermes
```

**What it does:** Writes monitor instructions. Hermes acts as the watcher —
checks task freshness, notifies on stale tasks. Does NOT edit implementation
files by default.

**Role:** Monitor only (not implementer). Use for:
- Scheduled task freshness checks (cron)
- Stale task alerts (Telegram/Slack)
- Weekly review reminders

**Verify:**
```bash
cat .ai/integrations/hermes-monitor.md
```

---

## Augment

**Config file:** `.ai/integrations/augment-discovery.md`

```bash
agent-ops install augment
```

**What it does:** Writes a discovery prompt template. Augment is codebase
navigation — find relevant files, symbols, callers, tests, and risk surfaces.

**Role:** Read-only advisor. Does NOT edit files by default.

**When to invoke:**
```text
Find the code surfaces relevant to this Agent Ops task.
Task: <active task title>
Active owner: <from .ai/TASK.md>
...
```

**Verify:**
```bash
cat .ai/integrations/augment-discovery.md
```

---

## Quick Reference

| Agent | Command | Output | Role |
|-------|---------|--------|------|
| Claude | `agent-ops install claude` | Appends to `CLAUDE.md` | Brain or worker |
| Codex | `agent-ops install codex` | Appends to `AGENTS.md` | Default implementer |
| OpenCode | `agent-ops install opencode` | Writes `.ai/integrations/opencode-instructions.md` | Isolated implementation lane |
| Hermes | `agent-ops install hermes` | Writes monitor rules | Watcher / notifier |
| Augment | `agent-ops install augment` | Writes discovery guide | Codebase navigator |
| OpenClaw | `agent-ops install openclaw` | Writes review rules | Product / scope reviewer |

| Human UI | Command | Output | Role |
|----------|---------|--------|------|
| Kanban | `agent-ops kanban` | Local task board | Create/update tasks and inspect ownership |

See [Supported Integrations](supported-integrations.md) for the full matrix and
the checklist for adding a new agent.

---

## Fresh Repo, All Agents

```bash
# 1. Seed Agent Ops
cd /path/to/your-repo
npx @hongphuc5497/agent-ops@latest init

# 2. Install all agent integrations
agent-ops install claude
agent-ops install codex
agent-ops install hermes
agent-ops install augment

# 3. Verify
agent-ops check

# 4. Start coding with any agent — they all respect the same protocol
```

---

## Adding a New Agent

Agent Ops integration is a template file + one case in `install-integration.sh`.
To add a new agent:

1. Create `.ai/integrations/templates/<agent>/<config>.template.md`
2. Add a case to `scripts/install-integration.sh` that writes it to the right
   config file for that agent (CLAUDE.md, AGENTS.md, .cursorrules, etc.)
3. Add the template path to `scripts/init-repo.sh` copy list

The protocol surface is the same for every agent — `ao status`, `ao start`,
`ao claim`, `ao finish`, `ao check`. The integration just teaches each agent
_when_ to call it.
