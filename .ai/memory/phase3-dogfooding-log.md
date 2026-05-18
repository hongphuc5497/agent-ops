# Phase 3: Dogfooding Log

Started: 2026-05-18

## Repos Dogfooded

| Repo | Stack | Git? | Result |
|------|-------|------|--------|
| `personal-landing-page` | Next.js 16 / TS / Vercel | Yes (existing) | ✓ Full cycle passes |
| `github-digest` | Python / Playwright / DeepSeek | No (had to `git init`) | ✓ Full cycle passes after init |

## Full Cycle Tested (both repos)

```
./scripts/agent-ops-check.sh          ✓
./scripts/ao status                   ✓
./scripts/ao start "task" --owner X   ✓
./scripts/ao claim "README.md"        ✓
./scripts/ao check                    ✓
./scripts/ao finish done --verification "..."  ✓
./scripts/install-integration.sh codex ✓
```

## Friction Points

### 1. `init-repo.sh` doesn't validate git repo
**Severity:** Medium
**Repro:** `./scripts/init-repo.sh /path/to/non-git-dir` succeeds silently but subsequent `git` operations fail.
**Fix:** Add a `git rev-parse --git-dir` check early in `init-repo.sh`, refuse with a clear error if target is not a git repo.

### 2. `--force` needed even for clean targets
**Severity:** Low
**Repro:** Both repos had zero Agent Ops files, yet init-repo.sh still required `--force`. Investigation needed: is the conflict check too aggressive?
**Status:** Worked with `--force`, but the user experience is confusing when no files exist.

### 3. `ao` subcommand discovery missing
**Severity:** Low
**Repro:** `ao` (no args) shows help, but `ao route` required `bash ./scripts/ao route` in some contexts due to PATH/permission resolution.
**Status:** `chmod +x` set by init-repo.sh works. The `./scripts/ao` form works consistently.

### 4. github-digest wasn't a git repo
**Severity:** High (surprising)
**Finding:** One of the two target repos wasn't initialized as a git repo. This is common for local-only projects or experiments. `init-repo.sh` should either `git init` for the user or refuse loudly.
**Recommendation:** Option A — refuse with "target is not a git repo; run git init first". Option B — offer to `git init` with a prompt.

## What Worked Well

- `init-repo.sh` copied exactly the right set of files (32 files)
- `agent-ops-check.sh` passed in both target repos immediately after seeding
- `ao` CLI worked identically in both repos with different stacks
- `install-integration.sh codex` correctly appended rules to AGENTS.md
- CI workflows (agent-ops-check.yml, notify-failure.yml) copied and valid
- Task cycle (start → claim → check → finish) was fast and JSON-clean

## Next Actions

1. Fix friction point #1: add git repo check to init-repo.sh
2. Investigate friction point #2: why --force needed for clean targets
3. Add `scripts/ao route` to the init-repo.sh chmod list (already done)
4. Write public case study once 3+ repos are dogfooded
