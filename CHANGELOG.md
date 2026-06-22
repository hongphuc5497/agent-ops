# Changelog

All notable changes to Agent Ops are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## 0.5.3 — 2026-06-22

Bug-fix release. `agent-ops init`/`upgrade` no longer corrupt an existing
`.ai/` allowlist in a target repo's `.gitignore`.

`ensure_gitignore` only recognized the blanket `.ai/` form, so a repo using the
v0.5.0 allowlist style (`.ai/*` followed by `!.ai/...` rules to commit some
`.ai/` source while ignoring runtime state) had a redundant blanket `.ai/`
appended on upgrade — which re-ignored the very files the `!` rules un-ignore.
The check now matches both `.ai/` and the `.ai/*` allowlist anchor and leaves an
allowlisted `.gitignore` untouched. Blanket and missing cases are unchanged.

Added `tests/gitignore.test.js` covering the allowlist, bare, and missing cases.

## 0.5.2 — 2026-06-22

Bug-fix release. `scripts/agent-ops-check.sh` no longer fails when a target
repo gitignores `.ai/` — the default layout produced by `agent-ops init`.

Previously `.ai/TASK.md`, `.ai/ROUTING.md`, `.ai/DECISIONS.md`, and the
`.ai/integrations/templates/**` files were listed as unconditional core files,
so the `Agent Ops Check` GitHub workflow failed on a clean CI checkout with
`missing required file: .ai/TASK.md` even though those paths are intentionally
gitignored. They now sit in the `.ai/protocol.md`-gated block: a repo that
commits its `.ai/` source still gets full validation, while a repo that
gitignores it (the default) skips the `.ai/` checks and passes.

Added `tests/clean-checkout.test.js`, which extracts the tracked tree with
`git archive` — exactly what CI checks out — and asserts the check passes, plus
a negative case proving a committed-but-incomplete `.ai/` still fails.

Run `agent-ops upgrade` in existing repos to pick up the tolerant check.

## 0.5.1 — 2026-06-20

Docs-only release. Every `npx @hongphuc5497/agent-ops` and
`npm install -g @hongphuc5497/agent-ops` example in `README.md`,
`docs/SETUP.md`, and `docs/plug-and-play.md` now uses the explicit
`@latest` dist-tag suffix. Equivalent semantics; bypasses npx's local
cache and signals intent more clearly to readers who copy-paste the
quick start.

No code, no behavior change. Cut as a patch release so the npm
package page reflects the updated install instructions immediately.

## 0.5.0 — 2026-06-20

**Breaking layout change.** Four Agent Ops top-level entries moved into
`.ai/`: `TASK.md`, `ROUTING.md`, `DECISIONS.md`, and the entire
`integrations/` directory. `agent-ops upgrade` auto-migrates existing
v0.4.x repos — content is preserved verbatim and `git mv` is used so file
history follows the rename.

### Why

The repo root collected Agent Ops files that didn't need to be there. After
the move, only files that **must** live at the root remain — universally-
recognized files (`README`, `LICENSE`, `package.json`), and files that
external tools look for by convention (`AGENTS.md` for Codex, `CLAUDE.md`
for Claude Code). Everything else now lives in `.ai/`, the working
directory of the protocol.

### Migration

```bash
# Existing v0.4.x install
agent-ops upgrade

# The output now includes "migrated X to .ai/X" lines. Content is preserved.
# Re-running upgrade is a no-op — the migration is idempotent.
```

`agent-ops doctor` flags any repo that still has the legacy layout, with a
remedy line pointing at `agent-ops upgrade`.

### What stays at root

| File | Why |
|---|---|
| `AGENTS.md` | Codex convention — looks for it at the root |
| `CLAUDE.md` | Claude Code convention — looks for it at the root |
| `README.md`, `LICENSE`, `package.json`, `.gitignore` | Universal |

### What moved into `.ai/`

| Old path | New path | Notes |
|---|---|---|
| `TASK.md` | `.ai/TASK.md` | User data — preserved on upgrade |
| `ROUTING.md` | `.ai/ROUTING.md` | Shipped content — refreshed on upgrade |
| `DECISIONS.md` | `.ai/DECISIONS.md` | User data — preserved on upgrade |
| `integrations/` | `.ai/integrations/templates/` | Shipped content — resolves the "two `integrations/`" naming collision (templates live next to runtime instances under one parent dir) |

### Added

- **Auto-migration** in `agent-ops upgrade` (`scripts/init-repo.sh`):
  detects legacy root files **and** the legacy `integrations/`
  directory, uses `git mv` when tracked (history follows the rename),
  falls back to plain `mv` otherwise. Dry-run mode reports the moves
  it would make without touching the repo.
- **`doctor.legacy_layout`** field — lists any of the three files still
  at root, with a `remedy` line telling the user how to migrate. Repos
  with legacy files at root are no longer reported as `ok: true`.
- **`tests/migrate.test.js`** — 5 cases covering the migration: full
  migration with preserved content, idempotent re-runs, doctor flagging,
  fresh-init layout, and dry-run safety.

### Changed

- `scripts/agent-ops-tool.py`: `TASK_MD`, new `ROUTING_MD`/`DECISIONS_MD`
  constants, `check_payload` looks at `.ai/` paths, `TOOL_VERSION` →
  `0.5.0`.
- `scripts/init-repo.sh`: `copy_files`/`generated_files` point at `.ai/`;
  `get_default_content` cases renamed.
- `scripts/agent-ops-check.sh`: `core_files` list updated.
- `integrations/{codex,claude,opencode}/...`: path references updated so
  installed `AGENTS.md`/`CLAUDE.md` rules tell each agent to read the
  new locations.
- `.gitignore`: `!.ai/ROUTING.md` (shipped content), plus `!.ai/TASK.md`
  and `!.ai/DECISIONS.md` for repos that commit their own (like this
  one).
- Docs across `README.md`, `docs/SETUP.md`, `docs/plug-and-play.md`,
  `docs/supported-integrations.md`, `docs/kanban/*.md` updated to the
  new paths.
- This repo (agent-ops itself) ate its own dog food via `git mv` on
  `TASK.md`, `ROUTING.md`, `DECISIONS.md`.

## 0.4.0 — 2026-06-20

Milestone 4: Smarter routing. Closes the weakest gap in the protocol surface
— the hardcoded English-only keyword table that decided which agent owned
every new task. Per-repo overrides are now an opt-in JSON file; existing
repos see zero behavior change.

### Added

- **`.ai/routing.json`** (opt-in) — per-repo routing rules. First match wins;
  unmatched descriptions fall through to the built-in keyword routes, so
  rules never make routing *worse* than the defaults. Match types in this
  release: `keyword` (case-insensitive substring) and `regex` (Python
  `re.search`). Combinator: `any:`. Partial route overrides supported —
  a rule that only sets `owner` keeps the default `workflow`,
  `verification`, and `advisor` fields.
- **`.ai/routing.example.json`** — annotated sample shipped via the npm
  package and copied into target repos by `agent-ops init`. Reproduces
  the built-in routes verbatim plus a custom "security" rule as a
  starting point.
- **[docs/routing.md](docs/routing.md)** — schema reference, validation
  errors, worked examples, what's deferred to a later release.
- **Structural validator** for the new file — surfaces specific problems
  with a `remedy` hint pointing at recovery, following the M1 validator
  pattern.

### Changed

- `infer_route()` is now config-then-fallback. The previous hardcoded
  routing logic is preserved verbatim in `_hardcoded_route()` for the
  fallback path.
- `TOOL_VERSION` bumped to 0.4.0.

### Tests

- `tests/routing.test.js` covers 8 cases: no file → hardcoded fallback,
  keyword match wins, regex match wins, no rule matches → fallback,
  partial override merges with hardcoded default, malformed JSON →
  typed error with remedy hint, invalid schema → validation problems
  list, rule order matters (first match wins).

### Deferred to M4.1

- `--route llm` mode for LLM-classified routing
- `all:` / `not:` combinators (schema-compatible additions)
- `agent-ops route add-rule` CLI for managing rules without hand-editing
- Routing history audit log

## 0.3.1 — 2026-06-20

Smoke-test of the new tag-driven release workflow ([#6](https://github.com/hongphuc5497/agent-ops/pull/6)). No behavior changes from 0.3.0 — this release exists to verify that pushing a `v*.*.*` tag publishes to npm via Trusted Publishing (OIDC) and updates the GitHub release in lockstep. If you're already on 0.3.0, there's nothing to upgrade for.

## 0.3.0 — 2026-06-20

Milestone 2: Onboarding velocity. Shaves the README's 5-minute quick start
to a single command and gives new users a guided way to learn the protocol
without risking real code.

### Added

- **`agent-ops init --interactive`** — picks agents to install and seeds an
  optional tutorial task in one shot. Replaces the previous chain of
  `init` + N × `install` + manual exploration.
- **`agent-ops tutorial`** — drops a guided demo task into `.ai/tasks/` and
  sets it as the active task. The task markdown walks through `claim`,
  `delegate`, and `finish` on fake paths so the user exercises the real
  commands without touching real code. Refuses if a task is already
  active.
- **Tutorial source** at `integrations/tutorial/first-task.md`, shipped
  with the npm package via the existing `integrations/` glob.
- **Reads-and-writes matrix** in `docs/supported-integrations.md` —
  explicit per-agent contract for what gets read, written, and never
  written. This is the boundary that makes Agent Ops a coordination tool
  instead of a chaos tool.

### Tests

- `tests/tutorial.test.js` — `agent-ops tutorial` creates the active task,
  the markdown matches the bundled content, the command refuses on an
  uninitialized repo or when another task is already active.
- `tests/interactive-init.test.js` — drives the interactive prompts via
  stdin, confirms both chosen agents get installed (via assertions on
  `AGENTS.md` / `CLAUDE.md`), confirms the tutorial is seeded when
  requested and skipped when declined, and confirms unknown agent names
  are rejected.

## 0.2.0 — 2026-06-19

Milestone 1: Reliability hardening. Closes the concurrency, validation, and
drive-by-POST gaps surfaced in the v0.1 code review.

### Added

- **State locking.** Every read-modify-write on `.ai/state/*.json` now holds
  an exclusive POSIX advisory lock on `.ai/state/.lock`. Two agents racing
  `claim` on the same path no longer both pass the conflict check — exactly
  one wins, the other sees a clean `claim conflict` error. Falls back to
  atomic-write-only on non-POSIX hosts.
- **Atomic JSON writes.** State files are written via temp file + `fsync` +
  `os.replace`, so a crash mid-write cannot leave a half-written claim or
  active task. JSONL handoffs continue to use `O_APPEND` (POSIX-atomic for
  small lines).
- **Structural state validation.** New inline validators for
  `active-task.json`, `file-claims.json`, and `handoffs.jsonl` surface
  specific problems (`claims[3].paths must be a non-empty array`) instead
  of stack traces or silent corruption.
- **CSRF protection on the kanban server.** A random per-process token is
  injected into `index.html` and required as `x-csrf-token` on every
  mutating request. A drive-by POST from any other page the user has open
  is rejected with a 403, even though the server binds loopback.
- **`agent-ops doctor` command.** New diagnostic that prints tool version,
  Python/Node/git versions, locking strategy, repo init status, and any
  state validation problems — designed to be pasted into a bug report.

### Changed

- All state-mutating commands (`start`, `claim`, `finish`, `handoff`,
  `delegate`, `update-task`) now run under the state lock.
- JSON read errors now include a `remedy` hint pointing at the file and
  the recovery path.
- Bumped the `ao` shell wrapper to `0.2.0`.

### Tests

- `tests/locking.test.js` — eight concurrent claimers with distinct owners
  produce exactly one winner.
- `tests/doctor.test.js` — shape contract for the doctor payload, and a
  case proving corrupt JSONL is reported with a line number.
- `tests/csrf.test.js` — POST without token → 403; with wrong token → 403;
  with correct token → 201. HTML response has the placeholder replaced.

## 0.1.0 — 2026-06-18

Initial public release. Repo-native coordination protocol for AI coding
agents, distributed as `@hongphuc5497/agent-ops`. File-first workflow with
optional localhost kanban UI. See [README.md](README.md) for the full
feature set at launch.
