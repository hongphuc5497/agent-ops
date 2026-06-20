# SETUP.md — Agent Ops in 5 Minutes

You're an indie dev using AI coding agents (Claude Code, Codex, Hermes, etc.).
They keep stepping on each other. Agent Ops fixes that with **repo-native
coordination files**. The core workflow is file-only; the optional kanban UI is
a localhost server you start on demand.

## 1. Install the Protocol (30 seconds)

```bash
cd /path/to/your-existing-project
npx @hongphuc5497/agent-ops@latest init
```

Prefer a global install? Then the `agent-ops` and `ao` commands are on your PATH:

```bash
npm install -g @hongphuc5497/agent-ops@latest
agent-ops init
```

This seeds Agent Ops into the current repo. You can also pass an explicit
target:

```bash
npx @hongphuc5497/agent-ops@latest init /path/to/your-existing-project
```

## 2. Verify It Works (30 seconds)

```bash
agent-ops check
# → {"ok": true, "missing": [], "stale": false}
```

This confirms the protocol files, schemas, and bridge are intact.

## 3. Seed Into Your Project (30 seconds)

This copies the protocol, schemas, workflows, JSON bridge, `ao` CLI, CI
workflows, docs, and integration templates. No existing files are overwritten.

## 4. Teach Your Agents (30 seconds each)

```bash
agent-ops install list      # See supported integrations
agent-ops install claude    # Appends to CLAUDE.md
agent-ops install codex     # Appends to AGENTS.md
agent-ops install hermes    # Writes monitor rules
agent-ops install augment   # Writes discovery guide
agent-ops install opencode  # Writes implementation lanes
agent-ops install openclaw  # Writes review rules
```

Each agent now reads the protocol on session start.

Agent Ops separates install setup from live coordination. Installing an
integration only writes the instruction file that agent reads. Ownership,
handoffs, and verification still flow through `.ai/TASK.md`, `.ai/ROUTING.md`, and
`./scripts/ao`.

## 5. Run Your First Task (60 seconds)

```bash
# Start a task — exactly one active at a time
agent-ops start "add dark mode toggle" --owner Claude

# Claim files before editing
agent-ops claim "src/theme/**" "tests/theme/**"

# Check state anytime
agent-ops status

# Open the local board
agent-ops kanban --no-open

# Delegate sub-work to another agent
agent-ops delegate "review color contrast ratios" --to OpenClaw --files "src/theme/colors.ts"

# Finish with verification
agent-ops finish done --verification "npm test && npm run lint"
```

## 6. CI & Notifications (optional, 2 minutes)

Set GitHub secrets for failure alerts:

```bash
gh secret set TELEGRAM_BOT_TOKEN --body "..." --repo your/repo
gh secret set TELEGRAM_CHAT_ID --body "..." --repo your/repo
```

Three workflows are already in `.github/workflows/`:
- **agent-ops-check.yml** — runs on every PR and push
- **stale-task-monitor.yml** — daily check for forgotten tasks
- **notify-failure.yml** — reusable, fires Telegram on any failure

Without secrets, workflows run silently (no spurious errors).

## That's It

Your repo now has an operating protocol that every AI agent can read. The key
rule: **one task owner at a time**. Other agents advise, review, or handle
bounded sidecar work — they don't edit the active concern.

---

## What Got Installed

| Directory | Purpose |
|-----------|---------|
| `.ai/protocol.md` | Shared protocol agents read |
| `.ai/state/` | Machine-readable task lock, file claims, handoffs |
| `.ai/schema/` | JSON schemas for validation |
| `.ai/workflows/` | Runbooks: daily, feature, debugging, CI, review, experiment |
| `.ai/templates/` | Task, decision, and project-score templates |
| `scripts/ao` | CLI entrypoint (status, start, claim, delegate, finish, check) |
| `scripts/agent-ops-tool.py` | JSON bridge for agent consumption |
| `scripts/init-repo.sh` | Seed protocol into other repos |
| `scripts/install-integration.sh` | Teach each agent the protocol |
| `.ai/integrations/templates/` | Templates for Claude, Codex, OpenCode, Augment, OpenClaw, Hermes |
| `.github/workflows/` | CI checks and failure notifications |

For the current support matrix, see [Supported Integrations](supported-integrations.md).

## Upgrading an Existing Install

When a new Agent Ops release ships fixes or new commands (for example the kanban
board needs `kanban-snapshot` in `scripts/agent-ops-tool.py`), refresh a repo
that was initialized with an older version:

```bash
cd /path/to/your-existing-project
npx @hongphuc5497/agent-ops@latest upgrade            # or: agent-ops upgrade /path/to/project
```

Upgrade re-copies **only the tooling** — `scripts/*`, `.ai/integrations/templates/*`,
`.ai/protocol.md`, schemas, workflows, templates, and the `.github/workflows`.
It **never overwrites your project content**: `.ai/TASK.md`, `.ai/DECISIONS.md`, and the
runtime state under `.ai/state/` are preserved exactly as-is (a missing
generated file is seeded, an existing one is left untouched). It also keeps
`.ai/` in `.gitignore`.

```bash
npx @hongphuc5497/agent-ops@latest upgrade --dry-run  # preview what would change first
agent-ops check                  # confirm the refreshed repo is healthy
```

Use `upgrade` instead of `init --force`: `--force` regenerates `.ai/TASK.md` and
`.ai/DECISIONS.md` from defaults, which would clobber your real decisions and active
task.

## Optional Kanban Board

```bash
agent-ops kanban
agent-ops kanban --no-open
agent-ops kanban --port 4783
```

This starts a localhost-only UI for the current repo. It reads `.ai/TASK.md`,
`.ai/state/*`, `.ai/tasks/*.md`, and task archives, then writes through
`scripts/agent-ops-tool.py` commands. Use it to create or update tasks, claim
files on the active task, and finish or park the active task. V1 intentionally
does not support drag-and-drop because status changes must remain explicit
Agent Ops commands.

## FAQ

**Q: Can I use this with just one agent?**
Yes. Even solo, the protocol prevents you from accidentally starting overlapping
tasks or losing track of what's in progress.

**Q: Does this replace my agent's existing config?**
No. `install-integration.sh` appends, never overwrites. It's idempotent — run it
again and it detects existing rules.

**Q: Do I need to run a server?**
No. The protocol is files. `agent-ops kanban` is optional and runs only on
`127.0.0.1` while you keep the command alive.

**Q: What if I don't use Claude/Codex/OpenCode?**
Add your own integration template. It's a markdown file + one case in
`install-integration.sh`. See `docs/plug-and-play.md`.

**Q: Can I customize the protocol?**
Yes. Edit `.ai/protocol.md`, `.ai/ROUTING.md`, and `.ai/DECISIONS.md`. The bridge
reads the file system — no compiled state to rebuild.

**Q: How do I update an existing install to a newer release?**
Run `npx @hongphuc5497/agent-ops@latest upgrade` in the repo. It refreshes only the tooling and
leaves `.ai/TASK.md`, `.ai/DECISIONS.md`, and `.ai/state/` untouched. See
[Upgrading an Existing Install](#upgrading-an-existing-install).
