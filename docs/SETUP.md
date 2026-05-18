# SETUP.md — Agent Ops in 5 Minutes

You're an indie dev using AI coding agents (Claude Code, Codex, Hermes, etc.).
They keep stepping on each other. Agent Ops fixes that with **repo-native
coordination files** — no daemon, no server, no new dependencies.

## 1. Clone the Template (30 seconds)

```bash
git clone https://github.com/hongphuc5497/agent-ops.git my-agent-ops-repo
cd my-agent-ops-repo
```

Or click **"Use this template"** on GitHub to create a new repo instantly.

## 2. Verify It Works (30 seconds)

```bash
./scripts/ao check
# → {"ok": true, "missing": [], "stale": false}
```

This confirms the protocol files, schemas, and bridge are intact.

## 3. Seed Into Your Project (30 seconds)

```bash
./scripts/init-repo.sh /path/to/your-existing-project
cd /path/to/your-existing-project
./scripts/ao check
# → agent-ops check passed
```

This copies 32 files: the protocol, schemas, workflows, JSON bridge, `ao` CLI,
CI workflows, and integration templates. No existing files are overwritten.

## 4. Teach Your Agents (30 seconds each)

```bash
./scripts/install-integration.sh claude    # Appends to CLAUDE.md
./scripts/install-integration.sh codex     # Appends to AGENTS.md
./scripts/install-integration.sh hermes    # Writes monitor rules
./scripts/install-integration.sh augment   # Writes discovery guide
./scripts/install-integration.sh opencode  # Writes implementation lanes
./scripts/install-integration.sh openclaw  # Writes review rules
```

Each agent now reads the protocol on session start.

## 5. Run Your First Task (60 seconds)

```bash
# Start a task — exactly one active at a time
./scripts/ao start "add dark mode toggle" --owner Claude

# Claim files before editing
./scripts/ao claim "src/theme/**" "tests/theme/**"

# Check state anytime
./scripts/ao status

# Delegate sub-work to another agent
./scripts/ao delegate "review color contrast ratios" --to OpenClaw --files "src/theme/colors.ts"

# Finish with verification
./scripts/ao finish done --verification "npm test && npm run lint"
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
| `integrations/` | Templates for Claude, Codex, OpenCode, Augment, OpenClaw, Hermes |
| `.github/workflows/` | CI checks and failure notifications |

## FAQ

**Q: Can I use this with just one agent?**
Yes. Even solo, the protocol prevents you from accidentally starting overlapping
tasks or losing track of what's in progress.

**Q: Does this replace my agent's existing config?**
No. `install-integration.sh` appends, never overwrites. It's idempotent — run it
again and it detects existing rules.

**Q: Do I need to run a server?**
No. Everything is files. Git handles synchronization across machines.

**Q: What if I don't use Claude/Codex/OpenCode?**
Add your own integration template. It's a markdown file + one case in
`install-integration.sh`. See `docs/plug-and-play.md`.

**Q: Can I customize the protocol?**
Yes. Edit `.ai/protocol.md`, `ROUTING.md`, and `DECISIONS.md`. The bridge
reads the file system — no compiled state to rebuild.
