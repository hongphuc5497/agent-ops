# Plug-and-Play: Agent Ops on Any Agent

Agent Ops is a repo-native protocol. An agent only needs to read files and run
shell commands. Here's how to wire it into each agent in 30 seconds.

## The Pattern (Same for All)

```
1. Seed the protocol     →  ./scripts/init-repo.sh .
2. Teach your agent      →  ./scripts/install-integration.sh <agent>
3. Agent reads state     →  ./scripts/ao status
4. Agent locks a task    →  ./scripts/ao start "task" --owner <agent>
5. Agent claims files    →  ./scripts/ao claim "src/**"
6. Agent finishes        →  ./scripts/ao finish done --verification "..."
```

---

## Claude Code

**Config file:** `CLAUDE.md` (repo root)

```bash
# Install in your repo
./scripts/install-integration.sh claude
```

**What it does:** Appends Agent Ops rules to `CLAUDE.md`. Claude Code reads this
file on every session start and follows the protocol automatically.

**What Claude sees:**
```markdown
# Agent Ops Rules for Claude Code

Before editing:
1. Read .ai/protocol.md, TASK.md, and ROUTING.md.
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
./scripts/install-integration.sh codex
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
./scripts/install-integration.sh hermes
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
./scripts/install-integration.sh augment
```

**What it does:** Writes a discovery prompt template. Augment is codebase
navigation — find relevant files, symbols, callers, tests, and risk surfaces.

**Role:** Read-only advisor. Does NOT edit files by default.

**When to invoke:**
```text
Find the code surfaces relevant to this Agent Ops task.
Task: <active task title>
Active owner: <from TASK.md>
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
| Claude | `./scripts/install-integration.sh claude` | Appends to `CLAUDE.md` | Brain or worker |
| Codex | `./scripts/install-integration.sh codex` | Appends to `AGENTS.md` | Default implementer |
| Hermes | `./scripts/install-integration.sh hermes` | Writes monitor rules | Watcher / notifier |
| Augment | `./scripts/install-integration.sh augment` | Writes discovery guide | Codebase navigator |

---

## Fresh Repo, All Agents

```bash
# 1. Seed Agent Ops
./scripts/init-repo.sh /path/to/your-repo
cd /path/to/your-repo

# 2. Install all agent integrations
./scripts/install-integration.sh claude
./scripts/install-integration.sh codex
./scripts/install-integration.sh hermes
./scripts/install-integration.sh augment

# 3. Verify
./scripts/ao check

# 4. Start coding with any agent — they all respect the same protocol
```

---

## Adding a New Agent

Agent Ops integration is a template file + one case in `install-integration.sh`.
To add a new agent:

1. Create `integrations/<agent>/<config>.template.md`
2. Add a case to `scripts/install-integration.sh` that writes it to the right
   config file for that agent (CLAUDE.md, AGENTS.md, .cursorrules, etc.)
3. Add the template path to `scripts/init-repo.sh` copy list

The protocol surface is the same for every agent — `ao status`, `ao start`,
`ao claim`, `ao finish`, `ao check`. The integration just teaches each agent
_when_ to call it.
