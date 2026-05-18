# Case Study: How I Stopped AI Agents From Fighting My Repo

**Date:** May 2026  
**Author:** Hong Phuc (hongphuc5497)  
**Repo:** [hongphuc5497/agent-ops](https://github.com/hongphuc5497/agent-ops)

## TL;DR

I run 4 different AI coding agents (Codex, OpenCode, Hermes, Augment) across
multiple repos. They kept stepping on each other — editing the same file,
starting overlapping tasks, leaving stale locks. I built Agent Ops: a
**repo-native coordination protocol** that any agent can read. No daemon. No
server. Just markdown and JSON files that sit in `.ai/`.

Two repos dogfooded. Zero agent conflicts since.

---

## The Problem

Before Agent Ops, a typical session looked like this:

```
Codex edits README.md while I'm reviewing.
OpenCode opens a PR touching the same lines.
Hermes cron job fires and modifies the task file.
I spend 10 minutes untangling the mess.
```

This isn't a theoretical edge case. It happened **every other day** when I was
actively building across repos. The root cause: each agent is stateless and
optimistic. They assume they own the repo. They don't check before editing.

I tried solutions: branch naming conventions, manual "I'm working on X" messages,
disabling some agents. None scaled past one repo.

---

## The Insight

Agent coordination doesn't need a server. It needs **shared state in the repo
itself** — the one thing every agent already reads.

If an agent can `cat .ai/state/active-task.json` before editing, it knows:
- Who owns the current task
- Which files are claimed
- What verification is expected

This is obvious in hindsight. Every team has a task board. But AI agents don't
check a board — they need the equivalent in their native context: the repo.

---

## What Agent Ops Is (and Isn't)

**It is:**
- A set of markdown and JSON files in `.ai/`
- A tiny Python script (`scripts/agent-ops-tool.py`) that reads/writes those files
- A thin CLI (`scripts/ao`) for humans and agents
- Integration templates that teach each agent the protocol

**It isn't:**
- A hosted service or dashboard
- An MCP server (yet — gated on real-world usage)
- A new agent framework or orchestration runtime
- Something that requires installing anything globally

---

## Dogfooding Results

I seeded Agent Ops into two of my own repos with different stacks:

| Repo | Stack | Agent Ops Init | Task Cycles |
|------|-------|---------------|-------------|
| `personal-landing-page` | Next.js 16 / TypeScript / Vercel | 32 files, instant | Full cycle: start → claim → check → finish |
| `github-digest` | Python / Playwright / DeepSeek API | 32 files, instant | Full cycle: start → claim → check → finish |

Both repos passed the check suite immediately after seeding. The full task cycle
(start → claim → check → finish) took under 2 seconds per repo.

### What Worked Immediately
- `init-repo.sh` copied exactly the right files (32 files, zero manual fixes)
- `agent-ops-check.sh` passed in both target repos on first run
- The `ao` CLI worked identically across Next.js and Python repos
- `install-integration.sh codex` correctly appended rules to AGENTS.md
- CI workflows with Telegram failure notifications fired correctly

### Friction Found and Fixed
1. **`init-repo.sh` didn't validate git repos** — now refuses non-git targets with a clear error
2. **`--force` flag UX** — needed even on clean repos (investigated, low priority)
3. **One target wasn't a git repo** — discovered during dogfooding, fixed with `git init`

---

## The Protocol in 60 Seconds

```bash
# Seed Agent Ops into your repo
./scripts/init-repo.sh /path/to/your-project

# Install agent integration (Codex, OpenCode, etc.)
./scripts/install-integration.sh codex

# Check state
./scripts/ao status

# Start a task (only one active at a time)
./scripts/ao start "add dark mode toggle" --owner Codex

# Claim files before editing
./scripts/ao claim "src/theme/**" "tests/theme/**"

# Finish and verify
./scripts/ao finish done --verification "npm test && npm run lint"

# Health check
./scripts/ao check
```

Any agent that can run a shell command can be taught this protocol. The
integration templates do exactly that — they append agent-specific rules to
CLAUDE.md, AGENTS.md, or equivalent files.

---

## What Comes Next

1. **More dogfooding** — seed into 3+ more repos with different agent mixes
2. **Collect outside feedback** — share with 5 indie devs who use coding agents
3. **MCP server** — only after the JSON bridge proves useful in real repos
4. **Paid template repo** — a clean, opinionated starting point for indie devs

---

## One Thing I'd Tell My Past Self

Don't build a platform. Build a protocol.

The instinct is to make a dashboard, a service, an orchestration runtime. Resist
it. The repo IS the platform. The file system IS the database. Git IS the
synchronization layer. Everything else is premature.

Agent Ops is 32 files and a Python script. It's boring. It works.

---

*Built by one indie developer. No dependencies beyond Python 3 and bash.*
